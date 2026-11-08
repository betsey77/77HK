/**
 * W4 — Admin favorite review context + super_admin case library detail.
 *
 * TDD: permissions, audit-before-body, settings snapshot mapping,
 * no select(*), no write routes, fail-closed audit.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Pure helper tests (no route mocks) ─────────────────────────

describe('W4 — extractFavoriteSettingsFields', () => {
  it('extracts brand/product/copyType/platform from settings snapshot', async () => {
    const { extractFavoriteSettingsFields } = await import('../services/adminService.js');
    expect(
      extractFavoriteSettingsFields({
        brandName: '  港饮  ',
        productName: '冻柠茶',
        copyType: 'social',
        platform: 'ig',
        publishPlatform: 'shorts',
        tone: '活潑',
      }),
    ).toEqual({
      brandName: '港饮',
      productName: '冻柠茶',
      copyType: 'social',
      platform: 'ig',
      publishPlatform: 'shorts',
    });
  });

  it('returns null for missing/blank/non-object settings (client shows 未填写)', async () => {
    const { extractFavoriteSettingsFields } = await import('../services/adminService.js');
    expect(extractFavoriteSettingsFields(null)).toEqual({
      brandName: null,
      productName: null,
      copyType: null,
      platform: null,
      publishPlatform: null,
    });
    expect(extractFavoriteSettingsFields({})).toEqual({
      brandName: null,
      productName: null,
      copyType: null,
      platform: null,
      publishPlatform: null,
    });
    expect(extractFavoriteSettingsFields({ brandName: '  ', productName: 1 })).toEqual({
      brandName: null,
      productName: null,
      copyType: null,
      platform: null,
      publishPlatform: null,
    });
  });
});

describe('管理员收藏元信息检索', () => {
  it('只构造元信息字段的 PostgREST JSON 路径筛选，不包含正文', async () => {
    const { buildAdminFavoriteSearchOrFilter, normalizeAdminFavoriteQuery } = await import('../services/adminService.js');
    const query = normalizeAdminFavoriteQuery(' 港饮(夏) ');
    expect(query).toBe('港饮 夏');
    const filter = buildAdminFavoriteSearchOrFilter(query!);
    expect(filter).toContain('settings->>brandName.ilike.%港饮 夏%');
    expect(filter).toContain('settings->>publishPlatform.ilike.%港饮 夏%');
    expect(filter).not.toContain('content');
    expect(filter).not.toContain('"settings->>');
  });
});

describe('W4 — static route & service contracts', () => {
  const adminRoute = fs.readFileSync(
    path.resolve(__dirname, '../routes/admin.ts'),
    'utf-8',
  );
  const adminService = fs.readFileSync(
    path.resolve(__dirname, '../services/adminService.ts'),
    'utf-8',
  );
  const adminMw = fs.readFileSync(
    path.resolve(__dirname, '../middleware/admin.ts'),
    'utf-8',
  );

  it('favorite detail still audits before body read and fails closed', () => {
    const favRouteStart = adminRoute.indexOf("router.get('/favorites/:id'");
    const nextRoute = adminRoute.indexOf('router.get(', favRouteStart + 1);
    const block = nextRoute > 0
      ? adminRoute.slice(favRouteStart, nextRoute)
      : adminRoute.slice(favRouteStart);
    const existsPos = block.indexOf('adminFavoriteExists');
    const auditPos = block.indexOf('writeAdminAuditLog');
    const detailPos = block.indexOf('getAdminFavoriteDetail');
    expect(existsPos).toBeGreaterThanOrEqual(0);
    expect(auditPos).toBeGreaterThan(existsPos);
    expect(detailPos).toBeGreaterThan(auditPos);
    const between = block.slice(auditPos, detailPos);
    expect(between).toContain('500');
    expect(between).toContain('return;');
  });

  it('favorite list/detail select settings and map brand/product/copyType/platform', () => {
    expect(adminService).toContain('extractFavoriteSettingsFields');
    expect(adminService).toMatch(/from\('favorites'\)[\s\S]*settings/);
    expect(adminService).toContain('brandName');
    expect(adminService).toContain('productName');
    expect(adminService).toContain('copyType');
  });

  it('requireSuperAdmin exists and is narrow', () => {
    expect(adminMw).toContain('export function requireSuperAdmin');
    expect(adminMw).toContain("req.userRole === 'super_admin'");
  });

  it('case library detail route: exists → audit → body; super_admin only', () => {
    expect(adminRoute).toContain("router.get('/case-library/:id'");
    expect(adminRoute).toContain('requireSuperAdmin');
    expect(adminRoute).toContain('admin_view_case_library_detail');
    expect(adminRoute).toContain('adminCaseLibraryExists');
    expect(adminRoute).toContain('getAdminCaseLibraryDetail');

    const start = adminRoute.indexOf("router.get('/case-library/:id'");
    const block = adminRoute.slice(start, start + 1800);
    const existsPos = block.indexOf('adminCaseLibraryExists');
    const auditPos = block.indexOf('writeAdminAuditLog');
    const detailPos = block.indexOf('getAdminCaseLibraryDetail');
    expect(existsPos).toBeGreaterThanOrEqual(0);
    expect(auditPos).toBeGreaterThan(existsPos);
    expect(detailPos).toBeGreaterThan(auditPos);
    expect(block.slice(auditPos, detailPos)).toContain('500');
  });

  it('case detail service: no select(*), allowlist only, soft-delete treated as missing', () => {
    const fnStart = adminService.indexOf('export async function getAdminCaseLibraryDetail');
    expect(fnStart).toBeGreaterThan(0);
    const next = adminService.indexOf('export async function', fnStart + 1);
    const body = next > 0 ? adminService.slice(fnStart, next) : adminService.slice(fnStart);
    expect(body).not.toMatch(/\.select\s*\(\s*['"]\*['"]\s*\)/);
    expect(body).toContain('case_type');
    expect(body).toContain('title');
    expect(body).toContain('body');
    expect(body).not.toMatch(/password|token|secret|email/i);

    const existsStart = adminService.indexOf('export async function adminCaseLibraryExists');
    const existsNext = adminService.indexOf('export async function', existsStart + 1);
    const existsBody = adminService.slice(existsStart, existsNext);
    expect(existsBody).toContain(".select('id')");
    expect(existsBody).toContain("deleted_at");
  });

  it('admin routes only expose the frozen review-pack POSTs and favorite review PUT', () => {
    expect(adminRoute).not.toMatch(/router\.(delete|patch)\(/);
    const postPaths = [...adminRoute.matchAll(/router\.post\('([^']+)'/g)].map((match) => match[1]);
    expect(postPaths).toEqual([
      '/bad-case-review-packs/:id/assign',
      '/bad-case-review-packs/:id/status',
      '/bad-case-review-packs/:id/analyze',
      '/bad-case-findings/:id/review',
      '/bad-case-findings/:id/proposal',
    ]);
    const putMatches = adminRoute.match(/router\.put\(/g) ?? [];
    expect(putMatches.length).toBe(1);
    expect(adminRoute).toMatch(/router\.put\('\/favorites\/:id\/review'/);
  });
});

// ── Supertest with service mocks ───────────────────────────────

const { mockVerifyToken, mockCreateUserClient } = vi.hoisted(() => ({
  mockVerifyToken: vi.fn(),
  mockCreateUserClient: vi.fn(),
}));

vi.mock('../services/supabase.js', () => ({
  getSupabase: () => null,
  createUserClient: mockCreateUserClient,
  verifyToken: mockVerifyToken,
}));

const mockAdminStats = vi.fn();
const mockAdminActorReviewGroup = vi.fn();
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
const mockAdminCaseLibraryExists = vi.fn();
const mockAdminCaseLibraryDetail = vi.fn();
const mockWriteAdminAuditLog = vi.fn();

vi.mock('../services/adminService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/adminService.js')>();
  return {
    ...actual,
    getAdminStats: (...args: unknown[]) => mockAdminStats(...args),
    getAdminActorReviewGroup: (...args: unknown[]) => mockAdminActorReviewGroup(...args),
    getAdminUsersOverview: (...args: unknown[]) => mockAdminUsersOverview(...args),
    getAdminGenerationMeta: (...args: unknown[]) => mockAdminGenerationMeta(...args),
    adminGenerationExists: (...args: unknown[]) => mockAdminGenerationExists(...args),
    getAdminGenerationDetail: (...args: unknown[]) => mockAdminGenerationDetail(...args),
    getAdminFeedbackSummary: (...args: unknown[]) => mockAdminFeedbackSummary(...args),
    getAdminSubscriptionsOverview: (...args: unknown[]) => mockAdminSubscriptionsOverview(...args),
    getAdminAuditLog: (...args: unknown[]) => mockAdminAuditLog(...args),
    getAdminFavoritesOverview: (...args: unknown[]) => mockAdminFavoritesOverview(...args),
    adminFavoriteExists: (...args: unknown[]) => mockAdminFavoriteExists(...args),
    getAdminFavoriteDetail: (...args: unknown[]) => mockAdminFavoriteDetail(...args),
    adminCaseLibraryExists: (...args: unknown[]) => mockAdminCaseLibraryExists(...args),
    getAdminCaseLibraryDetail: (...args: unknown[]) => mockAdminCaseLibraryDetail(...args),
    writeAdminAuditLog: (...args: unknown[]) => mockWriteAdminAuditLog(...args),
  };
});

vi.mock('../services/trustedSupabase.js', () => ({
  getTrustedSupabase: () => ({}),
}));

describe('W4 — case library detail route behavior', () => {
  let app: Awaited<typeof import('../app.js')>['default'];

  beforeAll(async () => {
    app = (await import('../app.js')).default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockVerifyToken.mockRejectedValue(new Error('No token'));
    mockAdminStats.mockResolvedValue({
      totalUsers: 1, activeSubscriptions: 0, totalGenerations: 0,
      totalFeedback: 0, adminUsers: 1,
    });
    mockAdminActorReviewGroup.mockResolvedValue('group1');
    mockAdminCaseLibraryExists.mockResolvedValue(true);
    mockAdminCaseLibraryDetail.mockResolvedValue({
      id: 'case-1',
      ownerDisplayName: '用户 abc12345',
      caseType: 'good',
      title: '好案例',
      body: '案例正文内容足够长',
      reason: '开场自然',
      tags: ['hook'],
      createdAt: '2026-07-14T00:00:00Z',
      updatedAt: '2026-07-14T01:00:00Z',
    });
    mockWriteAdminAuditLog.mockResolvedValue(undefined);
    mockAdminFavoriteExists.mockResolvedValue(true);
    mockAdminFavoriteDetail.mockResolvedValue({
      id: 'favorite-1',
      ownerDisplayName: '用户 x',
      userEmail: 'u@example.com',
      variantKey: 'ig',
      content: '正文',
      rating: null,
      notes: null,
      favoriteReason: null,
      reasonTags: [],
      savedAt: '2026-07-14T00:00:00Z',
      brandName: '港饮',
      productName: null,
      copyType: 'social',
      platform: 'ig',
    });
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

  it('GET /api/admin/case-library/:id → 401 without token', async () => {
    const res = await request(app).get('/api/admin/case-library/case-1');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/case-library/:id → 403 for plain user', async () => {
    const res = await request(app)
      .get('/api/admin/case-library/case-1')
      .set('Authorization', authAsUser('plain-user'));
    expect(res.status).toBe(403);
  });

  it('GET /api/admin/case-library/:id → 403 for ordinary admin', async () => {
    const res = await request(app)
      .get('/api/admin/case-library/case-1')
      .set('Authorization', authAsAdmin('admin-user', 'admin'));
    expect(res.status).toBe(403);
    expect(mockAdminCaseLibraryExists).not.toHaveBeenCalled();
    expect(mockAdminCaseLibraryDetail).not.toHaveBeenCalled();
  });

  it('GET /api/admin/case-library/:id → 200 for super_admin with audit-before-body', async () => {
    const res = await request(app)
      .get('/api/admin/case-library/case-1')
      .set('Authorization', authAsAdmin('super-admin-user', 'super_admin'));

    expect(res.status).toBe(200);
    expect(res.body.body).toBe('案例正文内容足够长');
    expect(res.body.ownerDisplayName).toBe('用户 abc12345');
    expect(res.body).not.toHaveProperty('userEmail');
    expect(res.body).not.toHaveProperty('email');
    expect(mockWriteAdminAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      action: 'admin_view_case_library_detail',
      entity: 'case_library_entries',
      entityId: 'case-1',
      actorRole: 'super_admin',
    }));
    expect(mockWriteAdminAuditLog.mock.invocationCallOrder[0])
      .toBeLessThan(mockAdminCaseLibraryDetail.mock.invocationCallOrder[0]);
  });

  it('fails closed when case detail audit fails — body never read', async () => {
    mockWriteAdminAuditLog.mockRejectedValue(new Error('audit down'));
    const res = await request(app)
      .get('/api/admin/case-library/case-1')
      .set('Authorization', authAsAdmin('super-admin-user', 'super_admin'));
    expect(res.status).toBe(500);
    expect(mockAdminCaseLibraryDetail).not.toHaveBeenCalled();
  });

  it('returns 404 when case does not exist (or soft-deleted)', async () => {
    mockAdminCaseLibraryExists.mockResolvedValue(false);
    const res = await request(app)
      .get('/api/admin/case-library/missing')
      .set('Authorization', authAsAdmin('super-admin-user', 'super_admin'));
    expect(res.status).toBe(404);
    expect(mockWriteAdminAuditLog).not.toHaveBeenCalled();
    expect(mockAdminCaseLibraryDetail).not.toHaveBeenCalled();
  });

  it('favorite detail still returns settings snapshot fields for admin', async () => {
    const res = await request(app)
      .get('/api/admin/favorites/favorite-1')
      .set('Authorization', authAsAdmin('admin-user', 'admin'));
    expect(res.status).toBe(200);
    expect(res.body.brandName).toBe('港饮');
    expect(res.body.copyType).toBe('social');
    expect(res.body.platform).toBe('ig');
    expect(res.body.productName).toBeNull();
  });

  it('GET /api/admin/stats includes server-verified role for UI gating', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', authAsAdmin('super-admin-user', 'super_admin'));
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('super_admin');
  });

  it('ordinary admin stats role is admin (not super_admin)', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', authAsAdmin('admin-user', 'admin'));
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });
});
