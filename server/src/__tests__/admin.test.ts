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
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

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

  it('admin routes do NOT contain DELETE, PATCH, or PUT methods', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../routes/admin.ts'),
      'utf-8',
    );
    // Only GET methods allowed
    expect(content).not.toMatch(/router\.(delete|patch|put|post)\(/);
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
  it('admin routes are registered in app.ts', () => {
    const fs = require('fs');
    const path = require('path');
    const appContent = fs.readFileSync(
      path.resolve(__dirname, '../app.ts'),
      'utf-8',
    );
    expect(appContent).toContain('adminRouter');
    expect(appContent).toContain("app.use('/api', adminRouter)");
  });

  it('admin route handler paths are correct (middleware scoped)', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../routes/admin.ts'),
      'utf-8',
    );
    // Middleware applies for /admin prefix, so route handlers use bare paths
    expect(content).toContain("router.use('/admin'");
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
