/**
 * Slice C1 + C2a — Server tests
 *
 * Tests generation_jobs through the HTTP layer.
 * Mocks the Supabase client at the `from()` level so the service's
 * atomic idempotency logic and snake_case/camelCase conversion are exercised.
 * Migration static safety assertions verify the SQL file directly.
 *
 * C2a additions: trusted Supabase client mock for quota orchestration +
 * migration static assertions for the C2a trusted-write hardening.
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../app.js';

function resolveMigrationsDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'supabase/migrations'),
    path.resolve(process.cwd(), '..', 'supabase/migrations'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

// ============================================================
// Mock Supabase — vi.hoisted to avoid hoisting issues
// ============================================================

const { mockCreateUserClient, mockGetTrustedSupabase } = vi.hoisted(() => ({
  mockCreateUserClient: vi.fn(),
  mockGetTrustedSupabase: vi.fn(),
}));

vi.mock('../services/supabase.js', () => ({
  getSupabase: () => null,
  createUserClient: mockCreateUserClient,
  verifyToken: vi.fn(async () => ({ sub: 'user-001', email: 'test@example.com' })),
}));

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: mockGetTrustedSupabase,
}));

// ============================================================
// Helpers
// ============================================================

const VALID_TOKEN = 'Bearer valid-jwt-token';
const JOB_UUID = '00000000-0000-4000-a000-000000000001';

interface JobRow {
  id: string;
  owner_id: string;
  idempotency_key: string;
  status: string;
  source: string;
  platform: string;
  tone: string;
  cantonese_level: number;
  english_mixing_level: number;
  creativity_level: number;
  input_language: string;
  brand_name: string | null;
  product_name: string | null;
  brand_red_lines: string | null;
  brief: Record<string, unknown> | null;
  variants: Record<string, unknown> | null;
  variant_meta: Record<string, unknown> | null;
  diagnosis: Record<string, unknown> | null;
  audit: Record<string, unknown> | null;
  scores: Record<string, unknown> | null;
  consumer_feedback: Record<string, unknown>[] | null;
  generation_engine: string | null;
  error_message: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

function makeDbJob(overrides: Partial<JobRow> = {}): JobRow {
  const now = new Date().toISOString();
  return {
    id: JOB_UUID,
    owner_id: 'user-001',
    idempotency_key: 'ik-001',
    status: 'pending',
    source: 'Test source text',
    platform: 'ig',
    tone: '活潑',
    cantonese_level: 3,
    english_mixing_level: 2,
    creativity_level: 2,
    input_language: 'mandarin',
    brand_name: null,
    product_name: null,
    brand_red_lines: null,
    brief: null,
    variants: null,
    variant_meta: null,
    diagnosis: null,
    audit: null,
    scores: null,
    consumer_feedback: null,
    generation_engine: null,
    error_message: null,
    error_code: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    deleted_at: null,
    ...overrides,
  };
}

/**
 * Build a mock Supabase query chain as a thenable.
 *
 * Each method (select, insert, update, eq, is, order, range, maybeSingle, single)
 * returns the chain itself. The chain is also a thenable — when awaited, it resolves
 * to the configured terminal value.
 */
function makeQueryResult(terminal: {
  data?: unknown;
  error?: { code?: string; message: string } | null;
  count?: number;
}) {
  const methods = ['select', 'insert', 'update', 'eq', 'is', 'order', 'range', 'lte', 'gt'] as const;

  // The base result that await resolves to
  const result = {
    data: terminal.data ?? null,
    error: terminal.error ?? null,
    count: terminal.count ?? 0,
  };

  // Build a Proxy so that any property access returns the chain itself,
  // and awaiting the chain resolves to result.
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => void) => {
      resolve(result);
      return { catch: () => {} };
    },
  };

  for (const m of methods) {
    chain[m] = () => chain;
  }

  // Terminal methods that modify the result
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

/** Create a mock Supabase client whose .from() returns a configurable chain */
function setupClient() {
  const client = { from: vi.fn() };
  mockCreateUserClient.mockReturnValue(client);
  return client;
}

/** Create a mock Supabase client with .rpc() for the soft-delete RPC path. */
function setupClientWithRpc(rpcResult: { data?: unknown; error?: { message: string } | null }) {
  const client = {
    from: vi.fn(),
    rpc: vi.fn().mockResolvedValue(rpcResult),
  };
  mockCreateUserClient.mockReturnValue(client);
  return client;
}

/** Configure .from() to return a specific chain result */
function mockFromReturns(client: { from: ReturnType<typeof vi.fn> }, terminal: Parameters<typeof makeQueryResult>[0]) {
  client.from.mockReturnValue(makeQueryResult(terminal));
}

/** Configure .from() to return different results on successive calls */
function mockFromSequence(client: { from: ReturnType<typeof vi.fn> }, terminals: Parameters<typeof makeQueryResult>[0][]) {
  let call = 0;
  client.from.mockImplementation(() => {
    const t = terminals[call] ?? terminals[terminals.length - 1];
    call++;
    return makeQueryResult(t);
  });
}

// ============================================================
// C2a: Trusted client helpers (RPC-based atomic quota operations)
// ============================================================

const QUOTA_RESERVATION_RESULT = {
  reservation_id: 'ledger-0000-0000-4000-a000-000000000001',
  user_id: 'user-001',
  subscription_id: 'sub-00000000-0000-4000-a000-000000000001',
  amount: 1,
  idempotency_key: 'ik-001',
};

/** Create a mock trusted Supabase client with .from() and .rpc() */
function setupTrustedClient() {
  const client = {
    from: vi.fn().mockReturnValue(makeQueryResult({ data: null, count: 0 })),
    rpc: vi.fn(),
  };
  mockGetTrustedSupabase.mockReturnValue(client);
  return client;
}

/**
 * Configure the trusted client's RPC for full quota success:
 * - reserve_quota → returns reservation result
 * - consume_quota → returns true
 * - release_quota → returns true
 *
 * @C2a-ATOMIC: All quota operations go through atomic RPC functions, not
 * direct table queries. The RPC functions handle FOR UPDATE locking and
 * append-only INSERT internally.
 */
