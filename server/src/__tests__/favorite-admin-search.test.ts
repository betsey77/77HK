/**
 * Admin favorites metadata search + publishPlatform snapshot extraction.
 * Never reads content in list path; q is normalized and escaped.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('normalizeAdminFavoriteQuery / buildAdminFavoriteSearchOrFilter', () => {
  it('trims, caps at 80, strips PostgREST metacharacters', async () => {
    const {
      normalizeAdminFavoriteQuery,
      ADMIN_FAVORITE_SEARCH_MAX_LEN,
    } = await import('../services/adminService.js');
    expect(normalizeAdminFavoriteQuery('  港饮  ')).toBe('港饮');
    expect(normalizeAdminFavoriteQuery('')).toBeNull();
    expect(normalizeAdminFavoriteQuery('   ')).toBeNull();
    expect(normalizeAdminFavoriteQuery(null)).toBeNull();
    expect(normalizeAdminFavoriteQuery(12)).toBeNull();
    const long = 'x'.repeat(100);
    expect(normalizeAdminFavoriteQuery(long)?.length).toBe(ADMIN_FAVORITE_SEARCH_MAX_LEN);
    expect(normalizeAdminFavoriteQuery('a,b(c).d\\e')).toBe('a b c d e');
  });

  it('builds or-filter on metadata fields only — never content', async () => {
    const {
      buildAdminFavoriteSearchOrFilter,
      escapeIlikePattern,
    } = await import('../services/adminService.js');
    const filter = buildAdminFavoriteSearchOrFilter('港饮');
    expect(filter).toContain('notes.ilike.');
    expect(filter).toContain('favorite_reason.ilike.');
    expect(filter).toContain('variant_key.ilike.');
    expect(filter).toContain('settings->>brandName');
    expect(filter).toContain('settings->>publishPlatform');
    expect(filter).not.toMatch(/\bcontent\b/);
    expect(filter).not.toContain("select('*')");
    // Wildcard escape
    expect(escapeIlikePattern('100%_off')).toBe('100\\%\\_off');
    expect(buildAdminFavoriteSearchOrFilter('100%')).toContain('100\\%');
  });

  it('maps Chinese reason label to reason_tags contains key', async () => {
    const { buildAdminFavoriteSearchOrFilter } = await import('../services/adminService.js');
    const filter = buildAdminFavoriteSearchOrFilter('开场吸睛');
    expect(filter).toContain('reason_tags.cs.{hook}');
  });
});

describe('extractFavoriteSettingsFields publishPlatform', () => {
  it('extracts publishPlatform without overwriting platform', async () => {
    const { extractFavoriteSettingsFields } = await import('../services/adminService.js');
    expect(
      extractFavoriteSettingsFields({
        platform: 'all',
        publishPlatform: 'ig',
        brandName: '港饮',
        copyType: 'social',
      }),
    ).toEqual({
      brandName: '港饮',
      productName: null,
      copyType: 'social',
      platform: 'all',
      publishPlatform: 'ig',
    });
    expect(extractFavoriteSettingsFields(null).publishPlatform).toBeNull();
  });
});

// ── Route wiring with mocks ───────────────────────────────────

const mockAdminFavoritesOverview = vi.fn();
const mockAdminFavoriteExists = vi.fn();
const mockAdminFavoriteDetail = vi.fn();
const mockWriteAdminAuditLog = vi.fn();
const mockRequireAuth = vi.fn((req: any, _res: any, next: any) => {
  req.userId = 'admin-user';
  req.userRole = 'admin';
  next();
});
const mockRequireAdmin = vi.fn((_req: any, _res: any, next: any) => next());

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req: any, res: any, next: any) => mockRequireAuth(req, res, next),
}));
vi.mock('../middleware/admin.js', () => ({
  requireAdmin: (req: any, res: any, next: any) => mockRequireAdmin(req, res, next),
  requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../services/adminService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/adminService.js')>();
  return {
    ...actual,
    getAdminFavoritesOverview: (...args: unknown[]) => mockAdminFavoritesOverview(...args),
    adminFavoriteExists: (...args: unknown[]) => mockAdminFavoriteExists(...args),
    getAdminFavoriteDetail: (...args: unknown[]) => mockAdminFavoriteDetail(...args),
    writeAdminAuditLog: (...args: unknown[]) => mockWriteAdminAuditLog(...args),
    getAdminStats: vi.fn().mockResolvedValue({
      totalUsers: 1, activeSubscriptions: 0, totalGenerations: 0, totalFeedback: 0, adminUsers: 1,
    }),
  };
});

describe('GET /api/admin/favorites search + audit detail still holds', () => {
  let app: import('express').Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockRequireAuth.mockImplementation((req: any, _res: any, next: any) => {
      req.userId = 'admin-user';
      req.userRole = 'admin';
      next();
    });
    mockRequireAdmin.mockImplementation((_req: any, _res: any, next: any) => next());
    mockAdminFavoritesOverview.mockResolvedValue({
      favorites: [{
        id: 'f1',
        ownerDisplayName: '用户',
        userEmail: 'u@x.com',
        variantKey: 'ig',
        rating: 5,
        notes: null,
        favoriteReason: null,
        reasonTags: ['hook'],
        savedAt: '2026-07-14T00:00:00Z',
        brandName: '港饮',
        productName: null,
        copyType: 'spoken',
        platform: 'all',
        publishPlatform: null,
      }],
      total: 1,
    });
    // Fresh app import
    vi.resetModules();
    // Re-apply mocks after resetModules
    vi.doMock('../middleware/auth.js', () => ({
      requireAuth: (req: any, res: any, next: any) => mockRequireAuth(req, res, next),
    }));
    vi.doMock('../middleware/admin.js', () => ({
      requireAdmin: (req: any, res: any, next: any) => mockRequireAdmin(req, res, next),
      requireSuperAdmin: (_req: any, _res: any, next: any) => next(),
    }));
    vi.doMock('../services/adminService.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../services/adminService.js')>();
      return {
        ...actual,
        getAdminFavoritesOverview: (...args: unknown[]) => mockAdminFavoritesOverview(...args),
        adminFavoriteExists: (...args: unknown[]) => mockAdminFavoriteExists(...args),
        getAdminFavoriteDetail: (...args: unknown[]) => mockAdminFavoriteDetail(...args),
        writeAdminAuditLog: (...args: unknown[]) => mockWriteAdminAuditLog(...args),
        getAdminStats: vi.fn().mockResolvedValue({
          totalUsers: 1, activeSubscriptions: 0, totalGenerations: 0, totalFeedback: 0, adminUsers: 1,
        }),
      };
    });

    const express = (await import('express')).default;
    const adminRouter = (await import('../routes/admin.js')).default;
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
  });

  it('passes q to getAdminFavoritesOverview and returns metadata without content', async () => {
    const res = await request(app)
      .get('/api/admin/favorites')
      .query({ limit: 20, offset: 0, q: '  港饮  ' });

    expect(res.status).toBe(200);
    expect(mockAdminFavoritesOverview).toHaveBeenCalled();
    const args = mockAdminFavoritesOverview.mock.calls[0];
    // limit, offset, q (raw query string; service normalizes)
    expect(args[2]).toBe('  港饮  ');
    expect(res.body.favorites[0]).not.toHaveProperty('content');
    expect(res.body.total).toBe(1);
  });

  it('detail still audits before content and fails closed', async () => {
    mockAdminFavoriteExists.mockResolvedValue(true);
    mockWriteAdminAuditLog.mockResolvedValue(undefined);
    mockAdminFavoriteDetail.mockResolvedValue({
      id: 'f1',
      content: '正文',
      variantKey: 'ig',
      platform: 'all',
      publishPlatform: null,
      reasonTags: ['hook'],
    });

    const res = await request(app).get('/api/admin/favorites/f1');
    expect(res.status).toBe(200);
    expect(res.body.content).toBe('正文');
    expect(mockWriteAdminAuditLog.mock.invocationCallOrder[0])
      .toBeLessThan(mockAdminFavoriteDetail.mock.invocationCallOrder[0]);
  });
});

describe('static contract: list select excludes content', () => {
  it('adminService favorites list select does not include content', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../services/adminService.ts'),
      'utf-8',
    );
    const fnStart = src.indexOf('export async function getAdminFavoritesOverview');
    const fnEnd = src.indexOf('export async function adminFavoriteExists', fnStart);
    const body = src.slice(fnStart, fnEnd > 0 ? fnEnd : undefined);
    expect(body).toContain('id,owner_id,variant_key');
    expect(body).not.toMatch(/select\([^)]*\bcontent\b/);
    expect(body).toContain('normalizeAdminFavoriteQuery');
    expect(body).toContain('buildAdminFavoriteSearchOrFilter');
  });
});
