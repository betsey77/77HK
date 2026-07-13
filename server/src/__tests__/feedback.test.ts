/**
 * Slice H1 — Feedback API server tests
 *
 * Tests the feedback routes through the HTTP layer.
 * Mocks the Supabase client at the from() level.
 * Mocks the ServerChan notifier.
 *
 * Covers: auth gate, POST validation, POST success, GET list,
 * notification failure still returns 201, cross-user isolation,
 * input sanitization, error sanitization.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { resetNotifier } from '../services/serverchanNotifier.js';

// ── Mock Supabase ──────────────────────────────────────────────

const { mockCreateUserClient } = vi.hoisted(() => ({
  mockCreateUserClient: vi.fn(),
}));

vi.mock('../services/supabase.js', () => ({
  getSupabase: () => null,
  createUserClient: mockCreateUserClient,
  verifyToken: vi.fn(async () => ({ sub: 'user-001', email: 'test@example.com' })),
}));

// ── Mock ServerChan notifier ───────────────────────────────────

const mockNotifierSend = vi.fn();

vi.mock('../services/serverchanNotifier.js', async () => {
  const actual = await vi.importActual('../services/serverchanNotifier.js');
  return {
    ...(actual as object),
    getNotifier: () => ({ send: mockNotifierSend }),
    resetNotifier: actual.resetNotifier,
  };
});

// ── Mock Trusted Supabase ──────────────────────────────────────

const { mockGetTrustedSupabase } = vi.hoisted(() => ({
  mockGetTrustedSupabase: vi.fn(),
}));

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: mockGetTrustedSupabase,
}));

// ── Helpers ────────────────────────────────────────────────────

const VALID_TOKEN = 'Bearer valid-jwt-token';

function makeQueryChain(terminal: {
  data?: unknown;
  error?: { code?: string; message: string } | null;
  count?: number;
}) {
  const chain: Record<string, any> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'range', 'limit', 'single', 'head'];
  methods.forEach((m) => {
    chain[m] = () => chain;
  });
  chain.then = (resolve: (v: unknown) => void) => {
    resolve({
      data: terminal.data ?? null,
      error: terminal.error ?? null,
      count: terminal.count ?? 0,
    });
    return { catch: () => {} };
  };
  return chain;
}

function setupClient() {
  const client = { from: vi.fn() };
  mockCreateUserClient.mockReturnValue(client);
  return client;
}

// ── DB row factories ───────────────────────────────────────────

function makeFeedbackRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'fb-001',
    owner_id: 'user-001',
    type: 'feature_request',
    title: '添加批量生成功能',
    content: '希望能够一次生成多条文案',
    metadata: { page_path: '/app', app_version: '0.1.0' },
    notify_status: 'pending',
    notify_attempts: 0,
    notify_last_error: null,
    notified_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('POST /api/feedback', () => {
  let client: { from: ReturnType<typeof vi.fn> };

  function setupTrustedClient() {
    const tc = { from: vi.fn() };
    mockGetTrustedSupabase.mockReturnValue(tc);
    return tc;
  }

  let trustedClient: { from: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    client = setupClient();
    trustedClient = setupTrustedClient();
    mockNotifierSend.mockReset();
    mockNotifierSend.mockResolvedValue({ success: true, serverchanErrno: 0 });
  });

  afterEach(() => {
    resetNotifier();
  });

  // ── Auth gate ───────────────────────────────────────────────

  it('returns 401 without Authorization header', async () => {
    const res = await request(app).post('/api/feedback').send({
      type: 'feature_request',
      title: 'Test',
      content: 'Test content',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token format', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', 'InvalidFormat token123')
      .send({ type: 'feature_request', title: 'Test', content: 'Test content' });
    expect(res.status).toBe(401);
  });

  // ── Validation ──────────────────────────────────────────────

  it('validates required fields', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({});
    expect(res.status).toBe(400);
  });

  it('validates type enum', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'invalid_type', title: 'Test', content: 'Test content' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('feature_request');
  });

  it('validates title is non-empty', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: '', content: 'Test content' });
    expect(res.status).toBe(400);
  });

  it('validates title max length (201 chars)', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: 'x'.repeat(201), content: 'Test' });
    expect(res.status).toBe(400);
  });

  it('validates content max length (5001 chars)', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: 'Test', content: 'x'.repeat(5001) });
    expect(res.status).toBe(400);
  });

  // ── Success ──────────────────────────────────────────────────

  it('creates feedback and returns 201 on success', async () => {
    client.from.mockReturnValue(makeQueryChain({ data: makeFeedbackRow() })); // insert (user)
    trustedClient.from.mockReturnValue(makeQueryChain({ data: makeFeedbackRow({ notify_status: 'sent' }) })); // update (trusted)

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: '添加批量生成功能', content: '希望能够一次生成多条文案' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('fb-001');
    expect(res.body.type).toBe('feature_request');
    expect(res.body.title).toBe('添加批量生成功能');
    expect(res.body.notifyStatus).toBe('sent');
    // 不返回 content（防止泄露到客户端？检查... msg 里有）
    expect(res.body.content).toBeDefined();
  });

  it('accepts all valid feedback types', async () => {
    const types = ['feature_request', 'bug_report', 'user_experience', 'other'];

    for (const type of types) {
      const c = setupClient(); // fresh user client
      const tc = setupTrustedClient(); // fresh trusted client
      mockCreateUserClient.mockReturnValue(c);
      c.from.mockReturnValue(makeQueryChain({
        data: makeFeedbackRow({ type }),
      }));
      tc.from.mockReturnValue(makeQueryChain({
        data: makeFeedbackRow({ type, notify_status: 'sent' }),
      }));

      const res = await request(app)
        .post('/api/feedback')
        .set('Authorization', VALID_TOKEN)
        .send({ type, title: `Test ${type}`, content: 'Content' });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe(type);
    }
  });

  it('attaches metadata from request body', async () => {
    client.from.mockReturnValue(makeQueryChain({
      data: makeFeedbackRow({ metadata: { page_path: '/app/generate', app_version: '0.1.0' } }),
    }));
    trustedClient.from.mockReturnValue(makeQueryChain({
      data: makeFeedbackRow({ metadata: { page_path: '/app/generate', app_version: '0.1.0' }, notify_status: 'sent' }),
    }));

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({
        type: 'bug_report',
        title: 'Bug',
        content: 'Description',
        metadata: { page_path: '/app/generate', app_version: '0.1.0' },
      });

    expect(res.status).toBe(201);
  });

  // ── Notification failure still returns 201 ──────────────────

  it('returns 201 even when notification fails', async () => {
    mockNotifierSend.mockResolvedValue({ success: false, error: 'ServerChan unreachable' });

    client.from.mockReturnValueOnce(makeQueryChain({ data: makeFeedbackRow() })); // insert (user)
    trustedClient.from.mockReturnValueOnce(makeQueryChain({ data: makeFeedbackRow({ notify_status: 'failed' }) })); // update (trusted)

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'bug_report', title: 'Bug title', content: 'Bug description' });

    expect(res.status).toBe(201);
  });

  it('returns 201 even when notification throws', async () => {
    mockNotifierSend.mockRejectedValue(new Error('Network error'));

    client.from.mockReturnValueOnce(makeQueryChain({ data: makeFeedbackRow() })); // insert (user)
    trustedClient.from.mockReturnValueOnce(makeQueryChain({ data: makeFeedbackRow({ notify_status: 'failed' }) })); // update (trusted)

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'bug_report', title: 'Bug title', content: 'Bug description' });

    expect(res.status).toBe(201);
  });

  // ── Trusted update behavior ─────────────────────────────────

  it('keeps notify_status as pending when trusted update returns error', async () => {
    mockNotifierSend.mockResolvedValue({ success: true, serverchanErrno: 0 });

    client.from.mockReturnValueOnce(makeQueryChain({ data: makeFeedbackRow() })); // insert (user)
    trustedClient.from.mockReturnValueOnce(makeQueryChain({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })); // update fails

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: 'Test', content: 'Test content' });

    expect(res.status).toBe(201);
    // notifyStatus should remain 'pending' since update failed
    expect(res.body.notifyStatus).toBe('pending');
  });

  it('keeps notify_status as pending when trusted update throws', async () => {
    mockNotifierSend.mockResolvedValue({ success: true, serverchanErrno: 0 });

    client.from.mockReturnValueOnce(makeQueryChain({ data: makeFeedbackRow() })); // insert (user)
    trustedClient.from.mockReturnValue(() => {
      throw new Error('Connection refused');
    }); // update throws

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: 'Test', content: 'Test content' });

    expect(res.status).toBe(201);
    // notifyStatus should remain 'pending'
    expect(res.body.notifyStatus).toBe('pending');
  });

  it('updates notify_status to sent on trusted update success', async () => {
    mockNotifierSend.mockResolvedValue({ success: true, serverchanErrno: 0 });

    client.from.mockReturnValueOnce(makeQueryChain({ data: makeFeedbackRow() })); // insert (user)
    trustedClient.from.mockReturnValueOnce(makeQueryChain({ data: makeFeedbackRow({ notify_status: 'sent' }) })); // update (trusted)

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: 'Test', content: 'Test content' });

    expect(res.status).toBe(201);
    expect(res.body.notifyStatus).toBe('sent');
  });

  it('updates notify_status to failed on notification failure with trusted update', async () => {
    mockNotifierSend.mockResolvedValue({ success: false, error: 'ServerChan unreachable' });

    client.from.mockReturnValueOnce(makeQueryChain({ data: makeFeedbackRow() })); // insert (user)
    trustedClient.from.mockReturnValueOnce(makeQueryChain({ data: makeFeedbackRow({ notify_status: 'failed' }) })); // update (trusted)

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'bug_report', title: 'Bug', content: 'Bug desc' });

    expect(res.status).toBe(201);
    expect(res.body.notifyStatus).toBe('failed');
  });

  it('keeps pending when no trusted client is available', async () => {
    mockGetTrustedSupabase.mockImplementation(() => {
      throw new Error('Trusted service unavailable');
    });
    mockNotifierSend.mockResolvedValue({ success: true, serverchanErrno: 0 });

    client.from.mockReturnValueOnce(makeQueryChain({ data: makeFeedbackRow() })); // insert (user)

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: 'Test', content: 'Test content' });

    expect(res.status).toBe(201);
    expect(res.body.notifyStatus).toBe('pending');
  });

  // ── DB errors sanitized ─────────────────────────────────────

  it('sanitizes database insert errors', async () => {
    client.from.mockReturnValue(makeQueryChain({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    }));

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: 'Test', content: 'Test' });

    expect(res.status).toBe(500);
    expect(res.body.error).not.toContain('23505');
    expect(res.body.error).not.toContain('unique constraint');
  });

  // ── Metadata validation ─────────────────────────────────────

  it('rejects non-object metadata', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: 'Test', content: 'Test', metadata: 'string' });
    expect(res.status).toBe(400);
  });

  it('rejects array metadata', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: 'Test', content: 'Test', metadata: [] });
    expect(res.status).toBe(400);
  });

  it('rejects metadata with too many keys', async () => {
    const tooManyKeys: Record<string, string> = {};
    for (let i = 0; i < 25; i++) tooManyKeys[`key${i}`] = 'value';
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: 'Test', content: 'Test', metadata: tooManyKeys });
    expect(res.status).toBe(400);
  });

  it('rejects metadata with complex nested values', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({
        type: 'feature_request',
        title: 'Test',
        content: 'Test',
        metadata: { nested: { obj: true } },
      });
    expect(res.status).toBe(400);
  });

  // ── 500 not leaking details ─────────────────────────────────

  // ── Rate limit (429) ────────────────────────────────────────

  it('returns 429 when rate limit is exceeded', async () => {
    client.from.mockReturnValue(makeQueryChain({
      data: null,
      error: { code: 'P0001', message: 'RATE_LIMIT: max 20 feedback per hour per user' },
    }));

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: 'Test', content: 'Test content' });

    expect(res.status).toBe(429);
    expect(res.body.error).toContain('limit');
  });

  it('generic 500 error does not leak internal details', async () => {
    client.from.mockReturnValue(makeQueryChain({
      data: null,
      error: { code: 'PGRST', message: 'some internal error with table user_feedback' },
    }));

    const res = await request(app)
      .post('/api/feedback')
      .set('Authorization', VALID_TOKEN)
      .send({ type: 'feature_request', title: 'Test', content: 'Test' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});

describe('GET /api/feedback', () => {
  let client: { from: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    client = setupClient();
  });

  // ── Auth gate ───────────────────────────────────────────────

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/feedback');
    expect(res.status).toBe(401);
  });

  // ── Success ──────────────────────────────────────────────────

  it('returns own feedback list', async () => {
    client.from.mockReturnValue(makeQueryChain({
      data: [makeFeedbackRow(), makeFeedbackRow({ id: 'fb-002', type: 'bug_report' })],
      count: 2,
    }));

    const res = await request(app)
      .get('/api/feedback')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.items[0].type).toBe('feature_request');
  });

  it('returns empty list when no feedback', async () => {
    client.from.mockReturnValue(makeQueryChain({ data: [], count: 0 }));

    const res = await request(app)
      .get('/api/feedback')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  // ── query params validation ─────────────────────────────────

  it('validates limit range', async () => {
    const res = await request(app)
      .get('/api/feedback?limit=0')
      .set('Authorization', VALID_TOKEN);
    expect(res.status).toBe(400);
  });

  it('validates limit max (101)', async () => {
    const res = await request(app)
      .get('/api/feedback?limit=101')
      .set('Authorization', VALID_TOKEN);
    expect(res.status).toBe(400);
  });

  it('validates offset non-negative', async () => {
    const res = await request(app)
      .get('/api/feedback?offset=-1')
      .set('Authorization', VALID_TOKEN);
    expect(res.status).toBe(400);
  });

  // ── DB errors sanitized ─────────────────────────────────────

  it('sanitizes database errors on GET', async () => {
    client.from.mockReturnValue(makeQueryChain({
      data: null,
      error: { code: '42P01', message: 'relation "user_feedback" does not exist' },
    }));

    const res = await request(app)
      .get('/api/feedback')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
  });
});

describe('Cross-user isolation (static assertions)', () => {
  it('verifyToken is called with the JWT for each request', async () => {
    const { verifyToken } = await import('../services/supabase.js');
    const mockVerify = verifyToken as ReturnType<typeof vi.fn>;

    const client = setupClient();
    client.from.mockReturnValue(makeQueryChain({
      data: [makeFeedbackRow()],
      count: 1,
    }));

    await request(app)
      .get('/api/feedback')
      .set('Authorization', 'Bearer user-a-token');

    expect(mockVerify).toHaveBeenCalledWith('user-a-token');
  });
});