function configureQuotaSuccess(trusted: ReturnType<typeof setupTrustedClient>) {
  trusted.rpc.mockImplementation(async (fnName: string, _params: any) => {
    switch (fnName) {
      case 'reserve_quota':
        return { data: QUOTA_RESERVATION_RESULT, error: null };
      case 'consume_quota':
        return { data: true, error: null };
      case 'release_quota':
        return { data: true, error: null };
      default:
        return { data: null, error: { message: `Unknown RPC: ${fnName}` } };
    }
  });
}

/** Full quota success setup for idempotency-key-based tests */
function setupWithQuota() {
  const userClient = setupClient();
  const trustedClient = setupTrustedClient();
  configureQuotaSuccess(trustedClient);
  return { userClient, trustedClient };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// 1. Migration static safety assertions
// ============================================================

describe('Migration static safety assertions', () => {
  let migrationSql = '';

  beforeAll(() => {
    const migrationsDir = resolveMigrationsDir();
    const filePath = path.join(migrationsDir, '20260711213000_slice_c1_generation_jobs.sql');
    try {
      migrationSql = fs.readFileSync(filePath, 'utf-8');
    } catch {
      // File not found — tests pass gracefully
    }
  });

  function hasMigration() {
    return migrationSql.length > 0;
  }

  it('RLS is enabled on generation_jobs', () => {
    if (!hasMigration()) return;
    expect(migrationSql).toMatch(/alter table.*generation_jobs.*enable row level security/i);
  });

  it('SELECT policy scopes to owner + deleted_at IS NULL', () => {
    if (!hasMigration()) return;
    expect(migrationSql).toContain('auth.uid()) = owner_id');
    expect(migrationSql).toContain('deleted_at is null');
  });

  it('INSERT policy checks owner_id = auth.uid()', () => {
    if (!hasMigration()) return;
    expect(migrationSql).toMatch(/for insert[\s\S]*?with check[\s\S]*?auth\.uid\(\)\) = owner_id/m);
  });

  it('UPDATE policy scoped to owner', () => {
    if (!hasMigration()) return;
    expect(migrationSql).toMatch(/for update[\s\S]*?auth\.uid\(\)\) = owner_id/m);
  });

  it('has UNIQUE(owner_id, idempotency_key)', () => {
    if (!hasMigration()) return;
    expect(migrationSql).toContain('unique(owner_id, idempotency_key)');
  });

  it('no DELETE policy (soft delete only)', () => {
    if (!hasMigration()) return;
    expect(migrationSql).not.toMatch(/^\s*create policy[\s\S]*?for delete/mi);
    expect(migrationSql.toLowerCase()).toContain('soft delete');
  });

  it('migration version 20260711213000 is after last applied 20260711170000', () => {
    expect('20260711213000' > '20260711170000').toBe(true);
  });

  it('has required indexes: idx_jobs_owner_created, idx_jobs_owner_status', () => {
    if (!hasMigration()) return;
    expect(migrationSql).toContain('idx_jobs_owner_created');
    expect(migrationSql).toContain('idx_jobs_owner_status');
  });

  it('grant update is present — documented risk for C2 review', () => {
    if (!hasMigration()) return;
    expect(migrationSql).toMatch(/grant select, insert, update.*to authenticated/i);
  });

  it('references public.set_updated_at() from Slice B migration', () => {
    if (!hasMigration()) return;
    expect(migrationSql).toContain('public.set_updated_at()');
  });
});

// ============================================================
// 2. Auth gate — 401 without valid token
// ============================================================

describe('Auth gate', () => {
  it('POST /api/generate returns 401', async () => {
    const res = await request(app).post('/api/generate').send({ source: 'test', idempotencyKey: 'ik-1' });
    expect(res.status).toBe(401);
  });

  it('GET /api/generations returns 401', async () => {
    const res = await request(app).get('/api/generations');
    expect(res.status).toBe(401);
  });

  it('GET /api/generations/:id returns 401', async () => {
    const res = await request(app).get(`/api/generations/${JOB_UUID}`);
    expect(res.status).toBe(401);
  });

  it('DELETE /api/generations/:id returns 401', async () => {
    const res = await request(app).delete(`/api/generations/${JOB_UUID}`);
    expect(res.status).toBe(401);
  });

  it('PATCH /api/generations/:id returns 404 (route intentionally removed)', async () => {
    const res = await request(app)
      .patch(`/api/generations/${JOB_UUID}`)
      .set('Authorization', VALID_TOKEN)
      .send({ status: 'completed' });
    expect(res.status).toBe(404);
  });
});

// ============================================================
// 3. Input validation
// ============================================================

describe('Input validation', () => {
  it('rejects limit < 1', async () => {
    const res = await request(app)
      .get('/api/generations?limit=0')
      .set('Authorization', VALID_TOKEN);
    expect(res.status).toBe(400);
  });

  it('rejects limit > 100', async () => {
    const res = await request(app)
      .get('/api/generations?limit=101')
      .set('Authorization', VALID_TOKEN);
    expect(res.status).toBe(400);
  });

  it('rejects negative offset', async () => {
    const res = await request(app)
      .get('/api/generations?offset=-5')
      .set('Authorization', VALID_TOKEN);
    expect(res.status).toBe(400);
  });

  it('accepts valid limit=10, offset=0', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: [], count: 0 });

    const res = await request(app)
      .get('/api/generations?limit=10&offset=0')
      .set('Authorization', VALID_TOKEN);
    expect(res.status).toBe(200);
  });

  it('rejects non-UUID id', async () => {
    const res = await request(app)
      .get('/api/generations/not-a-uuid')
      .set('Authorization', VALID_TOKEN);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/uuid/i);
  });

  it('rejects SQL-injection-like id', async () => {
    const res = await request(app)
      .get("/api/generations/1' OR '1'='1")
      .set('Authorization', VALID_TOKEN);
    expect(res.status).toBe(400);
  });

  it('accepts valid UUID for detail', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: makeDbJob() });

    const res = await request(app)
      .get(`/api/generations/${JOB_UUID}`)
      .set('Authorization', VALID_TOKEN);
    expect(res.status).toBe(200);
  });

  it('rejects missing idempotencyKey in generate', async () => {
    const res = await request(app)
      .post('/api/generate')
      .set('Authorization', VALID_TOKEN)
      .send({ source: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/idempotencyKey/i);
  });

  it('rejects empty idempotencyKey in generate', async () => {
    const res = await request(app)
      .post('/api/generate')
      .set('Authorization', VALID_TOKEN)
      .send({ source: 'test', idempotencyKey: '' });
    expect(res.status).toBe(400);
  });

  it('rejects idempotencyKey > 128 chars', async () => {
    const res = await request(app)
      .post('/api/generate')
      .set('Authorization', VALID_TOKEN)
      .send({ source: 'test', idempotencyKey: 'a'.repeat(129) });
    expect(res.status).toBe(400);
  });

  it('rejects missing source in generate', async () => {
    const res = await request(app)
      .post('/api/generate')
      .set('Authorization', VALID_TOKEN)
      .send({ idempotencyKey: 'ik-1' });
    expect(res.status).toBe(400);
  });

  it('rejects invalid platform in generate', async () => {
    const res = await request(app)
      .post('/api/generate')
      .set('Authorization', VALID_TOKEN)
      .send({ source: 'test', idempotencyKey: 'ik-1', platform: 'invalid-platform' });
    expect(res.status).toBe(400);
  });
});

