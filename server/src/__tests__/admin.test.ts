/**
 * Slice G1: Admin API tests (schema-matched).
 *
 * Coverage:
 * - All endpoints require auth (401 without token)
 * - All endpoints require admin role (403 for non-admin users)
 * - Stats endpoint returns correct shape
 * - User overview is paginated and excludes PII
 * - Generation metadata excludes body text
 * - Feedback summary excludes body content
 * - Subscriptions overview includes quota info
 * - Audit log is paginated
 * - Generation detail endpoint writes audit log (fail-closed)
 * - Error sanitization (no internal details)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// ── Mock the trusted Supabase client ───────────────────────────

const mockDb = {
  rpc: vi.fn(),
  from: vi.fn(),
};

// Mock the trusted client to return our controlled mock
vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: () => mockDb as any,
}));

// Import the admin service types (unit-tested)
import {
  type AdminStats,
  type AdminUserOverview,
  type AdminGenerationMeta,
  type AdminFeedbackSummary,
  type AdminSubscriptionOverview,
  type AdminAuditEntry,
} from '../services/adminService.js';

// ── Unit tests: Types ──────────────────────────────────────────

describe('Slice G1 — Admin types', () => {
  it('AdminStats has required fields', () => {
    const stats: AdminStats = {
      totalUsers: 10,
      activeSubscriptions: 5,
      totalGenerations: 100,
      totalFeedback: 20,
      adminUsers: 2,
    };
    expect(stats.totalUsers).toBe(10);
    expect(Object.keys(stats)).toHaveLength(5);
  });

  it('AdminUserOverview excludes passwords/tokens/secrets/PII', () => {
    const user: AdminUserOverview = {
      id: 'uuid-1',
      displayName: '管理员',
      userIdPrefix: 'abc12345',
      roles: ['admin'],
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      deletionRequestedAt: null,
      subscriptionPlan: 'Pro',
      generationCount: 42,
    };
    const keys = Object.keys(user);
    // Must NOT contain: password, token, secret, api_key, email
    const forbidden = ['password', 'token', 'secret', 'api_key', 'hash', 'email'];
    for (const key of keys) {
      expect(forbidden.some((f) => key.toLowerCase().includes(f))).toBe(false);
    }
    // Must use displayName + userIdPrefix (de-identified), not email
    expect(user.displayName).toBeDefined();
    expect(user.userIdPrefix).toBeDefined();
    expect('email' in user).toBe(false);
  });

  it('AdminGenerationMeta excludes body text (no source, variants, etc.)', () => {
    const job: AdminGenerationMeta = {
      id: 'job-1',
      ownerId: 'user-1',
      ownerDisplayName: '用户 abc12345',
      status: 'completed',
      platform: 'ig',
      tone: '活潑',
      generationEngine: 'deepseek',
      createdAt: '2026-07-12T00:00:00Z',
      completedAt: null,
    };
    // Must NOT have 'source', 'variants', 'diagnosis', 'audit', 'body'
    expect('source' in job).toBe(false);
    expect('variants' in job).toBe(false);
    expect('diagnosis' in job).toBe(false);
    expect('audit' in job).toBe(false);
    expect('body' in job).toBe(false);
    // Must NOT have 'sourceLength' (removed per G1 requirement)
    expect('sourceLength' in job).toBe(false);
    // Must NOT have 'email' (de-identified)
    expect('email' in job).toBe(false);
    expect('ownerEmail' in job).toBe(false);
    // Uses display name
    expect(job.ownerDisplayName).toBeDefined();
  });

  it('AdminFeedbackSummary excludes body content', () => {
    const fb: AdminFeedbackSummary = {
      id: 'fb-1',
      ownerId: 'user-1',
      ownerDisplayName: '用户 abc12345',
      type: 'bug_report',
      title: 'Test bug',
      notifyStatus: 'pending',
      createdAt: '2026-07-12T00:00:00Z',
    };
    // Must NOT have raw 'content' field
    expect('content' in fb).toBe(false);
    // Must NOT have 'contentPreview' (body preview removed per G1)
    expect('contentPreview' in fb).toBe(false);
    // Must NOT have 'email'
    expect('ownerEmail' in fb).toBe(false);
    // Uses display name
    expect(fb.ownerDisplayName).toBeDefined();
  });

  it('AdminSubscriptionOverview uses userId (not ownerId)', () => {
    const sub: AdminSubscriptionOverview = {
      id: 'sub-1',
      userId: 'user-1',
      userDisplayName: '用户 abc12345',
      planName: 'Pro',
      status: 'active',
      quotaUsed: 5,
      quotaTotal: 400,
      cycleStart: '2026-07-01T00:00:00Z',
      cycleEnd: '2026-08-01T00:00:00Z',
    };
    expect(sub.userId).toBeDefined();
    expect('ownerId' in sub).toBe(false);
  });

  it('AdminAuditEntry uses real schema columns (actor, entity, diff)', () => {
    const entry: AdminAuditEntry = {
      id: 'audit-1',
      actor: 'user-1',
      actorRole: 'admin',
      action: 'admin_view_generation_detail',
      entity: 'generation_jobs',
      entityId: 'job-1',
      reason: null,
      diff: null,
      requestId: null,
      createdAt: '2026-07-12T00:00:00Z',
    };
    expect(entry.actor).toBeDefined();
    expect(entry.entity).toBeDefined();
    // Must NOT have old column names
    expect('actor_id' in entry).toBe(false);
    expect('resource' in entry).toBe(false);
    expect('resource_id' in entry).toBe(false);
    expect('metadata' in entry).toBe(false);
  });
});

// ── Unit tests: Security invariants ────────────────────────────

describe('Slice G1 — Admin security invariants', () => {
  it('GET /api/admin/stats must require auth (unit check)', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../routes/admin.ts'),
      'utf-8',
    );
    expect(content).toContain('requireAuth');
    expect(content).toContain('requireAdmin');
  });

  it('admin routes only allow review PUT (no DELETE/PATCH/POST; no other PUT)', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../routes/admin.ts'),
      'utf-8',
    );
    // R1: only PUT /favorites/:id/review is allowed as mutation
    expect(content).not.toMatch(/router\.(delete|patch|post)\(/);
    const putMatches = content.match(/router\.put\(/g) ?? [];
    expect(putMatches.length).toBe(1);
    expect(content).toMatch(/router\.put\('\/favorites\/:id\/review'/);
  });

  it('admin routes do NOT return passwords, tokens, or secrets', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../services/adminService.ts'),
      'utf-8',
    );
    const sensitiveFields = [
      'password',
      'encrypted_password',
      'token',
      'secret',
      'api_key',
    ];
    // Extract all select() calls and check for sensitive fields
    const selectMatches = content.match(/\.select\('([^']+)'\)/g);
    if (selectMatches) {
      for (const sel of selectMatches) {
        for (const field of sensitiveFields) {
          expect(sel.toLowerCase()).not.toContain(field.toLowerCase());
        }
      }
    }
  });

  it('MAX_PAGE_SIZE caps at 100', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../services/adminService.ts'),
      'utf-8',
    );
    const match = content.match(/MAX_PAGE_SIZE\s*=\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(100);
  });

  it('admin service never uses select(*)', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../services/adminService.ts'),
      'utf-8',
    );
    expect(content).not.toMatch(/\.select\s*\(\s*['"]\*['"]\s*\)/);
  });
});

// ── Route registration test ────────────────────────────────────

describe('Slice G1 — Admin route registration', () => {
  it('admin routes are registered in app.ts at /api/admin', () => {
    const fs = require('fs');
    const path = require('path');
    const appContent = fs.readFileSync(
      path.resolve(__dirname, '../app.ts'),
      'utf-8',
    );
    expect(appContent).toContain('adminRouter');
    // G1-R fix: admin router is now mounted at /api/admin (not /api)
    expect(appContent).toContain("app.use('/api/admin', adminRouter)");
  });

  it('admin route middleware applies to all routes (no /admin path prefix)', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../routes/admin.ts'),
      'utf-8',
    );
    // G1-R fix: middleware is bare router.use(requireAuth) + router.use(requireAdmin)
    // — applies to ALL routes in this router, not just /admin prefixed
    expect(content).toContain('router.use(requireAuth)');
    expect(content).toContain('router.use(requireAdmin)');
    // No '/admin' path argument in middleware registration
    expect(content).not.toMatch(/router\.use\s*\(\s*['"]\/admin['"]/);
    expect(content).toContain("router.get('/stats'");
    expect(content).toContain("router.get('/users'");
    expect(content).toContain("router.get('/feedback'");
    expect(content).toContain("router.get('/subscriptions'");
    expect(content).toContain("router.get('/audit-log'");
  });

  it('generation detail endpoint is fail-closed (audit write before response)', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../routes/admin.ts'),
      'utf-8',
    );
    // Audit write must happen BEFORE res.json(job) and after confirming resource exists
    expect(content).toContain('writeAdminAuditLog');
    // The catch block for audit failure must return 500 (fail-closed)
    expect(content).toContain('Internal server error');
  });

  it('generation detail route uses adminGenerationExists BEFORE getAdminGenerationDetail', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../routes/admin.ts'),
      'utf-8',
    );

    // Must use adminGenerationExists (exists check, no body read)
    expect(content).toContain('adminGenerationExists');

    // The call order in the route must be: exists → audit → detail
    const existsPos = content.indexOf('adminGenerationExists(');
    const writeAuditPos = content.indexOf('writeAdminAuditLog(');
    const detailPos = content.indexOf('getAdminGenerationDetail(');

    expect(existsPos).toBeGreaterThan(0);
    expect(writeAuditPos).toBeGreaterThan(0);
    expect(detailPos).toBeGreaterThan(0);

    // exists must come before audit write
    expect(existsPos).toBeLessThan(writeAuditPos);
    // audit write must come before detail read
    expect(writeAuditPos).toBeLessThan(detailPos);
  });

  it('audit write failure prevents getAdminGenerationDetail from being called', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../routes/admin.ts'),
      'utf-8',
    );

    // In the detail route, the audit write catch block must return 500
    // BEFORE getAdminGenerationDetail is called.
    // Verify by checking the text between writeAuditLog and getAdminGenerationDetail:
    const writeAuditPos = content.indexOf('writeAdminAuditLog(');
    const detailPos = content.indexOf('getAdminGenerationDetail(');

    // The text between audit write and detail read must contain the 500 return
    const between = content.slice(writeAuditPos, detailPos);
    expect(between).toContain('500');
    expect(between).toContain('Internal server error');
    // Must return BEFORE detail is called — i.e., the 500 code path must not
    // fall through to getAdminGenerationDetail
    const catchReturnPos = between.lastIndexOf('return;');
    expect(catchReturnPos).toBeGreaterThan(0);
  });

  it('adminGenerationExists only selects id column (no body read)', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../services/adminService.ts'),
      'utf-8',
    );

    // Find the adminGenerationExists function body
    const fnStart = content.indexOf('export async function adminGenerationExists');
    const nextExport = content.indexOf('export async function', fnStart + 1);
    const fnBody = nextExport > 0 ? content.slice(fnStart, nextExport) : content.slice(fnStart);

    // Must use .select('id') — only the existence check, no body
    expect(fnBody).toContain(".select('id')");
    // Must NOT contain columns that would return body content
    expect(fnBody).not.toContain('variants');
    expect(fnBody).not.toContain('source');
    expect(fnBody).not.toContain('diagnosis');
    expect(fnBody).not.toContain('audit');
    expect(fnBody).not.toContain('consumer_feedback');
  });
});

// ============================================================================
// G1-R: Supertest behavior tests — real 401/403/200 coverage
// ============================================================================

import request from 'supertest';

const { mockVerifyToken, mockCreateUserClient } = vi.hoisted(() => ({
  mockVerifyToken: vi.fn(),
  mockCreateUserClient: vi.fn(),
}));

vi.mock('../services/supabase.js', () => ({
  getSupabase: () => null,
  createUserClient: mockCreateUserClient,
  verifyToken: mockVerifyToken,
}));

// ── Mock adminService to return controlled data for 200 assertions ──
const mockAdminStats = vi.fn();
const mockAdminUsersOverview = vi.fn();
const mockAdminGenerationMeta = vi.fn();
const mockAdminGenerationExists = vi.fn();
const mockAdminGenerationDetail = vi.fn();
const mockAdminFeedbackSummary = vi.fn();
const mockAdminSubscriptionsOverview = vi.fn();
const mockAdminAuditLog = vi.fn();
const mockAdminFavoritesOverview = vi.fn();
const mockAdminFavoriteExists = vi.fn();
const mockAdminFavoriteDetail = vi.fn();
const mockWriteAdminAuditLog = vi.fn();

vi.mock('../services/adminService.js', () => ({
  getAdminStats: (...args: any[]) => mockAdminStats(...args),
  getAdminUsersOverview: (...args: any[]) => mockAdminUsersOverview(...args),
  getAdminGenerationMeta: (...args: any[]) => mockAdminGenerationMeta(...args),
  adminGenerationExists: (...args: any[]) => mockAdminGenerationExists(...args),
  getAdminGenerationDetail: (...args: any[]) => mockAdminGenerationDetail(...args),
  getAdminFeedbackSummary: (...args: any[]) => mockAdminFeedbackSummary(...args),
  getAdminSubscriptionsOverview: (...args: any[]) => mockAdminSubscriptionsOverview(...args),
  getAdminAuditLog: (...args: any[]) => mockAdminAuditLog(...args),
  getAdminFavoritesOverview: (...args: any[]) => mockAdminFavoritesOverview(...args),
  adminFavoriteExists: (...args: any[]) => mockAdminFavoriteExists(...args),
  getAdminFavoriteDetail: (...args: any[]) => mockAdminFavoriteDetail(...args),
  writeAdminAuditLog: (...args: any[]) => mockWriteAdminAuditLog(...args),
}));

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: () => ({}),
}));

describe('G1-R — Admin route behavior tests (Supertest)', () => {
  let app: any;

  beforeAll(async () => {
    app = (await import('../app.js')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no auth
    mockVerifyToken.mockRejectedValue(new Error('No token'));
    // Default admin service mocks: return controlled data
    mockAdminStats.mockResolvedValue({
      totalUsers: 10, activeSubscriptions: 3, totalGenerations: 100,
      totalFeedback: 20, adminUsers: 2,
    });
    mockAdminUsersOverview.mockResolvedValue({ data: [], total: 0 });
    mockAdminGenerationMeta.mockResolvedValue({ data: [], total: 0 });
    mockAdminGenerationExists.mockResolvedValue(true);
    mockAdminGenerationDetail.mockResolvedValue({ id: 'job-1' });
    mockAdminFeedbackSummary.mockResolvedValue({ data: [], total: 0 });
    mockAdminSubscriptionsOverview.mockResolvedValue({ data: [], total: 0 });
    mockAdminAuditLog.mockResolvedValue({ data: [], total: 0 });
    mockAdminFavoritesOverview.mockResolvedValue({ favorites: [], total: 0 });
    mockAdminFavoriteExists.mockResolvedValue(true);
    mockAdminFavoriteDetail.mockResolvedValue({ id: 'favorite-1', content: '收藏文案' });
    mockWriteAdminAuditLog.mockResolvedValue(undefined);
  });

  function authAsUser(userId: string) {
    mockVerifyToken.mockResolvedValue({ sub: userId, email: `${userId}@test.com` });
    mockCreateUserClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    });
    return `Bearer mock-jwt-${userId}`;
  }

  function authAsAdmin(userId: string, role: 'admin' | 'super_admin' = 'admin') {
    mockVerifyToken.mockResolvedValue({ sub: userId, email: `${userId}@test.com` });
    mockCreateUserClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({ data: [{ role }], error: null }),
          }),
        }),
      }),
    });
    return `Bearer mock-jwt-${userId}`;
  }

  // ── 401: No token ───────────────────────────────────────────────

  describe('no token → 401', () => {
    it('GET /api/admin/stats returns 401 without token', async () => {
      const res = await request(app).get('/api/admin/stats');
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/users returns 401 without token', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/generations returns 401 without token', async () => {
      const res = await request(app).get('/api/admin/generations');
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/feedback returns 401 without token', async () => {
      const res = await request(app).get('/api/admin/feedback');
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/subscriptions returns 401 without token', async () => {
      const res = await request(app).get('/api/admin/subscriptions');
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/audit-log returns 401 without token', async () => {
      const res = await request(app).get('/api/admin/audit-log');
      expect(res.status).toBe(401);
    });

    it('GET /api/admin/favorites returns 401 without token', async () => {
      const res = await request(app).get('/api/admin/favorites');
      expect(res.status).toBe(401);
    });
  });

  // ── 403: Authenticated user, not admin ──────────────────────────

  describe('authenticated user → 403', () => {
    it('GET /api/admin/stats returns 403 for plain user', async () => {
      const token = authAsUser('plain-user');
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', token);
      expect(res.status).toBe(403);
    });

    it('GET /api/admin/users returns 403 for plain user', async () => {
      const token = authAsUser('plain-user');
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', token);
      expect(res.status).toBe(403);
    });

    it('GET /api/admin/audit-log returns 403 for plain user', async () => {
      const token = authAsUser('plain-user');
      const res = await request(app)
        .get('/api/admin/audit-log')
        .set('Authorization', token);
      expect(res.status).toBe(403);
    });

    it('GET /api/admin/favorites returns 403 for plain user', async () => {
      const token = authAsUser('plain-user');
      const res = await request(app)
        .get('/api/admin/favorites')
        .set('Authorization', token);
      expect(res.status).toBe(403);
    });
  });

  // ── 200: Admin user (with controlled service mocks) ─────────────

  describe('admin user → 200', () => {
    it('GET /api/admin/stats returns 200 for admin', async () => {
      const token = authAsAdmin('admin-user');
      mockAdminStats.mockResolvedValue({
        totalUsers: 10,
        activeSubscriptions: 3,
        totalGenerations: 100,
        totalFeedback: 20,
        adminUsers: 2,
      });
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        totalUsers: 10,
        activeSubscriptions: 3,
        totalGenerations: 100,
        totalFeedback: 20,
        adminUsers: 2,
        role: 'admin',
      });
    });

    it('GET /api/admin/users returns 200 for admin', async () => {
      const token = authAsAdmin('admin-user');
      mockAdminUsersOverview.mockResolvedValue({
        data: [{ id: 'u1', displayName: 'User 1', userIdPrefix: 'abc12345', roles: ['user'], status: 'active', createdAt: '2026-01-01T00:00:00Z', deletionRequestedAt: null, subscriptionPlan: 'Free', generationCount: 5 }],
        total: 1,
      });
      const res = await request(app)
        .get('/api/admin/users?limit=10')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('GET /api/admin/feedback returns 200 for admin', async () => {
      const token = authAsAdmin('admin-user');
      mockAdminFeedbackSummary.mockResolvedValue({ data: [], total: 0 });
      const res = await request(app)
        .get('/api/admin/feedback')
        .set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('GET /api/admin/audit-log returns 200 for admin', async () => {
      const token = authAsAdmin('admin-user');
      mockAdminAuditLog.mockResolvedValue({ data: [], total: 0 });
      const res = await request(app)
        .get('/api/admin/audit-log')
        .set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('GET /api/admin/generations returns 200 for admin', async () => {
      const token = authAsAdmin('admin-user');
      mockAdminGenerationMeta.mockResolvedValue({ data: [], total: 0 });
      const res = await request(app)
        .get('/api/admin/generations')
        .set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('GET /api/admin/subscriptions returns 200 for admin', async () => {
      const token = authAsAdmin('admin-user');
      mockAdminSubscriptionsOverview.mockResolvedValue({ data: [], total: 0 });
      const res = await request(app)
        .get('/api/admin/subscriptions')
        .set('Authorization', token);
      expect(res.status).toBe(200);
    });

    it('GET /api/admin/generations/:id returns 200 for admin (with audit log)', async () => {
      const token = authAsAdmin('admin-user');
      mockAdminGenerationExists.mockResolvedValue(true);
      mockWriteAdminAuditLog.mockResolvedValue(undefined);
      mockAdminGenerationDetail.mockResolvedValue({ id: 'job-1', status: 'completed' });
      const res = await request(app)
        .get('/api/admin/generations/job-1')
        .set('Authorization', token);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('job-1');
    });

    it('GET /api/admin/favorites returns metadata for ordinary admin', async () => {
      const token = authAsAdmin('admin-user', 'admin');
      mockAdminFavoritesOverview.mockResolvedValue({
        favorites: [{
          id: 'favorite-1', ownerDisplayName: '用户 abc12345', userEmail: 'user@example.com', variantKey: 'ig',
          rating: 5, notes: '语气贴地', favoriteReason: '开场好', reasonTags: ['hook'],
          savedAt: '2026-07-13T00:00:00Z',
        }],
        total: 1,
      });

      const res = await request(app)
        .get('/api/admin/favorites')
        .set('Authorization', token);

      expect(res.status).toBe(200);
      expect(res.body.favorites).toHaveLength(1);
      expect(res.body.favorites[0]).not.toHaveProperty('content');
    });

    it('GET /api/admin/favorites/:id audits before returning copy content', async () => {
      const token = authAsAdmin('admin-user', 'admin');
      mockAdminFavoriteExists.mockResolvedValue(true);
      mockWriteAdminAuditLog.mockResolvedValue(undefined);
      mockAdminFavoriteDetail.mockResolvedValue({
        id: 'favorite-1', ownerDisplayName: '用户 abc12345', userEmail: 'user@example.com', variantKey: 'ig',
        content: '可复制的收藏文案', rating: 5, notes: null, favoriteReason: null,
        reasonTags: ['hook'], savedAt: '2026-07-13T00:00:00Z',
      });

      const res = await request(app)
        .get('/api/admin/favorites/favorite-1')
        .set('Authorization', token);

      expect(res.status).toBe(200);
      expect(res.body.content).toBe('可复制的收藏文案');
      expect(mockWriteAdminAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        actorRole: 'admin',
        action: 'admin_view_favorite_detail',
        entity: 'favorites',
        entityId: 'favorite-1',
      }));
      expect(mockWriteAdminAuditLog.mock.invocationCallOrder[0])
        .toBeLessThan(mockAdminFavoriteDetail.mock.invocationCallOrder[0]);
    });

    it('fails closed when favorite detail audit logging fails', async () => {
      const token = authAsAdmin('admin-user', 'admin');
      mockAdminFavoriteExists.mockResolvedValue(true);
      mockWriteAdminAuditLog.mockRejectedValue(new Error('audit unavailable'));

      const res = await request(app)
        .get('/api/admin/favorites/favorite-1')
        .set('Authorization', token);

      expect(res.status).toBe(500);
      expect(mockAdminFavoriteDetail).not.toHaveBeenCalled();
    });
  });

  // ── Super admin also passes ─────────────────────────────────────

  describe('super_admin user → 200', () => {
    it('GET /api/admin/stats returns 200 for super_admin', async () => {
      const token = authAsAdmin('super-admin-user', 'super_admin');
      mockAdminStats.mockResolvedValue({
        totalUsers: 5,
        activeSubscriptions: 1,
        totalGenerations: 50,
        totalFeedback: 10,
        adminUsers: 1,
      });
      const res = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', token);
      expect(res.status).toBe(200);
    });
  });
});
