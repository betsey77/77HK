/**
 * Slice D — Cloud Sync server tests
 *
 * Tests the sync routes through the HTTP layer.
 * Mocks the Supabase client at the `from()` level.
 *
 * Covers: auth gate, bootstrap, CRUD for favorites/configs/brand-profiles,
 * import idempotency, input validation, sanitized errors.
 * Also verifies parameters passed to the mock chain.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';

// ============================================================
// Mock Supabase — vi.hoisted to avoid hoisting issues
// ============================================================

const { mockCreateUserClient, mockResolveUserPlanId } = vi.hoisted(() => ({
  mockCreateUserClient: vi.fn(),
  mockResolveUserPlanId: vi.fn(),
}));

vi.mock('../services/supabase.js', () => ({
  getSupabase: () => null,
  createUserClient: mockCreateUserClient,
  verifyToken: vi.fn(async () => ({ sub: 'user-001', email: 'test@example.com' })),
}));

vi.mock('../services/planAccessService.js', () => ({
  resolveUserPlanId: mockResolveUserPlanId,
  FREE_FAVORITE_LIMIT: 10,
}));

// ============================================================
// Recorded calls collector
// ============================================================

let recordedCalls: Array<{method: string, args: unknown[]}>[] = [];

// ============================================================
// Helpers
// ============================================================

const VALID_TOKEN = 'Bearer valid-jwt-token';

/** Build a mock Supabase query chain that records call parameters. */
function makeRecordingQuery(terminal: {
  data?: unknown;
  error?: { code?: string; message: string } | null;
  count?: number;
}) {
  const calls: Array<{method: string, args: unknown[]}> = [];
  recordedCalls.push(calls);

  const chain: Record<string, any> = {
    getCalls: () => calls,
  };

  function addMethod(name: string) {
    chain[name] = (...args: unknown[]) => {
      calls.push({method: name, args: [...args]});
      return chain;
    };
  }

  ['select','insert','delete','eq','in','order','range','limit','maybeSingle','single','head','upsert'].forEach(addMethod);

  chain.then = (resolve: (v: unknown) => void) => {
    resolve({ data: terminal.data ?? null, error: terminal.error ?? null, count: terminal.count ?? 0 });
    return { catch: () => {} };
  };

  return chain;
}

function setupClient() {
  const client = { from: vi.fn() };
  mockCreateUserClient.mockReturnValue(client);
  return client;
}

function mockFromReturns(client: { from: ReturnType<typeof vi.fn> }, terminal: Parameters<typeof makeRecordingQuery>[0]) {
  client.from.mockReturnValue(makeRecordingQuery(terminal));
}

function mockFromSequence(client: { from: ReturnType<typeof vi.fn> }, terminals: Parameters<typeof makeRecordingQuery>[0][]) {
  let call = 0;
  client.from.mockImplementation(() => {
    const t = terminals[call] ?? terminals[terminals.length - 1];
    call++;
    return makeRecordingQuery(t);
  });
}

// ============================================================
// DB row factories (snake_case)
// ============================================================

const NOW = new Date().toISOString();

function makeFavoriteRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'fav-uuid-001',
    owner_id: 'user-001',
    client_id: 'client-fav-1',
    variant_key: 'standardHK',
    content: 'Test content',
    source: 'Test source',
    settings: { tone: 'active' },
    variant_meta: null,
    scores: null,
    consumer_feedback: null,
    notes: null,
    rating: null,
    favorite_reason: null,
    reason_tags: null,
    saved_at: NOW,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeConfigRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'cfg-uuid-001',
    owner_id: 'user-001',
    client_id: 'client-cfg-1',
    name: 'My Config',
    config: { tone: 'active', platform: 'ig' },
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function makeBrandProfileRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'bp-uuid-001',
    owner_id: 'user-001',
    brand_name: 'My Brand',
    product_name: 'My Product',
    brand_red_lines: 'No politics',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveUserPlanId.mockResolvedValue('pro');
  recordedCalls = [];
});

// ============================================================
// 1. Auth gate
// ============================================================

