/**
 * R1 — review group scope + admin favorite review write API.
 */
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
const mockAdminUsersOverview = vi.fn();
const mockAdminGenerationMeta = vi.fn();
const mockAdminGenerationExists = vi.fn();
const mockAdminGenerationDetail = vi.fn();
const mockAdminFeedbackSummary = vi.fn();
const mockAdminSubscriptionsOverview = vi.fn();
const mockAdminAuditLog = vi.fn();
const mockAdminFavoritesOverview = vi.fn();
const mockAdminPendingReviewSummary = vi.fn();
const mockAdminFavoriteExists = vi.fn();
const mockAdminFavoriteDetail = vi.fn();
const mockAdminCaseLibraryExists = vi.fn();
const mockAdminCaseLibraryDetail = vi.fn();
const mockWriteAdminAuditLog = vi.fn();
const mockUpdateAdminFavoriteReview = vi.fn();
const mockResolveAdminFavoriteOwnerScope = vi.fn();

vi.mock('../services/adminService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/adminService.js')>();
  return {
    ...actual,
    getAdminStats: (...args: unknown[]) => mockAdminStats(...args),
    getAdminUsersOverview: (...args: unknown[]) => mockAdminUsersOverview(...args),
    getAdminGenerationMeta: (...args: unknown[]) => mockAdminGenerationMeta(...args),
    adminGenerationExists: (...args: unknown[]) => mockAdminGenerationExists(...args),
    getAdminGenerationDetail: (...args: unknown[]) => mockAdminGenerationDetail(...args),
    getAdminFeedbackSummary: (...args: unknown[]) => mockAdminFeedbackSummary(...args),
    getAdminSubscriptionsOverview: (...args: unknown[]) => mockAdminSubscriptionsOverview(...args),
    getAdminAuditLog: (...args: unknown[]) => mockAdminAuditLog(...args),
    getAdminFavoritesOverview: (...args: unknown[]) => mockAdminFavoritesOverview(...args),
    getAdminPendingReviewSummary: (...args: unknown[]) => mockAdminPendingReviewSummary(...args),
    adminFavoriteExists: (...args: unknown[]) => mockAdminFavoriteExists(...args),
    getAdminFavoriteDetail: (...args: unknown[]) => mockAdminFavoriteDetail(...args),
    adminCaseLibraryExists: (...args: unknown[]) => mockAdminCaseLibraryExists(...args),
    getAdminCaseLibraryDetail: (...args: unknown[]) => mockAdminCaseLibraryDetail(...args),
    writeAdminAuditLog: (...args: unknown[]) => mockWriteAdminAuditLog(...args),
    updateAdminFavoriteReview: (...args: unknown[]) => mockUpdateAdminFavoriteReview(...args),
    resolveAdminFavoriteOwnerScope: (...args: unknown[]) => mockResolveAdminFavoriteOwnerScope(...args),
  };
});

function adminClient(userId: string, role: 'admin' | 'super_admin' = 'admin') {
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
}

let app: import('express').Express;

beforeAll(async () => {
  app = (await import('../app.js')).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockAdminStats.mockResolvedValue({
    totalUsers: 0,
    activeSubscriptions: 0,
    totalGenerations: 0,
    totalFeedback: 0,
    adminUsers: 0,
  });
  mockAdminFavoritesOverview.mockResolvedValue({ favorites: [], total: 0 });
  mockAdminPendingReviewSummary.mockResolvedValue({ count: 0, latestRequestedAt: null });
  mockAdminFavoriteExists.mockResolvedValue(true);
  mockAdminFavoriteDetail.mockResolvedValue(null);
  mockWriteAdminAuditLog.mockResolvedValue(undefined);
  mockUpdateAdminFavoriteReview.mockResolvedValue({
    favoriteId: 'f1',
    reviewStatus: 'adopted',
    reviewNote: null,
    reviewUpdatedAt: '2026-07-14T12:00:00.000Z',
  });
});