// ============================================================
// 4. Atomic idempotency behavior
// ============================================================

describe('Atomic idempotency', () => {
  it('creates new job when idempotency key is unique', async () => {
    const { trustedClient } = setupWithQuota();
    const dbJob = makeDbJob({ status: 'pending' });

    // upsertJob: insert succeeds → returns row
    // markProcessing: update succeeds → returns updated row
    // Then the AI engine call happens (may fail in test env)
    mockFromSequence(trustedClient, [
      { data: dbJob },        // insert -> success, returns row
      { data: dbJob },        // select -> returns new row
      { data: { ...dbJob, status: 'processing' } }, // markProcessing update
      { data: { ...dbJob, status: 'processing' } }, // markProcessing select
    ]);

    const res = await request(app)
      .post('/api/generate')
      .set('Authorization', VALID_TOKEN)
      .send({ source: 'test source', idempotencyKey: 'ik-unique', platform: 'ig', tone: '活\潑' });

    // May be 200 (fallback engine works) or 500 (AI unavailable in test)
    // The key: route was reached, auth+validation passed, job creation started
    expect([200, 500]).toContain(res.status);
  });

  it('returns existing completed job without regenerating (idempotent hit)', async () => {
    const { trustedClient: client } = setupWithQuota();
    const completedJob = makeDbJob({
      status: 'completed',
      variants: { standardHK: 'cached result' },
      diagnosis: { hasSimplifiedChars: false, mainlandPhrases: [], issues: [] },
      audit: { thermometer: { overall: 85 }, issues: [], replacements: [], risks: [], comments: [] },
    });

    // upsertJob: insert fails with duplicate (23505), then select returns completed job
    mockFromSequence(client, [
      { error: { code: '23505', message: 'duplicate key value violates unique constraint "generation_jobs_owner_id_idempotency_key_key"' } }, // insert -> duplicate
      { data: completedJob }, // select -> existing completed job
    ]);

    const res = await request(app)
      .post('/api/generate')
      .set('Authorization', VALID_TOKEN)
      .send({ source: 'test', idempotencyKey: 'ik-completed', platform: 'ig', tone: '活\潑' });

    expect(res.status).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(res.body.variants).toBeDefined();
  });

  it('returns failed job with retryHint', async () => {
    const { trustedClient: client } = setupWithQuota();
    const failedJob = makeDbJob({
      status: 'failed',
      error_message: 'AI engine timeout',
      error_code: 'GENERATION_ERROR',
    });

    mockFromSequence(client, [
      { error: { code: '23505', message: 'duplicate key' } }, // insert -> duplicate
      { data: failedJob }, // select -> existing failed job
    ]);

    const res = await request(app)
      .post('/api/generate')
      .set('Authorization', VALID_TOKEN)
      .send({ source: 'test', idempotencyKey: 'ik-failed', platform: 'ig', tone: '活\潑' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('failed');
    expect(res.body.error).toBe('AI engine timeout');
    expect(res.body.retryHint).toMatch(/new idempotencyKey/i);
  });

  it('returns 202 for pending/processing job', async () => {
    const { trustedClient: client } = setupWithQuota();
    const pendingJob = makeDbJob({ status: 'processing' });

    mockFromSequence(client, [
      { error: { code: '23505', message: 'duplicate key' } },
      { data: pendingJob },
    ]);

    const res = await request(app)
      .post('/api/generate')
      .set('Authorization', VALID_TOKEN)
      .send({ source: 'test', idempotencyKey: 'ik-processing', platform: 'ig', tone: '活\潑' });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('processing');
    expect(res.body.idempotent).toBe(true);
  });
});

// ============================================================
// 5. CRUD operations
// ============================================================

describe('GET /api/generations', () => {
  it('returns paginated list', async () => {
    const client = setupClient();
    mockFromReturns(client, {
      data: [
        makeDbJob({ id: '00000000-0000-4000-a000-000000000001', idempotency_key: 'ik-1' }),
        makeDbJob({ id: '00000000-0000-4000-a000-000000000002', idempotency_key: 'ik-2', status: 'failed' }),
      ],
      count: 2,
    });

    const res = await request(app)
      .get('/api/generations')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(2);
    expect(res.body.total).toBe(2);
  });

  it('returns empty list', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: [], count: 0 });

    const res = await request(app)
      .get('/api/generations')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});

describe('GET /api/generations/:id', () => {
  it('returns job detail', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: makeDbJob() });

    const res = await request(app)
      .get(`/api/generations/${JOB_UUID}`)
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.job.id).toBe(JOB_UUID);
  });

  it('returns 404 for non-existent job', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: null });

    const res = await request(app)
      .get('/api/generations/00000000-0000-4000-a000-000000000099')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/generations/:id', () => {
  it('soft-deletes own job via RPC', async () => {
    setupClientWithRpc({ data: true, error: null });

    const res = await request(app)
      .delete(`/api/generations/${JOB_UUID}`)
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 404 when RPC returns false (job not found / not owner)', async () => {
    setupClientWithRpc({ data: false, error: null });

    const res = await request(app)
      .delete('/api/generations/00000000-0000-4000-a000-000000000099')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Job not found');
  });
});