describe('Auth gate', () => {
  it('GET /api/sync/bootstrap without token -> 401', async () => {
    const res = await request(app).get('/api/sync/bootstrap');
    expect(res.status).toBe(401);
  });

  it('POST /api/sync/favorites without token -> 401', async () => {
    const res = await request(app).post('/api/sync/favorites').send({ clientId: 'test' });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/sync/favorites/:clientId without token -> 401', async () => {
    const res = await request(app).delete('/api/sync/favorites/test-1');
    expect(res.status).toBe(401);
  });

  it('POST /api/sync/configs without token -> 401', async () => {
    const res = await request(app).post('/api/sync/configs').send({ clientId: 'test' });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/sync/configs/:clientId without token -> 401', async () => {
    const res = await request(app).delete('/api/sync/configs/test-1');
    expect(res.status).toBe(401);
  });

  it('PUT /api/sync/brand-profile without token -> 401', async () => {
    const res = await request(app).put('/api/sync/brand-profile').send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/sync/import without token -> 401', async () => {
    const res = await request(app).post('/api/sync/import').send({ favorites: [] });
    expect(res.status).toBe(401);
  });

  it('Invalid token -> 401', async () => {
    // Override verifyToken for this test
    const { verifyToken } = await import('../services/supabase.js');
    (verifyToken as any).mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/api/sync/bootstrap')
      .set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});

// ============================================================
// 2. Bootstrap
// ============================================================

describe('GET /api/sync/bootstrap', () => {
  it('returns favorites + configs + brandProfile for authenticated user', async () => {
    const client = setupClient();
    // R1: when favorites exist, bootstrap also loads favorite_admin_reviews
    mockFromSequence(client, [
      { data: [makeFavoriteRow()], count: 1 },
      { data: [makeConfigRow()], count: 1 },
      { data: makeBrandProfileRow() },
      { data: [] }, // admin reviews (none)
    ]);

    const res = await request(app)
      .get('/api/sync/bootstrap')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.favorites).toHaveLength(1);
    expect(res.body.favorites[0].clientId).toBe('client-fav-1');
    expect(res.body.favorites[0].adminReview).toBeNull();
    expect(res.body.savedConfigs).toHaveLength(1);
    expect(res.body.savedConfigs[0].clientId).toBe('client-cfg-1');
    expect(res.body.brandProfile).not.toBeNull();
    expect(res.body.brandProfile.brandName).toBe('My Brand');
  });

  it('returns null brandProfile when none exists', async () => {
    const client = setupClient();
    // Empty favorites → no review query
    mockFromSequence(client, [
      { data: [], count: 0 },
      { data: [], count: 0 },
      { data: null },
    ]);

    const res = await request(app)
      .get('/api/sync/bootstrap')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.favorites).toHaveLength(0);
    expect(res.body.savedConfigs).toHaveLength(0);
    expect(res.body.brandProfile).toBeNull();
  });

  it('attaches adminReview from favorite_admin_reviews when present', async () => {
    const client = setupClient();
    const fav = makeFavoriteRow();
    mockFromSequence(client, [
      { data: [fav], count: 1 },
      { data: [], count: 0 },
      { data: null },
      {
        data: [{
          favorite_id: fav.id,
          review_status: 'adopted',
          note: '很好',
          updated_at: '2026-07-14T12:00:00.000Z',
        }],
      },
    ]);

    const res = await request(app)
      .get('/api/sync/bootstrap')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.favorites[0].adminReview).toEqual({
      status: 'adopted',
      note: '很好',
      updatedAt: '2026-07-14T12:00:00.000Z',
      annotations: [],
    });
  });
});

// ============================================================
// 3. Upsert favorite
// ============================================================

