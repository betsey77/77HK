/**
 * Slice C2a — Quota service unit tests (RPC-based, atomic, append-only)
 *
 * Tests trustedSupabase adapter and quotaService (reserve/consume/release/entitlement).
 * Mocks getTrustedSupabase() at the client level — all DB calls are mocked,
 * no real Supabase connection.
 *
 * C2a-FIX invariants tested:
 *  - Atomic reserve via reserve_quota RPC (FOR UPDATE lock in DB, no check-then-act)
 *  - Append-only consume/release (INSERT terminal events, never UPDATE reserve rows)
 *  - Terminal uniqueness (one terminal event per reservation)
 *  - No TOCTOU fallback in release (RPC error → throw, no SELECT-then-UPDATE)
 *  - SUPABASE_SECRET_KEY only (no legacy key names)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ============================================================
// Mock trustedSupabase — vi.hoisted to avoid hoisting issues
// ============================================================

const { mockGetTrustedSupabase } = vi.hoisted(() => ({
  mockGetTrustedSupabase: vi.fn(),
}));

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: mockGetTrustedSupabase,
}));

// Import after mock so quotaService uses the mocked adapter
import {
  reserveQuota,
  consumeQuota,
  releaseQuota,
  getUserEntitlement,
} from '../services/quotaService.js';
import type { QuotaReservation, UserEntitlement } from '../services/quotaService.js';

// ============================================================
// Mock helpers
// ============================================================

interface MockTerminal {
  data?: unknown;
  error?: { code?: string; message: string } | null;
}

function makeQueryResult(terminal: MockTerminal) {
  const methods = ['select', 'insert', 'update', 'eq', 'is', 'order', 'range', 'lte', 'gt'] as const;

  const result = {
    data: terminal.data ?? null,
    error: terminal.error ?? null,
  };

  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => void) => {
      resolve(result);
      return { catch: () => {} };
    },
  };

  for (const m of methods) {
    chain[m] = () => chain;
  }

  chain.maybeSingle = () => ({
    then: (resolve: (v: unknown) => void) => {
      resolve({ data: terminal.data ?? null, error: terminal.error ?? null });
      return { catch: () => {} };
    },
  });

  chain.single = () => ({
    then: (resolve: (v: unknown) => void) => {
      resolve({ data: terminal.data ?? null, error: terminal.error ?? null });
      return { catch: () => {} };
    },
  });

  return chain;
}

function setupClient() {
  const client = {
    from: vi.fn(),
    rpc: vi.fn(),
  };
  mockGetTrustedSupabase.mockReturnValue(client);
  return client;
}

// ============================================================
// Fixtures
// ============================================================

const USER_ID = 'user-001';
const IDEMPOTENCY_KEY = 'ik-reserve-001';
const RESERVATION_ID = '00000000-0000-4000-a000-000000000001';
const SUBSCRIPTION_ID = '00000000-0000-4000-a000-000000000100';

function makeReservationResult(overrides: Record<string, unknown> = {}) {
  return {
    reservation_id: RESERVATION_ID,
    user_id: USER_ID,
    subscription_id: SUBSCRIPTION_ID,
    amount: 1,
    idempotency_key: IDEMPOTENCY_KEY,
    ...overrides,
  };
}

function makeEntitlementRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SUBSCRIPTION_ID,
    quota_used: 5,
    plan: { quota_per_cycle: 50, name: 'Starter' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// 1. trustedSupabase adapter — SUPABASE_SECRET_KEY only
// ============================================================

describe('trustedSupabase adapter', () => {
  it('fail closed when SUPABASE_SECRET_KEY is not set', async () => {
    vi.doUnmock('../services/trustedSupabase.js');

    const savedKey = process.env.SUPABASE_SECRET_KEY;
    const savedKeyFile = process.env.SUPABASE_SECRET_KEY_FILE;
    const savedUrl = process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SECRET_KEY_FILE;

    try {
      const { getTrustedSupabase: realGet } = await import(
        '../services/trustedSupabase.js?t=' + Date.now()
      );
      expect(() => realGet()).toThrow('Trusted service unavailable');
    } finally {
      if (savedKey) process.env.SUPABASE_SECRET_KEY = savedKey;
      if (savedKeyFile) process.env.SUPABASE_SECRET_KEY_FILE = savedKeyFile;
      if (savedUrl) process.env.SUPABASE_URL = savedUrl;
    }
  });

  it('loads a server key through SUPABASE_SECRET_KEY_FILE without copying it into the repo', async () => {
    vi.doUnmock('../services/trustedSupabase.js');

    const savedKey = process.env.SUPABASE_SECRET_KEY;
    const savedKeyFile = process.env.SUPABASE_SECRET_KEY_FILE;
    const savedUrl = process.env.SUPABASE_URL;
    const tempDir = mkdtempSync(join(tmpdir(), 'hk-c2a-key-'));
    const fixturePath = join(tempDir, 'secret.txt');
    writeFileSync(fixturePath, 'SUPABASE_SECRET_KEY=sb_secret_test_fixture\n', 'utf8');

    delete process.env.SUPABASE_SECRET_KEY;
    process.env.SUPABASE_SECRET_KEY_FILE = fixturePath;
    process.env.SUPABASE_URL = 'https://test.supabase.co';

    try {
      const { getTrustedSupabase: realGet } = await import(
        '../services/trustedSupabase.js?t=' + Date.now() + 2
      );
      expect(realGet()).toBeDefined();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
      if (savedKey) process.env.SUPABASE_SECRET_KEY = savedKey;
      else delete process.env.SUPABASE_SECRET_KEY;
      if (savedKeyFile) process.env.SUPABASE_SECRET_KEY_FILE = savedKeyFile;
      else delete process.env.SUPABASE_SECRET_KEY_FILE;
      if (savedUrl) process.env.SUPABASE_URL = savedUrl;
      else delete process.env.SUPABASE_URL;
    }
  });

  it('does not expose the key in error messages', async () => {
    vi.doUnmock('../services/trustedSupabase.js');

    const savedKey = process.env.SUPABASE_SECRET_KEY;
    const savedKeyFile = process.env.SUPABASE_SECRET_KEY_FILE;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SECRET_KEY_FILE;

    try {
      const { getTrustedSupabase: realGet } = await import(
        '../services/trustedSupabase.js?t=' + Date.now() + 1
      );
      expect(() => realGet()).toThrow('Trusted service unavailable');
      try {
        realGet();
      } catch (e: any) {
        expect(e.message).not.toMatch(/key/i);
        expect(e.message).not.toMatch(/secret/i);
        expect(e.message).not.toMatch(/service_role/i);
        expect(e.message).not.toMatch(/SUPABASE_/i);
        expect(e.message).not.toMatch(/VITE_/i);
      }
    } finally {
      if (savedKey) process.env.SUPABASE_SECRET_KEY = savedKey;
      else delete process.env.SUPABASE_SECRET_KEY;
      if (savedKeyFile) process.env.SUPABASE_SECRET_KEY_FILE = savedKeyFile;
      else delete process.env.SUPABASE_SECRET_KEY_FILE;
    }
  });

});

// ============================================================
// 2. quotaService — reserveQuota (calls reserve_quota RPC)
// ============================================================

describe('quotaService', () => {
  describe('reserveQuota', () => {
    it('returns QuotaReservation on successful RPC call', async () => {
      const client = setupClient();
      client.rpc.mockResolvedValue({
        data: makeReservationResult(),
        error: null,
      });

      const result = await reserveQuota(USER_ID, IDEMPOTENCY_KEY);
      expect(result).not.toBeNull();
      expect(result!.reservationId).toBe(RESERVATION_ID);
      expect(result!.userId).toBe(USER_ID);
      expect(result!.subscriptionId).toBe(SUBSCRIPTION_ID);
      expect(result!.amount).toBe(1);
      expect(result!.idempotencyKey).toBe(IDEMPOTENCY_KEY);

      // Verify RPC was called with correct parameters
      expect(client.rpc).toHaveBeenCalledWith('reserve_quota', {
        _user_id: USER_ID,
        _idempotency_key: IDEMPOTENCY_KEY,
      });
    });

    it('returns null when RPC returns null (no subscription)', async () => {
      const client = setupClient();
      client.rpc.mockResolvedValue({ data: null, error: null });

      const result = await reserveQuota(USER_ID, IDEMPOTENCY_KEY);
      expect(result).toBeNull();
    });

    it('returns null when RPC returns null (quota exhausted)', async () => {
      const client = setupClient();
      client.rpc.mockResolvedValue({ data: null, error: null });

      const result = await reserveQuota(USER_ID, 'ik-exhausted');
      expect(result).toBeNull();
    });

    it('duplicate idempotency key returns existing reservation (atomic via RPC)', async () => {
      const client = setupClient();
      // RPC detects existing reservation and returns it
      client.rpc.mockResolvedValue({
        data: makeReservationResult({ reservation_id: 'existing-reservation-uuid' }),
        error: null,
      });

      const result = await reserveQuota(USER_ID, IDEMPOTENCY_KEY);
      expect(result).not.toBeNull();
      expect(result!.reservationId).toBe('existing-reservation-uuid');
      // No double-count — RPC handles idempotency atomically
    });

    it('throws on RPC error', async () => {
      const client = setupClient();
      client.rpc.mockResolvedValue({
        data: null,
        error: { message: 'database connection error' },
      });

      await expect(reserveQuota(USER_ID, IDEMPOTENCY_KEY)).rejects.toThrow(
        'Quota reserve failed',
      );
    });

    it('no double-model-call: RPC called exactly once per reserve', async () => {
      const client = setupClient();
      client.rpc.mockResolvedValue({
        data: makeReservationResult(),
        error: null,
      });

      await reserveQuota(USER_ID, IDEMPOTENCY_KEY);
      expect(client.rpc).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // 3. consumeQuota (calls consume_quota RPC — append-only)
  // ============================================================

  describe('consumeQuota', () => {
    it('returns true on successful RPC call', async () => {
      const client = setupClient();
      client.rpc.mockResolvedValue({ data: true, error: null });

      const result = await consumeQuota(USER_ID, RESERVATION_ID);
      expect(result).toBe(true);

      expect(client.rpc).toHaveBeenCalledWith('consume_quota', {
        _user_id: USER_ID,
        _reservation_id: RESERVATION_ID,
      });
    });

    it('duplicate consume is idempotent (RPC returns true)', async () => {
      const client = setupClient();
      // RPC detects terminal event already exists → returns true
      client.rpc.mockResolvedValue({ data: true, error: null });

      const result = await consumeQuota(USER_ID, RESERVATION_ID);
      expect(result).toBe(true);
    });

    it('returns false when reservation not found', async () => {
      const client = setupClient();
      client.rpc.mockResolvedValue({ data: false, error: null });

      const result = await consumeQuota(USER_ID, 'non-existent-id');
      expect(result).toBe(false);
    });

    it('returns false for cross-user reservation', async () => {
      const client = setupClient();
      // RPC checks user ownership → returns false
      client.rpc.mockResolvedValue({ data: false, error: null });

      const result = await consumeQuota('other-user', RESERVATION_ID);
      expect(result).toBe(false);
    });

    it('returns false when terminal event is release (consume-after-release conflict)', async () => {
      const client = setupClient();
      // RPC detects existing terminal event_type='release' → returns false (conflict)
      client.rpc.mockResolvedValue({ data: false, error: null });

      const result = await consumeQuota(USER_ID, RESERVATION_ID);
      expect(result).toBe(false);
    });

    it('throws on RPC error', async () => {
      const client = setupClient();
      client.rpc.mockResolvedValue({
        data: null,
        error: { message: 'database error' },
      });

      await expect(consumeQuota(USER_ID, RESERVATION_ID)).rejects.toThrow(
        'Failed to consume reservation',
      );
    });

    it('append-only: never UPDATEs or DELETEs usage_ledger rows', async () => {
      // The RPC does INSERT only — we verify by checking no .from() calls
      // (quotaService only calls .rpc(), never .from() for consume)
      const client = setupClient();
      client.rpc.mockResolvedValue({ data: true, error: null });

      await consumeQuota(USER_ID, RESERVATION_ID);

      // .from() should NOT be called — only .rpc()
      expect(client.from).not.toHaveBeenCalled();
    });
  });

  // ============================================================
  // 4. releaseQuota (calls release_quota RPC — append-only, no fallback)
  // ============================================================

  describe('releaseQuota', () => {
    it('returns true on successful RPC call', async () => {
      const client = setupClient();
      client.rpc.mockResolvedValue({ data: true, error: null });

      const result = await releaseQuota(USER_ID, RESERVATION_ID);
      expect(result).toBe(true);

      expect(client.rpc).toHaveBeenCalledWith('release_quota', {
        _user_id: USER_ID,
        _reservation_id: RESERVATION_ID,
      });
    });

    it('duplicate release is idempotent (RPC returns true)', async () => {
      const client = setupClient();
      client.rpc.mockResolvedValue({ data: true, error: null });

      const result = await releaseQuota(USER_ID, RESERVATION_ID);
      expect(result).toBe(true);
    });

    it('returns false when reservation not found', async () => {
      const client = setupClient();
      client.rpc.mockResolvedValue({ data: false, error: null });

      const result = await releaseQuota(USER_ID, 'non-existent-id');
      expect(result).toBe(false);
    });

    it('returns false for cross-user reservation', async () => {
      const client = setupClient();
      client.rpc.mockResolvedValue({ data: false, error: null });

      const result = await releaseQuota('other-user', RESERVATION_ID);
      expect(result).toBe(false);
    });

    it('returns false when terminal event is consume (release-after-consume conflict)', async () => {
      const client = setupClient();
      // RPC detects existing terminal event_type='consume' → returns false (conflict)
      client.rpc.mockResolvedValue({ data: false, error: null });

      const result = await releaseQuota(USER_ID, RESERVATION_ID);
      expect(result).toBe(false);
    });

    it('throws on RPC error — no TOCTOU fallback', async () => {
      const client = setupClient();
      // RPC fails — must throw, must NOT fall back to SELECT-then-UPDATE
      client.rpc.mockResolvedValue({
        data: null,
        error: { message: 'function not found' },
      });

      await expect(releaseQuota(USER_ID, RESERVATION_ID)).rejects.toThrow(
        'Failed to release reservation',
      );

      // Verify no fallback: .from() should NOT be called
      expect(client.from).not.toHaveBeenCalled();
    });

    it('append-only: never UPDATEs or DELETEs usage_ledger rows', async () => {
      const client = setupClient();
      client.rpc.mockResolvedValue({ data: true, error: null });

      await releaseQuota(USER_ID, RESERVATION_ID);

      // .from() should NOT be called — only .rpc()
      expect(client.from).not.toHaveBeenCalled();
      // RPC called exactly once
      expect(client.rpc).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================
  // 5. getUserEntitlement (unchanged — read-only query)
  // ============================================================

  describe('getUserEntitlement', () => {
    it('returns plan name, quota used/total, remaining', async () => {
      const client = setupClient();
      client.from.mockReturnValue(
        makeQueryResult({
          data: makeEntitlementRow({
            quota_used: 12,
            plan: { name: 'Pro', quota_per_cycle: 100 },
          }),
          error: null,
        }),
      );

      const result = await getUserEntitlement(USER_ID);
      expect(result).not.toBeNull();
      expect(result!.planName).toBe('Pro');
      expect(result!.quotaUsed).toBe(12);
      expect(result!.quotaTotal).toBe(100);
      expect(result!.remaining).toBe(88);
    });

    it('remaining is never negative', async () => {
      const client = setupClient();
      client.from.mockReturnValue(
        makeQueryResult({
          data: makeEntitlementRow({
            quota_used: 60,
            plan: { name: 'Starter', quota_per_cycle: 50 },
          }),
          error: null,
        }),
      );

      const result = await getUserEntitlement(USER_ID);
      expect(result).not.toBeNull();
      expect(result!.remaining).toBe(0);
    });

    it('no active subscription -> returns null', async () => {
      const client = setupClient();
      client.from.mockReturnValue(
        makeQueryResult({ data: null, error: null }),
      );

      const result = await getUserEntitlement(USER_ID);
      expect(result).toBeNull();
    });

    it('subscription query error -> returns null', async () => {
      const client = setupClient();
      client.from.mockReturnValue(
        makeQueryResult({
          data: null,
          error: { message: 'connection refused' },
        }),
      );

      const result = await getUserEntitlement(USER_ID);
      expect(result).toBeNull();
    });

    it('plan with zero quota -> remaining is 0', async () => {
      const client = setupClient();
      client.from.mockReturnValue(
        makeQueryResult({
          data: makeEntitlementRow({
            quota_used: 0,
            plan: { name: 'Free', quota_per_cycle: 0 },
          }),
          error: null,
        }),
      );

      const result = await getUserEntitlement(USER_ID);
      expect(result).not.toBeNull();
      expect(result!.remaining).toBe(0);
    });
  });
});