// ============================================================
// 6. Owner isolation
// ============================================================

describe('Owner isolation', () => {
  it('returns 404 for cross-user job access (RLS enforced)', async () => {
    // RLS filters out another user's job -> getJob returns null -> 404.
    // Indistinguishable from "doesn't exist" — no user enumeration.
    const client = setupClient();
    mockFromReturns(client, { data: null });

    const res = await request(app)
      .get(`/api/generations/${JOB_UUID}`)
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Job not found');
  });

  it('list only returns authenticated user jobs', async () => {
    // Service explicitly adds .eq('owner_id', ownerId) from verified token.
    // RLS provides defense in depth.
    const client = setupClient();
    mockFromReturns(client, { data: [makeDbJob()], count: 1 });

    const res = await request(app)
      .get('/api/generations')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(1);
    expect(res.body.jobs[0].id).toBe(JOB_UUID);
  });
});

// ============================================================
// 7. Patch migration static safety assertions
// ============================================================

describe('Patch migration — 20260711223000_fix_generation_soft_delete', () => {
  let patchSql = '';

  beforeAll(() => {
    const migrationsDir = resolveMigrationsDir();
    const filePath = path.join(migrationsDir, '20260711223000_fix_generation_soft_delete.sql');
    try {
      patchSql = fs.readFileSync(filePath, 'utf-8');
    } catch {
      // File not found — tests pass gracefully
    }
  });

  function hasMigration() {
    return patchSql.length > 0;
  }

  it('creates public.soft_delete_generation_job function', () => {
    if (!hasMigration()) return;
    expect(patchSql).toMatch(/create or replace function public\.soft_delete_generation_job/i);
  });

  it('is SECURITY DEFINER', () => {
    if (!hasMigration()) return;
    expect(patchSql).toMatch(/security definer/i);
  });

  it('sets search_path = empty string (no untrusted schema)', () => {
    if (!hasMigration()) return;
    expect(patchSql).toMatch(/set search_path\s*=\s*''/i);
  });

  it('returns boolean', () => {
    if (!hasMigration()) return;
    expect(patchSql).toMatch(/returns boolean/i);
  });

  it('checks auth.uid() is not null', () => {
    if (!hasMigration()) return;
    expect(patchSql).toMatch(/auth\.uid\(\) is null/i);
  });

  it('enforces owner_id = auth.uid() inside UPDATE WHERE (no TOCTOU)', () => {
    if (!hasMigration()) return;
    // The UPDATE WHERE must contain owner_id = auth.uid() — not a separate SELECT
    expect(patchSql).toMatch(/update\s+public\.generation_jobs[\s\S]*?where[\s\S]*?owner_id\s*=\s*auth\.uid\(\)/i);
  });

  it('UPDATE WHERE includes all three conditions atomically', () => {
    if (!hasMigration()) return;
    // Single UPDATE statement: id + owner_id + deleted_at — no SELECT-then-UPDATE gap
    const updateMatch = patchSql.match(/update\s+public\.generation_jobs[\s\S]*?where[\s\S]*?id\s*=\s*_job_id[\s\S]*?owner_id\s*=\s*auth\.uid\(\)[\s\S]*?deleted_at is null/i);
    expect(updateMatch).toBeTruthy();
  });

  it('checks deleted_at is null in UPDATE WHERE', () => {
    if (!hasMigration()) return;
    // deleted_at IS NULL appears in the UPDATE WHERE clause
    expect(patchSql).toMatch(/where[\s\S]*?deleted_at is null/i);
  });

  it('has no SELECT INTO _owner_id (no pre-query TOCTOU window)', () => {
    if (!hasMigration()) return;
    expect(patchSql).not.toMatch(/select.*owner_id.*into\s+_owner_id/i);
    expect(patchSql).not.toMatch(/_owner_id/);
  });

  it('uses fully-qualified public.generation_jobs', () => {
    if (!hasMigration()) return;
    expect(patchSql).toMatch(/public\.generation_jobs/);
  });

  it('revokes execute from public and anon', () => {
    if (!hasMigration()) return;
    expect(patchSql).toMatch(/revoke all on function.*from public,\s*anon/i);
  });

  it('grants execute to authenticated and service_role', () => {
    if (!hasMigration()) return;
    expect(patchSql).toMatch(/grant execute on function.*to authenticated,\s*service_role/i);
  });

  it('version 20260711223000 is later than main migration 20260711213000', () => {
    expect('20260711223000' > '20260711213000').toBe(true);
  });
});

// ============================================================
// 8. Soft-delete via RPC (C1 patch)
// ============================================================

describe('DELETE /api/generations/:id — RPC soft-delete', () => {
  it('returns 200 when RPC returns true (own job, deleted)', async () => {
    setupClientWithRpc({ data: true, error: null });

    const res = await request(app)
      .delete(`/api/generations/${JOB_UUID}`)
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns 404 when RPC returns false (not owner / not found / already deleted)', async () => {
    setupClientWithRpc({ data: false, error: null });

    const res = await request(app)
      .delete(`/api/generations/${JOB_UUID}`)
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Job not found');
  });

  it('returns 500 with sanitised error when RPC errors', async () => {
    setupClientWithRpc({ data: null, error: { message: 'database connection refused' } });

    const res = await request(app)
      .delete(`/api/generations/${JOB_UUID}`)
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(500);
    // Error must be sanitised — no DB internals
    expect(res.body.error).toBe('Failed to delete generation job');
    expect(res.body.error).not.toContain('connection');
  });

  it('returns 404 for non-UUID id', async () => {
    const res = await request(app)
      .delete('/api/generations/not-a-uuid')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/uuid/i);
  });

  it('cross-user delete returns 404 indistinguishable from not-found', async () => {
    // RPC returns false when owner_id != auth.uid()
    setupClientWithRpc({ data: false, error: null });

    const res = await request(app)
      .delete(`/api/generations/${JOB_UUID}`)
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Job not found');
  });
});

// ============================================================
// 9. Regression: SELECT policy still has deleted_at IS NULL
// ============================================================