describe('POST /api/sync/favorites', () => {
  const validFavorite = {
    clientId: 'client-fav-1',
    variantKey: 'standardHK',
    content: 'Test content',
    source: 'Test source',
    settings: { tone: 'active' },
  };

  it('creates new favorite, returns saved record', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: makeFavoriteRow() });

    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send(validFavorite);

    expect(res.status).toBe(201);
    expect(res.body.clientId).toBe('client-fav-1');
    expect(res.body.variantKey).toBe('standardHK');
  });

  it('updates existing favorite by client_id (idempotent)', async () => {
    const client = setupClient();
    mockFromReturns(client, {
      data: makeFavoriteRow({ content: 'Updated content', rating: 4 }),
    });

    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({ ...validFavorite, content: 'Updated content', rating: 4 });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Updated content');
    expect(res.body.rating).toBe(4);
  });

  it('accepts an explicit user-authored review request and persists only client-owned fields', async () => {
    const client = setupClient();
    mockFromReturns(client, {
      data: makeFavoriteRow({
        is_user_authored: true,
        review_requested: true,
        review_requested_at: '2026-07-15T12:30:00.000Z',
      }),
    });

    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        ...validFavorite,
        source: '用户自写',
        settings: {
          brandName: '港饮',
          copyType: 'spoken',
          publishPlatform: 'ig',
        },
        isUserAuthored: true,
        reviewRequested: true,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      isUserAuthored: true,
      reviewRequested: true,
      reviewRequestedAt: '2026-07-15T12:30:00.000Z',
    });
    const upsert = recordedCalls.flat().find((call) => call.method === 'upsert');
    expect(upsert?.args[0]).toMatchObject({
      is_user_authored: true,
      review_requested: true,
    });
    expect(upsert?.args[0]).not.toHaveProperty('review_requested_at');
  });

  it('rejects incomplete or implicit user-authored review metadata', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: makeFavoriteRow() });

    const missingBrand = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        ...validFavorite,
        settings: { copyType: 'social', publishPlatform: 'ig' },
        isUserAuthored: true,
        reviewRequested: true,
      });
    expect(missingBrand.status).toBe(400);

    const missingDecision = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        ...validFavorite,
        settings: { brandName: '港饮', copyType: 'social', publishPlatform: 'ig' },
        isUserAuthored: true,
      });
    expect(missingDecision.status).toBe(400);

    const invalidCustom = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        ...validFavorite,
        settings: {
          brandName: '港饮',
          copyType: 'custom',
          customCopyType: '一',
          publishPlatform: 'ig',
        },
        isUserAuthored: true,
        reviewRequested: false,
      });
    expect(invalidCustom.status).toBe(400);
    expect(client.from).not.toHaveBeenCalled();
  });

  it('Free 已有 10 条时拒绝新增收藏并返回 PLAN_LIMIT', async () => {
    mockResolveUserPlanId.mockResolvedValue('free');
    const client = setupClient();
    mockFromSequence(client, [
      { data: null },
      { data: null, count: 10 },
    ]);

    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({ ...validFavorite, clientId: 'new-favorite' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT');
    expect(client.from).toHaveBeenCalledTimes(2);
  });

  it('Free 达到上限后仍可更新既有收藏', async () => {
    mockResolveUserPlanId.mockResolvedValue('free');
    const client = setupClient();
    mockFromSequence(client, [
      { data: { id: 'existing-favorite' } },
      { data: makeFavoriteRow({ content: 'Updated content' }) },
    ]);

    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({ ...validFavorite, content: 'Updated content' });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Updated content');
  });
});

// ============================================================
// 4. Delete favorite
// ============================================================

describe('DELETE /api/sync/favorites/:clientId', () => {
  it('removes own favorite, returns 200', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: makeFavoriteRow(), count: 1 });

    const res = await request(app)
      .delete('/api/sync/favorites/client-fav-1')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('non-existent clientId -> 404 (not 403)', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: null, count: 0 });

    const res = await request(app)
      .delete('/api/sync/favorites/non-existent-id')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Favorite not found');
  });

  it('cannot delete another user favorite -> 404', async () => {
    // RLS filters out the row -> count=0 -> indistinguishable from not-found
    const client = setupClient();
    mockFromReturns(client, { data: null, count: 0 });

    const res = await request(app)
      .delete('/api/sync/favorites/someone-else-fav')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Favorite not found');
  });
});

// ============================================================
// 5. Upsert config
// ============================================================

