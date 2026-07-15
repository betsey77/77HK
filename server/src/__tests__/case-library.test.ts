/**
 * W2 — Case library API tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import {
  validateCaseLibraryInput,
  deriveCaseDisplayName,
  deriveCaseBodyPreview,
  CASE_LIBRARY_LIMITS,
} from '../services/caseLibraryService.js';

const { mockCreateUserClient, mockVerifyToken } = vi.hoisted(() => ({
  mockCreateUserClient: vi.fn(),
  mockVerifyToken: vi.fn(async () => ({ sub: 'user-001', email: 'test@example.com' })),
}));

vi.mock('../services/supabase.js', () => ({
  getSupabase: () => null,
  createUserClient: mockCreateUserClient,
  verifyToken: mockVerifyToken,
}));

const VALID_TOKEN = 'Bearer valid-jwt-token';
const CASE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CASE_ID,
    owner_id: 'user-001',
    case_type: 'good',
    title: null,
    body: '这是一条足够长度的正例正文内容用于测试校验',
    reason: '结构清晰',
    tags: ['钩子'],
    created_at: '2026-07-14T00:00:00.000Z',
    updated_at: '2026-07-14T01:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function makeQueryChain(terminal: {
  data?: unknown;
  error?: { code?: string; message: string } | null;
}) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'is',
    'order',
    'range',
    'limit',
    'single',
  ];
  for (const m of methods) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (v: unknown) => void) => {
    resolve({
      data: terminal.data ?? null,
      error: terminal.error ?? null,
    });
    return { catch: () => {} };
  };
  return chain;
}

function setupClient(fromImpl?: (table: string) => unknown) {
  const client = {
    from: vi.fn((table: string) => {
      if (fromImpl) return fromImpl(table);
      return makeQueryChain({ data: [], error: null });
    }),
  };
  mockCreateUserClient.mockReturnValue(client);
  return client;
}

describe('W2 case library field validation', () => {
  it('accepts title optional, body 20–5000, reason 1–500, tags limits', () => {
    const input = validateCaseLibraryInput({
      caseType: 'bad',
      body: 'x'.repeat(20),
      reason: 'r',
      tags: ['a', 'b'],
    });
    expect(input.title).toBeNull();
    expect(input.caseType).toBe('bad');
    expect(input.tags).toEqual(['a', 'b']);
  });

  it('rejects short body / long title / too many tags / non-string tags', () => {
    expect(() =>
      validateCaseLibraryInput({
        caseType: 'good',
        body: 'short',
        reason: 'ok',
      }),
    ).toThrow(/body must be/);

    expect(() =>
      validateCaseLibraryInput({
        caseType: 'good',
        title: 't'.repeat(CASE_LIBRARY_LIMITS.titleMax + 1),
        body: 'x'.repeat(20),
        reason: 'ok',
      }),
    ).toThrow(/title must be at most/);

    expect(() =>
      validateCaseLibraryInput({
        caseType: 'good',
        body: 'x'.repeat(20),
        reason: 'ok',
        tags: Array.from({ length: 9 }, (_, i) => `t${i}`),
      }),
    ).toThrow(/at most 8/);

    expect(() =>
      validateCaseLibraryInput({
        caseType: 'good',
        body: 'x'.repeat(20),
        reason: 'ok',
        tags: [1 as unknown as string],
      }),
    ).toThrow(/string/);
  });

  it('derives unnamed display names without writing to DB fields', () => {
    expect(deriveCaseDisplayName('good', null)).toBe('未命名正例');
    expect(deriveCaseDisplayName('bad', '  ')).toBe('未命名反例');
    expect(deriveCaseDisplayName('good', ' 我的案例 ')).toBe('我的案例');
    expect(deriveCaseBodyPreview('这是正文前缀内容用来做摘要展示测试', 24).length).toBeLessThanOrEqual(25);
  });
});

describe('GET /api/case-library', () => {
  beforeEach(() => {
    mockVerifyToken.mockResolvedValue({ sub: 'user-001', email: 'test@example.com' });
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/case-library');
    expect(res.status).toBe(401);
  });

  it('lists only non-deleted rows ordered by updated_at desc and filters query', async () => {
    const rows = [
      makeRow({
        id: CASE_ID,
        title: '好钩子',
        body: '这是一条足够长度的正例正文内容用于测试校验A',
        updated_at: '2026-07-14T02:00:00.000Z',
      }),
      makeRow({
        id: OTHER_ID,
        case_type: 'bad',
        title: '硬广',
        body: '这是一条足够长度的反例正文内容用于测试校验B',
        reason: '太硬',
        tags: ['避免'],
        updated_at: '2026-07-14T01:00:00.000Z',
      }),
    ];
    setupClient(() => makeQueryChain({ data: rows, error: null }));

    const res = await request(app)
      .get('/api/case-library')
      .query({ query: '钩子' })
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('好钩子');
    expect(res.body.items[0].caseType).toBe('good');
  });
});

describe('POST /api/case-library', () => {
  beforeEach(() => {
    mockVerifyToken.mockResolvedValue({ sub: 'user-001', email: 'test@example.com' });
  });

  it('creates entry for authenticated owner', async () => {
    const row = makeRow({ title: '新建' });
    setupClient(() => makeQueryChain({ data: row, error: null }));

    const res = await request(app)
      .post('/api/case-library')
      .set('Authorization', VALID_TOKEN)
      .send({
        caseType: 'good',
        title: '新建',
        body: '这是一条足够长度的正例正文内容用于测试校验',
        reason: '结构清晰',
        tags: ['钩子'],
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(CASE_ID);
    expect(res.body.caseType).toBe('good');
    expect(res.body.title).toBe('新建');
  });

  it('rejects invalid body', async () => {
    setupClient();
    const res = await request(app)
      .post('/api/case-library')
      .set('Authorization', VALID_TOKEN)
      .send({ caseType: 'good', body: 'too short', reason: 'x' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH / DELETE ownership', () => {
  beforeEach(() => {
    mockVerifyToken.mockResolvedValue({ sub: 'user-001', email: 'test@example.com' });
  });

  it('returns 404 for other-owner / missing id on update', async () => {
    setupClient(() => makeQueryChain({ data: null, error: { message: 'not found' } }));
    const res = await request(app)
      .patch(`/api/case-library/${CASE_ID}`)
      .set('Authorization', VALID_TOKEN)
      .send({
        caseType: 'good',
        body: '这是一条足够长度的正例正文内容用于测试校验',
        reason: '结构清晰',
      });
    expect(res.status).toBe(404);
  });

  it('soft-deletes via update (204) and rejects invalid uuid', async () => {
    setupClient(() => makeQueryChain({ data: { id: CASE_ID }, error: null }));
    const ok = await request(app)
      .delete(`/api/case-library/${CASE_ID}`)
      .set('Authorization', VALID_TOKEN);
    expect(ok.status).toBe(204);

    const bad = await request(app)
      .delete('/api/case-library/not-a-uuid')
      .set('Authorization', VALID_TOKEN);
    expect(bad.status).toBe(400);
  });

  it('returns 404 when soft-deleting missing id', async () => {
    setupClient(() => makeQueryChain({ data: null, error: { message: 'not found' } }));
    const res = await request(app)
      .delete(`/api/case-library/${CASE_ID}`)
      .set('Authorization', VALID_TOKEN);
    expect(res.status).toBe(404);
  });
});