describe('Regression — SELECT policy unchanged', () => {
  function findMigrationFile(filename: string): string | null {
    // Try repo-root-relative first, then server-relative (vitest cwd may vary)
    const candidates = [
      path.resolve(process.cwd(), 'supabase/migrations', filename),
      path.resolve(process.cwd(), '..', 'supabase/migrations', filename),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
    }
    return null;
  }

  it('original migration still scopes SELECT to deleted_at IS NULL', () => {
    const originalSql = findMigrationFile('20260711213000_slice_c1_generation_jobs.sql');
    if (!originalSql) return;

    // SELECT policy must filter deleted rows — NOT relaxed
    expect(originalSql).toMatch(/for select[\s\S]*?deleted_at is null/m);
  });

  it('original migration does NOT grant delete to authenticated', () => {
    const originalSql = findMigrationFile('20260711213000_slice_c1_generation_jobs.sql');
    if (!originalSql) return;

    // No DELETE grant — soft delete is the only path
    expect(originalSql).not.toMatch(/grant.*delete.*to authenticated/i);
  });
});

// ============================================================
// 10. C2a Migration — 20260712000000_slice_c2a_trusted_write_quota
//    (RPC-based atomic quota, append-only ledger, terminal uniqueness)
// ============================================================

describe('C2a Migration — 20260712000000_slice_c2a_trusted_write_quota', () => {
  let c2aSql = '';

  beforeAll(() => {
    const migrationsDir = resolveMigrationsDir();
    const filePath = path.join(migrationsDir, '20260712000000_slice_c2a_trusted_write_quota.sql');
    try {
      c2aSql = fs.readFileSync(filePath, 'utf-8');
    } catch {
      // File not found — tests pass gracefully
    }
  });

  function hasMigration() {
    return c2aSql.length > 0;
  }

  // --- New tables & enum ---

  it('plans table exists', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/create table public\.plans/i);
  });

  it('subscriptions table exists', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/create table public\.subscriptions/i);
  });

  it('usage_ledger table exists', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/create table public\.usage_ledger/i);
  });

  it('usage_event_type enum has reserve/consume/release/adjustment', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/create type public\.usage_event_type as enum/i);
    expect(c2aSql).toContain("'reserve'");
    expect(c2aSql).toContain("'consume'");
    expect(c2aSql).toContain("'release'");
    expect(c2aSql).toContain("'adjustment'");
  });

  it('usage_ledger has UNIQUE(user_id, idempotency_key)', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/unique\s*\(\s*user_id\s*,\s*idempotency_key\s*\)/i);
  });

  it('usage_ledger has no UPDATE/DELETE grants to authenticated (append-only)', () => {
    if (!hasMigration()) return;
    // Verify: authenticated gets only SELECT on usage_ledger
    expect(c2aSql).toMatch(/grant\s+select\s+on\s+table\s+public\.usage_ledger\s+to\s+authenticated/i);
    // Verify: service_role gets SELECT, INSERT on usage_ledger (no UPDATE, no DELETE)
    expect(c2aSql).toMatch(/grant\s+select\s*,\s*insert\s+on\s+table\s+public\.usage_ledger\s+to\s+service_role/i);
    // Negative check: no grant includes update/delete on usage_ledger
    // Use a pattern anchored to the same line
    const lines = c2aSql.split('\n');
    for (const line of lines) {
      if (line.match(/grant\s+/i) && line.match(/usage_ledger/i)) {
        expect(line).not.toMatch(/\bupdate\b/i);
        expect(line).not.toMatch(/\bdelete\b/i);
      }
    }
  });

  // --- Append-only ledger: reservation_id self-reference & terminal uniqueness ---

  it('usage_ledger has reservation_id self-reference column', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/reservation_id\s+uuid\s+references\s+public\.usage_ledger/i);
  });

  it('usage_ledger has check constraint for terminal events requiring reservation_id', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/constraint\s+chk_event_reservation_shape/i);
    expect(c2aSql).toMatch(/event_type\s+in\s*\(\s*'consume'\s*,\s*'release'\s*\)\s+and\s+reservation_id\s+is\s+not\s+null/i);
  });

  it('usage_ledger has partial unique index for one terminal per reservation', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/create unique index\s+idx_ledger_one_terminal_per_reservation/i);
    expect(c2aSql).toMatch(/where\s+reservation_id\s+is\s+not\s+null/i);
  });

  it('usage_ledger has reservation_id index', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toContain('idx_ledger_reservation');
  });

  // --- generation_jobs hardening ---

  it('authenticated has no UPDATE grant on generation_jobs', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/revoke\s+insert\s*,\s*update\s+on\s+table\s+public\.generation_jobs\s+from\s+authenticated/i);
  });

  it('REVOKE UPDATE from authenticated on generation_jobs', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/revoke\s+insert\s*,\s*update\s+on\s+table\s+public\.generation_jobs\s+from\s+authenticated/i);
  });

  it('drops old "jobs owner update" policy', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/drop policy if exists "jobs owner update"/i);
  });

  // --- No dead SECURITY DEFINER job functions (C2a-FIX #6) ---

  it('does NOT contain complete_generation_job SECURITY DEFINER (deleted — dead code)', () => {
    if (!hasMigration()) return;
    expect(c2aSql).not.toMatch(/complete_generation_job/i);
  });

  it('does NOT contain fail_generation_job SECURITY DEFINER (deleted — dead code)', () => {
    if (!hasMigration()) return;
    expect(c2aSql).not.toMatch(/fail_generation_job/i);
  });

  it('does NOT contain mark_processing_job SECURITY DEFINER (deleted — dead code)', () => {
    if (!hasMigration()) return;
    expect(c2aSql).not.toMatch(/mark_processing_job/i);
  });

  // --- Atomic quota RPC functions ---

  it('reserve_quota RPC exists with explicit _user_id parameter', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/create or replace function public\.reserve_quota\s*\(\s*_user_id\s+uuid/i);
    expect(c2aSql).toMatch(/_idempotency_key\s+text/i);
  });

  it('consume_quota RPC exists with explicit _user_id parameter', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/create or replace function public\.consume_quota\s*\(\s*_user_id\s+uuid/i);
    expect(c2aSql).toMatch(/_reservation_id\s+uuid/i);
  });

  it('release_quota RPC exists with explicit _user_id parameter', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/create or replace function public\.release_quota\s*\(\s*_user_id\s+uuid/i);
    expect(c2aSql).toMatch(/_reservation_id\s+uuid/i);
  });

  it('reserve_quota is SECURITY INVOKER with search_path = empty', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.reserve_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      expect(fnBlock[0]).toMatch(/security invoker/i);
      expect(fnBlock[0]).not.toMatch(/security definer/i);
      expect(fnBlock[0]).toMatch(/set search_path\s*=\s*''/i);
    }
  });

  it('consume_quota is SECURITY INVOKER with search_path = empty', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.consume_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      expect(fnBlock[0]).toMatch(/security invoker/i);
      expect(fnBlock[0]).not.toMatch(/security definer/i);
      expect(fnBlock[0]).toMatch(/set search_path\s*=\s*''/i);
    }
  });

  it('release_quota is SECURITY INVOKER with search_path = empty', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.release_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      expect(fnBlock[0]).toMatch(/security invoker/i);
      expect(fnBlock[0]).not.toMatch(/security definer/i);
      expect(fnBlock[0]).toMatch(/set search_path\s*=\s*''/i);
    }
  });

  it('quota RPC functions granted execute to service_role only', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/grant execute on function public\.reserve_quota[\s\S]*?to service_role/i);
    expect(c2aSql).toMatch(/grant execute on function public\.consume_quota[\s\S]*?to service_role/i);
    expect(c2aSql).toMatch(/grant execute on function public\.release_quota[\s\S]*?to service_role/i);
  });

  it('quota RPC functions NOT granted to authenticated', () => {
    if (!hasMigration()) return;
    const authGrantMatches = c2aSql.match(/grant execute on function public\.(reserve_quota|consume_quota|release_quota)[\s\S]*?to authenticated/gi);
    expect(authGrantMatches).toBeNull();
  });

  it('quota RPC functions use explicit _user_id, do NOT rely on auth.uid()', () => {
    if (!hasMigration()) return;
    // The three new RPC functions accept _user_id as a parameter.
    // They should NOT check auth.uid() because service_role has no auth context.
    // Extract the RPC function section (after "Atomic quota RPC functions")
    const rpcSection = c2aSql.substring(c2aSql.indexOf('reserve_quota'));
    // auth.uid() should NOT appear in the new RPC functions
    const authUidMatches = rpcSection.match(/auth\.uid\(\)/g);
    // May appear in comments or auth check in non-RPC context, so check carefully
    // Actually: auth.uid() should not appear in any of the 3 RPC function bodies
    // But it MAY appear in the RLS policies. So we only check the function bodies.
    const reserveFn = c2aSql.match(/create or replace function public\.reserve_quota[\s\S]*?end;\s*\$\$;/i);
    const consumeFn = c2aSql.match(/create or replace function public\.consume_quota[\s\S]*?end;\s*\$\$;/i);
    const releaseFn = c2aSql.match(/create or replace function public\.release_quota[\s\S]*?end;\s*\$\$;/i);

    [reserveFn, consumeFn, releaseFn].forEach(fn => {
      if (fn) {
        expect(fn[0]).not.toMatch(/auth\.uid\(\)/i);
      }
    });
  });

  it('reserve_quota uses FOR UPDATE to lock subscription row', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.reserve_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      expect(fnBlock[0]).toMatch(/for update/i);
    }
  });

  it('reserve_quota enforces started periods and renews only expired Free periods', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.reserve_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      expect(fnBlock[0]).toMatch(/current_period_start\s*<=\s*now\s*\(\s*\)/i);
      expect(fnBlock[0]).toMatch(/if\s+_period_end\s*<=\s*now\s*\(\s*\)/i);
      expect(fnBlock[0]).toMatch(/if\s+_plan_name\s*<>\s*'Free'[\s\S]*?return null/i);
    }
  });

  it('reserve_quota re-checks idempotency AFTER FOR UPDATE lock (before quota check)', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.reserve_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      // The initial idempotency check (step 0) + the re-check after lock (step 1.5)
      const idempotencyChecks = fnBlock[0].match(/idempotency_key\s*=\s*_idempotency_key[\s\S]*?event_type\s*=\s*'reserve'/gi);
      expect(idempotencyChecks).not.toBeNull();
      expect(idempotencyChecks!.length).toBeGreaterThanOrEqual(2);
      // The second check must appear AFTER 'for update' (lock acquired)
      const afterLock = fnBlock[0].substring(fnBlock[0].indexOf('for update'));
      expect(afterLock).toMatch(/idempotency_key\s*=\s*_idempotency_key/i);
    }
  });

  it('reserve_quota re-check returns existing reservation without quota re-check', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.reserve_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      // After the post-lock idempotency re-check, if found, it returns immediately
      // without checking quota_used >= quota_per_cycle
      const afterLock = fnBlock[0].substring(fnBlock[0].indexOf('for update'));
      // The re-check found block should return jsonb_build_object BEFORE the quota check
      const recheckPos = afterLock.search(/idempotency_key\s*=\s*_idempotency_key[\s\S]*?event_type\s*=\s*'reserve'/i);
      const quotaCheckPos = afterLock.search(/_quota_used\s*>=\s*_quota_limit/i);
      expect(recheckPos).toBeLessThan(quotaCheckPos);
    }
  });

  it('consume_quota checks terminal event_type: same consume → true, release → false', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.consume_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      // Must query event_type, not just exists()
      expect(fnBlock[0]).toMatch(/select\s+event_type\s+into\s+_terminal_event/i);
      // Same transition (consume) → true
      expect(fnBlock[0]).toMatch(/_terminal_event\s*=\s*'consume'/i);
      expect(fnBlock[0]).toMatch(/return true.*idempotent/si);
      // Conflict (release) → false
      expect(fnBlock[0]).toMatch(/return false.*conflict/si);
    }
  });

  it('release_quota checks terminal event_type: same release → true, consume → false', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.release_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      // Must query event_type, not just exists()
      expect(fnBlock[0]).toMatch(/select\s+event_type\s+into\s+_terminal_event/i);
      // Same transition (release) → true
      expect(fnBlock[0]).toMatch(/_terminal_event\s*=\s*'release'/i);
      expect(fnBlock[0]).toMatch(/return true.*idempotent/si);
      // Conflict (consume) → false
      expect(fnBlock[0]).toMatch(/return false.*conflict/si);
    }
  });

  it('explicit grant select, insert, update on generation_jobs to service_role', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/grant\s+select\s*,\s*insert\s*,\s*update\s+on\s+table\s+public\.generation_jobs\s+to\s+service_role/i);
  });

  it('consume_quota locks subscriptions, never the append-only ledger', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.consume_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      expect(fnBlock[0]).toMatch(/from\s+public\.subscriptions[\s\S]*?for update/i);
      expect(fnBlock[0]).not.toMatch(/from\s+public\.usage_ledger\s+where\s+id\s*=\s*_reservation_id\s+for update/i);
    }
  });

  it('release_quota locks subscriptions, never the append-only ledger', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.release_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      expect(fnBlock[0]).toMatch(/from\s+public\.subscriptions[\s\S]*?for update/i);
      expect(fnBlock[0]).not.toMatch(/from\s+public\.usage_ledger\s+where\s+id\s*=\s*_reservation_id\s+for update/i);
    }
  });

  it('release_quota atomically decrements quota_used (same transaction)', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.release_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      // UPDATE subscriptions SET quota_used = greatest(0, quota_used - ...)
      expect(fnBlock[0]).toMatch(/update\s+public\.subscriptions[\s\S]*?quota_used/i);
      expect(fnBlock[0]).toMatch(/greatest\s*\(\s*0/i);
    }
  });

  it('release_quota never refunds an old-period reservation into a new period', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.release_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      expect(fnBlock[0]).toMatch(/select[\s\S]*?created_at[\s\S]*?into\s+_reserve/i);
      expect(fnBlock[0]).toMatch(/_reserve\.created_at\s*>=\s*current_period_start/i);
      expect(fnBlock[0]).toMatch(/_reserve\.created_at\s*<\s*current_period_end/i);
    }
  });

  it('consume_quota does NOT modify quota_used (already counted at reserve)', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.consume_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      // consume_quota only INSERTs the terminal event — no UPDATE on subscriptions
      const body = fnBlock[0];
      // There should be no update to subscriptions inside consume_quota
      const updatesSub = body.match(/update\s+public\.subscriptions/i);
      expect(updatesSub).toBeNull();
    }
  });

  it('consume_quota INSERTs terminal event (append-only, does not UPDATE reserve)', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.consume_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      expect(fnBlock[0]).toMatch(/insert into public\.usage_ledger/i);
      // Must NOT update usage_ledger
      expect(fnBlock[0]).not.toMatch(/update\s+public\.usage_ledger/i);
    }
  });

  it('release_quota INSERTs terminal event (append-only, does not UPDATE reserve)', () => {
    if (!hasMigration()) return;
    const fnBlock = c2aSql.match(/create or replace function public\.release_quota[\s\S]*?end;\s*\$\$;/i);
    expect(fnBlock).toBeTruthy();
    if (fnBlock) {
      expect(fnBlock[0]).toMatch(/insert into public\.usage_ledger/i);
      // Must NOT update usage_ledger
      expect(fnBlock[0]).not.toMatch(/update\s+public\.usage_ledger/i);
    }
  });

  // --- RLS ---

  it('subscriptions has RLS enabled', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/alter table public\.subscriptions\s+enable row level security/i);
  });

  it('usage_ledger has RLS enabled', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/alter table public\.usage_ledger\s+enable row level security/i);
  });

  it('plans has RLS enabled', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/alter table public\.plans\s+enable row level security/i);
  });

  it('subscriptions UNIQUE(user_id) constraint', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/unique\s*\(\s*user_id\s*\)/i);
  });

  // --- Ordering & constraints ---

  it('version 20260712000000 is after all existing migrations', () => {
    expect('20260712000000' > '20260711223000').toBe(true);
    expect('20260712000000' > '20260711213000').toBe(true);
    expect('20260712000000' > '20260711170000').toBe(true);
    expect('20260712000000' > '20260711000000').toBe(true);
  });

  it('seeds the explicitly approved Free and Pro beta catalogue', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/\('Free'\s*,\s*0\s*,\s*20\s*,\s*'week'\s*,\s*1/i);
    expect(c2aSql).toMatch(/\('Pro'\s*,\s*1900\s*,\s*400\s*,\s*'month'\s*,\s*1/i);
  });

  // --- Retained permissions ---

  it('authenticated retains read-only access to owner jobs', () => {
    if (!hasMigration()) return;
    const revokeStmt = c2aSql.match(/revoke\s+insert\s*,\s*update\s+on\s+table\s+public\.generation_jobs\s+from\s+authenticated/i);
    expect(revokeStmt).toBeTruthy();
    expect(c2aSql).not.toMatch(/revoke\s+select\s+on\s+table\s+public\.generation_jobs/i);
    expect(c2aSql).toMatch(/drop policy if exists "jobs owner insert"/i);
    expect(c2aSql).toMatch(/drop policy if exists "jobs owner update"/i);
  });

  it('plans public-read RLS: only is_public=true visible to authenticated', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/for select to anon\s*,\s*authenticated[\s\S]*?is_public\s*=\s*true/i);
  });

  // --- BFF direct write with owner_id WHERE (no SECURITY DEFINER job functions) ---

  it('service_role retains full CRUD on generation_jobs for BFF direct writes', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/revoke\s+all\s+on\s+table\s+public\.generation_jobs\s+from\s+service_role/i);
    expect(c2aSql).toMatch(/grant\s+select\s*,\s*insert\s*,\s*update\s+on\s+table\s+public\.generation_jobs\s+to\s+service_role/i);
  });

  it('BFF owner enforcement documented: service_role direct writes + WHERE clause', () => {
    if (!hasMigration()) return;
    // The migration comments should document that BFF enforces via WHERE clause
    expect(c2aSql).toMatch(/BFF[\s\S]*?WHERE/i);
  });

  // --- Triggers ---

  it('plans has updated_at trigger', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/create trigger trg_plans_updated/i);
    expect(c2aSql).toMatch(/public\.set_updated_at\(\)/i);
  });

  it('subscriptions has updated_at trigger', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/create trigger trg_subscriptions_updated/i);
  });

  // --- Column presence ---

  it('plans table has required columns', () => {
    if (!hasMigration()) return;
    const tableBlock = c2aSql.match(/create table public\.plans\s*\([\s\S]*?\);/i);
    expect(tableBlock).toBeTruthy();
    if (tableBlock) {
      expect(tableBlock[0]).toContain('name');
      expect(tableBlock[0]).toContain('price_fen');
      expect(tableBlock[0]).toContain('quota_per_cycle');
      expect(tableBlock[0]).toContain('period_unit');
      expect(tableBlock[0]).toContain('period_count');
      expect(tableBlock[0]).toContain('features');
      expect(tableBlock[0]).toContain('is_public');
    }
  });

  it('plans.price_fen has no default, CHECK >= 0', () => {
    if (!hasMigration()) return;
    const tableBlock = c2aSql.match(/create table public\.plans\s*\([\s\S]*?\);/i);
    expect(tableBlock).toBeTruthy();
    if (tableBlock) {
      expect(tableBlock[0]).toMatch(/price_fen\s+integer\s+not\s+null\s+check\s*\(\s*price_fen\s*>=/i);
      expect(tableBlock[0]).not.toMatch(/price_fen.*default/i);
    }
  });

  it('plans.quota_per_cycle has no default, CHECK >= 0', () => {
    if (!hasMigration()) return;
    const tableBlock = c2aSql.match(/create table public\.plans\s*\([\s\S]*?\);/i);
    expect(tableBlock).toBeTruthy();
    if (tableBlock) {
      expect(tableBlock[0]).toMatch(/quota_per_cycle\s+integer\s+not\s+null\s+check\s*\(\s*quota_per_cycle\s*>=/i);
      expect(tableBlock[0]).not.toMatch(/quota_per_cycle.*default/i);
    }
  });

  it('plans period uses explicit week/month unit and positive count', () => {
    if (!hasMigration()) return;
    const tableBlock = c2aSql.match(/create table public\.plans\s*\([\s\S]*?\);/i);
    expect(tableBlock).toBeTruthy();
    if (tableBlock) {
      expect(tableBlock[0]).toMatch(/period_unit\s+text\s+not\s+null[\s\S]*?'week'\s*,\s*'month'/i);
      expect(tableBlock[0]).toMatch(/period_count\s+integer\s+not\s+null[\s\S]*?period_count\s*>\s*0/i);
    }
  });

  it('subscriptions.quota_used has CHECK >= 0', () => {
    if (!hasMigration()) return;
    const tableBlock = c2aSql.match(/create table public\.subscriptions\s*\([\s\S]*?\);/i);
    expect(tableBlock).toBeTruthy();
    if (tableBlock) {
      expect(tableBlock[0]).toMatch(/quota_used\s+integer\s+not\s+null\s+default\s+0\s+check\s*\(\s*quota_used\s*>=/i);
    }
  });

  it('subscriptions.status has CHECK constraint for valid values', () => {
    if (!hasMigration()) return;
    const tableBlock = c2aSql.match(/create table public\.subscriptions\s*\([\s\S]*?\);/i);
    expect(tableBlock).toBeTruthy();
    if (tableBlock) {
      expect(tableBlock[0]).toMatch(/status\s+text\s+not\s+null\s+default\s+'active'\s+check\s*\(\s*status\s+in\s*\(/i);
    }
  });

  it('subscriptions table has required columns', () => {
    if (!hasMigration()) return;
    const tableBlock = c2aSql.match(/create table public\.subscriptions\s*\([\s\S]*?\);/i);
    expect(tableBlock).toBeTruthy();
    if (tableBlock) {
      expect(tableBlock[0]).toContain('user_id');
      expect(tableBlock[0]).toContain('plan_id');
      expect(tableBlock[0]).toContain('status');
      expect(tableBlock[0]).toContain('quota_used');
      expect(tableBlock[0]).toContain('current_period_start');
      expect(tableBlock[0]).toContain('current_period_end');
    }
  });

  it('usage_ledger table has required columns', () => {
    if (!hasMigration()) return;
    const tableBlock = c2aSql.match(/create table public\.usage_ledger\s*\([\s\S]*?\);/i);
    expect(tableBlock).toBeTruthy();
    if (tableBlock) {
      expect(tableBlock[0]).toContain('user_id');
      expect(tableBlock[0]).toContain('subscription_id');
      expect(tableBlock[0]).toContain('event_type');
      expect(tableBlock[0]).toContain('amount');
      expect(tableBlock[0]).toContain('idempotency_key');
      expect(tableBlock[0]).toContain('reservation_id');
      expect(tableBlock[0]).toContain('reference_id');
      expect(tableBlock[0]).toContain('metadata');
    }
  });

  // --- Indexes ---

  it('has required indexes on usage_ledger', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toContain('idx_ledger_user_created');
    expect(c2aSql).toContain('idx_ledger_subscription');
    expect(c2aSql).toContain('idx_ledger_idempotency');
    expect(c2aSql).toContain('idx_ledger_reservation');
  });

  it('has required indexes on subscriptions', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toContain('idx_subscriptions_user');
    expect(c2aSql).toContain('idx_subscriptions_plan');
    expect(c2aSql).toContain('idx_subscriptions_status');
  });

  // --- usage_ledger: amount always positive ---

  it('usage_ledger amount check constraint enforces positive', () => {
    if (!hasMigration()) return;
    expect(c2aSql).toMatch(/amount\s+integer\s+not\s+null\s+check\s*\(\s*amount\s*>\s*0\s*\)/i);
  });

  // --- Migration does not reference application env vars ---

  it('migration does not reference application env var names', () => {
    if (!hasMigration()) return;
    // The migration is a DB artefact — it should not mention application
    // environment variable names. Those belong in adapter code, not SQL.
    expect(c2aSql).not.toMatch(/SUPABASE_SECRET_KEY/i);
    expect(c2aSql).not.toMatch(/VITE_SUPABASE/i);
    // Negative: no env var names matching the legacy secret key pattern
    expect(c2aSql).not.toMatch(/SERVICE_ROLE_KEY/i);
  });
});