describe('POST /api/sync/configs', () => {
  const validConfig = {
    clientId: 'client-cfg-1',
    name: 'My Config',
    config: { tone: 'active', platform: 'ig' },
  };

  it('creates new config, returns saved record', async () => {
    const client = setupClient();
    // First call: check existing (maybeSingle)
    // Second call: countConfigs (select with count)
    // Third call: upsert
    mockFromSequence(client, [
      { data: null },                        // existing check -> none
      { data: [], count: 0 },                // count -> 0
      { data: makeConfigRow() },             // upsert -> success
    ]);

    const res = await request(app)
      .post('/api/sync/configs')
      .set('Authorization', VALID_TOKEN)
      .send(validConfig);

    expect(res.status).toBe(201);
    expect(res.body.clientId).toBe('client-cfg-1');
    expect(res.body.name).toBe('My Config');
  });

  it('rejects when count >= 20 (MAX_SAVED_CONFIGS)', async () => {
    const client = setupClient();
    // First call: check existing -> none
    // Second call: countConfigs -> 20
    mockFromSequence(client, [
      { data: null },
      { data: [], count: 20 },
    ]);

    const res = await request(app)
      .post('/api/sync/configs')
      .set('Authorization', VALID_TOKEN)
      .send({ ...validConfig, clientId: 'new-cfg' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum of 20/);
  });

  it('allows update of existing config even at limit', async () => {
    const client = setupClient();
    // First call: check existing -> found, skip count check
    // Second call: upsert
    mockFromSequence(client, [
      { data: makeConfigRow() },             // existing check -> found
      { data: makeConfigRow({ name: 'Renamed' }) }, // upsert
    ]);

    const res = await request(app)
      .post('/api/sync/configs')
      .set('Authorization', VALID_TOKEN)
      .send({ ...validConfig, name: 'Renamed' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Renamed');
  });
});

// ============================================================
// 6. Delete config
// ============================================================

describe('DELETE /api/sync/configs/:clientId', () => {
  it('removes own config', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: makeConfigRow(), count: 1 });

    const res = await request(app)
      .delete('/api/sync/configs/client-cfg-1')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('non-existent clientId -> 404', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: null, count: 0 });

    const res = await request(app)
      .delete('/api/sync/configs/non-existent')
      .set('Authorization', VALID_TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Config not found');
  });
});

// ============================================================
// 7. Upsert brand profile
// ============================================================

describe('PUT /api/sync/brand-profile', () => {
  it('creates new brand profile', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: makeBrandProfileRow() });

    const res = await request(app)
      .put('/api/sync/brand-profile')
      .set('Authorization', VALID_TOKEN)
      .send({ brandName: 'My Brand', productName: 'My Product' });

    expect(res.status).toBe(200);
    expect(res.body.brandName).toBe('My Brand');
    expect(res.body.productName).toBe('My Product');
  });

  it('updates existing brand profile', async () => {
    const client = setupClient();
    mockFromReturns(client, {
      data: makeBrandProfileRow({ brand_name: 'Updated Brand', product_name: 'Updated Product' }),
    });

    const res = await request(app)
      .put('/api/sync/brand-profile')
      .set('Authorization', VALID_TOKEN)
      .send({ brandName: 'Updated Brand', productName: 'Updated Product' });

    expect(res.status).toBe(200);
    expect(res.body.brandName).toBe('Updated Brand');
    expect(res.body.productName).toBe('Updated Product');
  });
});

// ============================================================
// 8. Import
// ============================================================