describe('R1 static contracts', () => {
  it('favorite detail order: scope/exists → audit → body', () => {
    const adminRoute = fs.readFileSync(path.resolve(__dirname, '../routes/admin.ts'), 'utf-8');
    const start = adminRoute.indexOf("router.get('/favorites/:id'");
    const putStart = adminRoute.indexOf("router.put('/favorites/:id/review'");
    const block = adminRoute.slice(start, putStart > 0 ? putStart : start + 2500);
    const existsPos = block.indexOf('adminFavoriteExists');
    const auditPos = block.indexOf('writeAdminAuditLog');
    const detailPos = block.indexOf('getAdminFavoriteDetail');
    expect(existsPos).toBeGreaterThanOrEqual(0);
    expect(auditPos).toBeGreaterThan(existsPos);
    expect(detailPos).toBeGreaterThan(auditPos);
    expect(block).toContain('actorScopeFromReq');
  });

  it('review write uses updateAdminFavoriteReview RPC wrapper, not dual JS writes', () => {
    const adminRoute = fs.readFileSync(path.resolve(__dirname, '../routes/admin.ts'), 'utf-8');
    const adminService = fs.readFileSync(path.resolve(__dirname, '../services/adminService.ts'), 'utf-8');
    expect(adminRoute).toMatch(/router\.put\('\/favorites\/:id\/review'/);
    expect(adminRoute).toContain('updateAdminFavoriteReview');
    expect(adminService).toContain("rpc('admin_save_favorite_review'");
    // route must not insert into favorite_admin_reviews or audit_log directly for review
    const putStart = adminRoute.indexOf("router.put('/favorites/:id/review'");
    const putBlock = adminRoute.slice(putStart, putStart + 2000);
    expect(putBlock).not.toContain('writeAdminAuditLog');
    expect(putBlock).not.toMatch(/from\(['"]favorite_admin_reviews['"]\)/);
  });

  it('list overview accepts actor scope and never selects content', () => {
    const adminService = fs.readFileSync(path.resolve(__dirname, '../services/adminService.ts'), 'utf-8');
    expect(adminService).toContain('resolveAdminFavoriteOwnerScope');
    expect(adminService).toContain('AdminFavoriteActorScope');
    const listStart = adminService.indexOf('export async function getAdminFavoritesOverview');
    const listNext = adminService.indexOf('export async function', listStart + 1);
    const listBody = adminService.slice(listStart, listNext);
    expect(listBody).not.toMatch(/\.select\([^)]*content/);
    expect(listBody).toContain('reviewStatus');
  });
});

describe('R1 route behaviour', () => {
  it('passes actor scope to favorites list', async () => {
    adminClient('admin-g1', 'admin');
    mockAdminFavoritesOverview.mockResolvedValue({
      favorites: [{
        id: 'f1',
        ownerDisplayName: 'U1',
        userEmail: 'u1@test.com',
        variantKey: 'ig',
        rating: 5,
        notes: null,
        favoriteReason: null,
        reasonTags: [],
        savedAt: '2026-07-14T00:00:00.000Z',
        brandName: null,
        productName: null,
        copyType: null,
        platform: null,
        publishPlatform: null,
        reviewStatus: null,
        reviewNote: null,
        reviewUpdatedAt: null,
      }],
      total: 1,
    });

    const res = await request(app)
      .get('/api/admin/favorites')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(mockAdminFavoritesOverview).toHaveBeenCalled();
    const args = mockAdminFavoritesOverview.mock.calls[0]!;
    expect(args[3]).toEqual({ actorId: 'admin-g1', actorRole: 'admin' });
    expect(JSON.stringify(res.body)).not.toContain('content');
  });

  it('passes pendingOnly to favorites list without exposing content', async () => {
    adminClient('admin-g1', 'admin');

    const res = await request(app)
      .get('/api/admin/favorites?pendingOnly=true')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(mockAdminFavoritesOverview).toHaveBeenCalledWith(
      20,
      0,
      undefined,
      { actorId: 'admin-g1', actorRole: 'admin' },
      true,
    );
    expect(JSON.stringify(res.body)).not.toContain('content');
  });

  it('returns same-group pending summary before the :id route', async () => {
    adminClient('admin-g1', 'admin');
    mockAdminPendingReviewSummary.mockResolvedValue({
      count: 3,
      latestRequestedAt: '2026-07-15T12:30:00.000Z',
    });

    const res = await request(app)
      .get('/api/admin/favorites/pending-summary')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      count: 3,
      latestRequestedAt: '2026-07-15T12:30:00.000Z',
    });
    expect(mockAdminPendingReviewSummary).toHaveBeenCalledWith({
      actorId: 'admin-g1',
      actorRole: 'admin',
    });
    expect(mockAdminFavoriteExists).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain('content');
  });

  it('cross-group detail: 404 without audit or body read', async () => {
    adminClient('admin-g1', 'admin');
    mockAdminFavoriteExists.mockResolvedValue(false);

    const res = await request(app)
      .get('/api/admin/favorites/other-group-fav')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(404);
    expect(mockWriteAdminAuditLog).not.toHaveBeenCalled();
    expect(mockAdminFavoriteDetail).not.toHaveBeenCalled();
  });

  it('in-scope detail still audits before body', async () => {
    adminClient('admin-g1', 'admin');
    mockAdminFavoriteExists.mockResolvedValue(true);
    mockAdminFavoriteDetail.mockResolvedValue({
      id: 'f1',
      ownerDisplayName: 'U1',
      userEmail: 'u1@test.com',
      variantKey: 'ig',
      content: '港式文案',
      rating: null,
      notes: null,
      favoriteReason: null,
      reasonTags: [],
      savedAt: '2026-07-14T00:00:00.000Z',
      brandName: null,
      productName: null,
      copyType: null,
      platform: null,
      publishPlatform: null,
      reviewStatus: 'adopted',
      reviewNote: null,
      reviewUpdatedAt: '2026-07-14T01:00:00.000Z',
    });

    const res = await request(app)
      .get('/api/admin/favorites/f1')
      .set('Authorization', 'Bearer t');

    expect(res.status).toBe(200);
    expect(mockWriteAdminAuditLog).toHaveBeenCalled();
    expect(mockAdminFavoriteDetail).toHaveBeenCalled();
    const auditOrder = mockWriteAdminAuditLog.mock.invocationCallOrder[0]!;
    const detailOrder = mockAdminFavoriteDetail.mock.invocationCallOrder[0]!;
    expect(auditOrder).toBeLessThan(detailOrder);
    expect(res.body.reviewStatus).toBe('adopted');
    expect(res.body.content).toBe('港式文案');
  });

  it('PUT review success for same-group admin', async () => {
    adminClient('admin-g1', 'admin');
    const res = await request(app)
      .put('/api/admin/favorites/f1/review')
      .set('Authorization', 'Bearer t')
      .send({ status: 'adopted', note: '  不错  ' });

    expect(res.status).toBe(200);
    expect(mockUpdateAdminFavoriteReview).toHaveBeenCalledWith(
      { actorId: 'admin-g1', actorRole: 'admin' },
      'f1',
      'adopted',
      '  不错  ',
      undefined,
    );
  });

  it('PUT review rejects overpost and invalid status', async () => {
    adminClient('admin-g1', 'admin');
    const over = await request(app)
      .put('/api/admin/favorites/f1/review')
      .set('Authorization', 'Bearer t')
      .send({ status: 'adopted', ownerId: 'x' });
    expect(over.status).toBe(400);

    const bad = await request(app)
      .put('/api/admin/favorites/f1/review')
      .set('Authorization', 'Bearer t')
      .send({ status: 'approved' });
    expect(bad.status).toBe(400);
  });

  it('PUT review maps note_required to 400 and not_found to 404', async () => {
    adminClient('admin-g1', 'admin');
    const { AdminFavoriteReviewError } = await import('../services/adminService.js');

    mockUpdateAdminFavoriteReview.mockRejectedValueOnce(
      new AdminFavoriteReviewError(400, 'note_required', 'Note required for changes_requested'),
    );
    const r400 = await request(app)
      .put('/api/admin/favorites/f1/review')
      .set('Authorization', 'Bearer t')
      .send({ status: 'changes_requested', note: '' });
    expect(r400.status).toBe(400);

    mockUpdateAdminFavoriteReview.mockRejectedValueOnce(
      new AdminFavoriteReviewError(404, 'not_found', 'Favorite not found'),
    );
    const r404 = await request(app)
      .put('/api/admin/favorites/f1/review')
      .set('Authorization', 'Bearer t')
      .send({ status: 'adopted' });
    expect(r404.status).toBe(404);
  });

  it('plain user cannot access review endpoint', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'user-1', email: 'u@test.com' });
    mockCreateUserClient.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    });

    const res = await request(app)
      .put('/api/admin/favorites/f1/review')
      .set('Authorization', 'Bearer t')
      .send({ status: 'adopted' });
    expect(res.status).toBe(403);
    expect(mockUpdateAdminFavoriteReview).not.toHaveBeenCalled();
  });
});

describe('R1 pure helpers', () => {
  it('normalizeReviewNote trims, nulls empty, rejects overlong', async () => {
    const { normalizeReviewNote, AdminFavoriteReviewError } = await import('../services/adminService.js');
    expect(normalizeReviewNote('  a  ')).toBe('a');
    expect(normalizeReviewNote('   ')).toBeNull();
    expect(normalizeReviewNote(null)).toBeNull();
    expect(() => normalizeReviewNote('x'.repeat(2001))).toThrow(AdminFavoriteReviewError);
  });
});