describe('POST /api/sync/import', () => {
  const validFavorite = {
    clientId: 'import-fav-1',
    variantKey: 'ig',
    content: 'Import content',
    source: 'Import source',
    settings: { tone: 'active' },
  };

  const validConfig = {
    clientId: 'import-cfg-1',
    name: 'Import Config',
    config: { tone: 'classic' },
  };

  it('empty arrays -> 0 imported, 0 updated', async () => {
    const res = await request(app)
      .post('/api/sync/import')
      .set('Authorization', VALID_TOKEN)
      .send({ favorites: [], savedConfigs: [] });

    expect(res.status).toBe(200);
    expect(res.body.favorites.imported).toBe(0);
    expect(res.body.favorites.updated).toBe(0);
    expect(res.body.savedConfigs.imported).toBe(0);
    expect(res.body.savedConfigs.updated).toBe(0);
  });

  it('imports new favorites and configs', async () => {
    const client = setupClient();
    // favorites: existing check -> null, upsert
    // configs: existing check -> null, upsert
    mockFromSequence(client, [
      { data: null },                            // fav existing check
      { data: makeFavoriteRow({ client_id: 'import-fav-1' }) }, // fav upsert
      { data: null },                            // cfg existing check
      { data: makeConfigRow({ client_id: 'import-cfg-1' }) },   // cfg upsert
    ]);

    const res = await request(app)
      .post('/api/sync/import')
      .set('Authorization', VALID_TOKEN)
      .send({ favorites: [validFavorite], savedConfigs: [validConfig] });

    expect(res.status).toBe(200);
    expect(res.body.favorites.imported).toBe(1);
    expect(res.body.favorites.updated).toBe(0);
    expect(res.body.savedConfigs.imported).toBe(1);
    expect(res.body.savedConfigs.updated).toBe(0);
  });

  it('Free 导入会在写入前预检，超出 10 条时整批拒绝', async () => {
    mockResolveUserPlanId.mockResolvedValue('free');
    const client = setupClient();
    mockFromReturns(client, {
      data: Array.from({ length: 10 }, (_, index) => ({ client_id: `existing-${index + 1}` })),
    });

    const res = await request(app)
      .post('/api/sync/import')
      .set('Authorization', VALID_TOKEN)
      .send({ favorites: [validFavorite] });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PLAN_LIMIT');
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it('idempotent — running twice does not increase count', async () => {
    const client = setupClient();
    // Everything exists already
    mockFromSequence(client, [
      { data: makeFavoriteRow({ client_id: 'import-fav-1' }) }, // fav existing check -> found
      { data: makeFavoriteRow({ client_id: 'import-fav-1' }) }, // fav upsert (update)
      { data: makeConfigRow({ client_id: 'import-cfg-1' }) },   // cfg existing check -> found
      { data: makeConfigRow({ client_id: 'import-cfg-1' }) },   // cfg upsert (update)
    ]);

    const res = await request(app)
      .post('/api/sync/import')
      .set('Authorization', VALID_TOKEN)
      .send({ favorites: [validFavorite], savedConfigs: [validConfig] });

    expect(res.status).toBe(200);
    // Existing records -> imports=0, updates count
    expect(res.body.favorites.imported).toBe(0);
    expect(res.body.favorites.updated).toBe(1);
    expect(res.body.savedConfigs.imported).toBe(0);
    expect(res.body.savedConfigs.updated).toBe(1);
  });

  it('same client_id updates rather than duplicates', async () => {
    const client = setupClient();
    // Two favorites with same clientId
    mockFromSequence(client, [
      { data: makeFavoriteRow({ client_id: 'same-id' }) },   // first: exists
      { data: makeFavoriteRow({ client_id: 'same-id' }) },   // first: upsert
      { data: makeFavoriteRow({ client_id: 'same-id' }) },   // second: exists -> updated
      { data: makeFavoriteRow({ client_id: 'same-id' }) },   // second: upsert
    ]);

    const fav = { ...validFavorite, clientId: 'same-id' };
    const res = await request(app)
      .post('/api/sync/import')
      .set('Authorization', VALID_TOKEN)
      .send({ favorites: [fav, fav] });

    expect(res.status).toBe(200);
    // Both existed -> imported=0, updated=2
    expect(res.body.favorites.imported).toBe(0);
    expect(res.body.favorites.updated).toBe(2);
  });
});

// ============================================================
// 9. Body validation
// ============================================================

describe('Body validation', () => {
  it('owner_id in body is rejected -> uses auth userId', async () => {
    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        owner_id: 'evil-user',
        clientId: 'test',
        variantKey: 'standardHK',
        content: 'Content',
        source: 'Source',
        settings: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/owner_id/i);
  });

  it('id in body is rejected', async () => {
    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        id: 'injected-uuid',
        clientId: 'test',
        variantKey: 'standardHK',
        content: 'Content',
        source: 'Source',
        settings: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/id/i);
  });

  it('invalid variantKey -> 400', async () => {
    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        clientId: 'test',
        variantKey: 'invalid-platform',
        content: 'Content',
        source: 'Source',
        settings: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/variantKey/);
  });

  it('rating 6 -> 400', async () => {
    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        clientId: 'test',
        variantKey: 'standardHK',
        content: 'Content',
        source: 'Source',
        settings: {},
        rating: 6,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/rating/);
  });

  it('empty clientId -> 400', async () => {
    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        clientId: '',
        variantKey: 'standardHK',
        content: 'Content',
        source: 'Source',
        settings: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/clientId/);
  });

  it('content over 5000 chars -> 400', async () => {
    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        clientId: 'test',
        variantKey: 'standardHK',
        content: 'x'.repeat(5001),
        source: 'Source',
        settings: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/5000/);
  });

  it('invalid config JSON -> 400', async () => {
    const res = await request(app)
      .post('/api/sync/configs')
      .set('Authorization', VALID_TOKEN)
      .send({
        clientId: 'test',
        name: 'Test',
        config: 'not-an-object',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/config.*object/);
  });

  it('missing settings object -> 400', async () => {
    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        clientId: 'test',
        variantKey: 'standardHK',
        content: 'Content',
        source: 'Source',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/settings/);
  });

  it('reasonTags not array of strings -> 400', async () => {
    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        clientId: 'test',
        variantKey: 'standardHK',
        content: 'Content',
        source: 'Source',
        settings: {},
        reasonTags: [1, 2, 3],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reasonTag/);
  });

  it('clientId > 256 chars -> 400', async () => {
    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        clientId: 'x'.repeat(257),
        variantKey: 'standardHK',
        content: 'Content',
        source: 'Source',
        settings: {},
      });

    expect(res.status).toBe(400);
  });
});

// ============================================================
// 10. Sanitized errors
// ============================================================

describe('Sanitized errors', () => {
  it('DB error returns generic 500 with no details leaked', async () => {
    const client = setupClient();
    // Simulate a constraint violation that would leak table names
    mockFromReturns(client, {
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint "favorites_owner_id_client_id_key"' },
    });

    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send({
        clientId: 'test',
        variantKey: 'standardHK',
        content: 'Content',
        source: 'Source',
        settings: {},
      });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    // Must not leak table or constraint names
    expect(res.body.error).not.toContain('favorites');
    expect(res.body.error).not.toContain('owner_id');
    expect(res.body.error).not.toContain('constraint');
    expect(res.body.error).not.toContain('23505');
  });
});

// ============================================================
// 11. New parameter-assertion tests (recording mock)
// ============================================================

describe('Mock parameter assertions', () => {
  const validFavorite = {
    clientId: 'client-fav-1',
    variantKey: 'standardHK',
    content: 'Test content',
    source: 'Test source',
    settings: { tone: 'active' },
  };

  const validConfig = {
    clientId: 'client-cfg-1',
    name: 'My Config',
    config: { tone: 'active', platform: 'ig' },
  };

  it('upsert payload includes trusted owner_id', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: makeFavoriteRow() });

    await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send(validFavorite);

    // Verify the upsert payload was passed with trusted owner_id, not from body
    const firstChain = recordedCalls[0];
    const upsertCall = firstChain.find((c) => c.method === 'upsert');
    expect(upsertCall).toBeDefined();
    const payload = upsertCall!.args[0] as Record<string, unknown>;
    expect(payload).toHaveProperty('owner_id', 'user-001');
    expect(payload).not.toHaveProperty('ownerId');
    expect(upsertCall!.args[1]).toEqual({ onConflict: 'owner_id, client_id' });
  });

  it('config and brand upserts use the verified owner and correct conflict keys', async () => {
    let client = setupClient();
    mockFromSequence(client, [
      { data: { id: 'existing-config' } },
      { data: makeConfigRow() },
    ]);

    const configRes = await request(app)
      .post('/api/sync/configs')
      .set('Authorization', VALID_TOKEN)
      .send(validConfig);
    expect(configRes.status).toBe(201);
    const configUpsert = recordedCalls[1].find((call) => call.method === 'upsert');
    expect(configUpsert?.args[0]).toMatchObject({
      owner_id: 'user-001', client_id: 'client-cfg-1',
    });
    expect(configUpsert?.args[1]).toEqual({ onConflict: 'owner_id, client_id' });

    vi.clearAllMocks();
    recordedCalls = [];
    client = setupClient();
    mockFromReturns(client, { data: makeBrandProfileRow() });

    const brandRes = await request(app)
      .put('/api/sync/brand-profile')
      .set('Authorization', VALID_TOKEN)
      .send({ brandName: 'Brand', productName: 'Product', brandRedLines: 'None' });
    expect(brandRes.status).toBe(200);
    const brandUpsert = recordedCalls[0].find((call) => call.method === 'upsert');
    expect(brandUpsert?.args[0]).toMatchObject({
      owner_id: 'user-001', brand_name: 'Brand', product_name: 'Product',
    });
    expect(brandUpsert?.args[1]).toEqual({ onConflict: 'owner_id' });
  });

  it('bulk import upserts both entity types with the verified owner', async () => {
    const client = setupClient();
    mockFromSequence(client, [
      { data: null },
      { data: makeFavoriteRow() },
      { data: null },
      { data: makeConfigRow() },
    ]);

    const res = await request(app)
      .post('/api/sync/import')
      .set('Authorization', VALID_TOKEN)
      .send({ favorites: [validFavorite], savedConfigs: [validConfig] });
    expect(res.status).toBe(200);

    const favoriteUpsert = recordedCalls[1].find((call) => call.method === 'upsert');
    const configUpsert = recordedCalls[3].find((call) => call.method === 'upsert');
    expect(favoriteUpsert?.args[0]).toMatchObject({ owner_id: 'user-001' });
    expect(favoriteUpsert?.args[1]).toEqual({ onConflict: 'owner_id, client_id' });
    expect(configUpsert?.args[0]).toMatchObject({ owner_id: 'user-001' });
    expect(configUpsert?.args[1]).toEqual({ onConflict: 'owner_id, client_id' });
  });

  it('delete uses correct owner_id and client_id eq filters', async () => {
    const client = setupClient();
    mockFromReturns(client, { data: makeFavoriteRow(), count: 1 });

    await request(app)
      .delete('/api/sync/favorites/client-fav-1')
      .set('Authorization', VALID_TOKEN);

    const firstChain = recordedCalls[0];
    const eqCalls = firstChain.filter((c) => c.method === 'eq');
    expect(eqCalls.some((c) => c.args[0] === 'owner_id' && c.args[1] === 'user-001')).toBe(true);
    expect(eqCalls.some((c) => c.args[0] === 'client_id' && c.args[1] === 'client-fav-1')).toBe(true);
  });

  it('import called twice -> second run returns updated counts not imported', async () => {
    // First run: all new
    let client = setupClient();
    mockFromSequence(client, [
      { data: null },                            // fav check -> doesn't exist
      { data: makeFavoriteRow({ client_id: 'import-fav-1' }) }, // fav upsert
      { data: null },                            // cfg check -> doesn't exist
      { data: makeConfigRow({ client_id: 'import-cfg-1' }) },   // cfg upsert
    ]);

    const res1 = await request(app)
      .post('/api/sync/import')
      .set('Authorization', VALID_TOKEN)
      .send({ favorites: [validFavorite], savedConfigs: [validConfig] });

    expect(res1.status).toBe(200);
    expect(res1.body.favorites.imported).toBe(1);
    expect(res1.body.favorites.updated).toBe(0);

    // Reset mocks for second run
    vi.clearAllMocks();
    recordedCalls = [];

    // Second run: all already exist
    client = setupClient();
    mockFromSequence(client, [
      { data: makeFavoriteRow({ client_id: 'import-fav-1' }) }, // fav check -> exists
      { data: makeFavoriteRow({ client_id: 'import-fav-1' }) }, // fav upsert
      { data: makeConfigRow({ client_id: 'import-cfg-1' }) },   // cfg check -> exists
      { data: makeConfigRow({ client_id: 'import-cfg-1' }) },   // cfg upsert
    ]);

    const res2 = await request(app)
      .post('/api/sync/import')
      .set('Authorization', VALID_TOKEN)
      .send({ favorites: [validFavorite], savedConfigs: [validConfig] });

    expect(res2.status).toBe(200);
    expect(res2.body.favorites.imported).toBe(0);
    expect(res2.body.favorites.updated).toBe(1);
    expect(res2.body.savedConfigs.imported).toBe(0);
    expect(res2.body.savedConfigs.updated).toBe(1);
  });

  it('invalid JSON body -> 400', async () => {
    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .set('Content-Type', 'application/json')
      .send('{invalid json}');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/JSON/);
  });

  it('body >1MiB -> 413 with valid JSON response', async () => {
    const largeBody = 'x'.repeat(2_000_000); // ~2 MiB
    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Content-Type', 'application/json')
      .send(largeBody);

    // Body size limit is checked before auth
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/too large/i);
  });

  it('unknown DB error -> generic 500 message', async () => {
    const client = setupClient();
    mockFromReturns(client, {
      data: null,
      error: { code: 'XX999', message: 'Something went wrong: connection refused to db.internal:5432' },
    });

    const res = await request(app)
      .post('/api/sync/favorites')
      .set('Authorization', VALID_TOKEN)
      .send(validFavorite);

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');
    // Must not leak internal details
    expect(res.body.error).not.toContain('connection');
    expect(res.body.error).not.toContain('5432');
    expect(res.body.error).not.toContain('db.internal');
  });

  it('config limit error -> 400 with controlled message', async () => {
    const client = setupClient();
    // Existing check returns null, count returns 20 -> triggers limit error
    mockFromSequence(client, [
      { data: null },
      { data: [], count: 20 },
    ]);

    const res = await request(app)
      .post('/api/sync/configs')
      .set('Authorization', VALID_TOKEN)
      .send({ ...validConfig, clientId: 'new-cfg' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/You have reached the maximum/);
    expect(res.body.error).toMatch(/20/);
  });

  it('database trigger config limit is mapped to a controlled 400', async () => {
    const client = setupClient();
    mockFromSequence(client, [
      { data: null },
      { data: [], count: 19 },
      { data: null, error: { code: '23US1', message: 'config_limit_exceeded internal detail' } },
    ]);

    const res = await request(app)
      .post('/api/sync/configs')
      .set('Authorization', VALID_TOKEN)
      .send({ ...validConfig, clientId: 'concurrent-new-config' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('You have reached the maximum of 20 saved configs');
    expect(res.body.error).not.toContain('internal');
  });

  it('database trigger config limit during import is mapped to a controlled 400', async () => {
    const client = setupClient();
    mockFromSequence(client, [
      { data: null },
      { data: null, error: { code: '23US1', message: 'config_limit_exceeded internal detail' } },
    ]);

    const res = await request(app)
      .post('/api/sync/import')
      .set('Authorization', VALID_TOKEN)
      .send({ favorites: [], savedConfigs: [validConfig] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('You have reached the maximum of 20 saved configs');
    expect(res.body.error).not.toContain('internal');
  });

  it('total import batch >200 -> 400', async () => {
    const manyFavorites = Array.from({ length: 101 }, (_, i) => ({
      ...validFavorite,
      clientId: `fav-${i}`,
    }));
    const manyConfigs = Array.from({ length: 101 }, (_, i) => ({
      ...validConfig,
      clientId: `cfg-${i}`,
    }));

    const res = await request(app)
      .post('/api/sync/import')
      .set('Authorization', VALID_TOKEN)
      .send({ favorites: manyFavorites, savedConfigs: manyConfigs });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Total import batch/);
    expect(res.body.error).toMatch(/200/);
  });
});
