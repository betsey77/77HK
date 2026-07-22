/**
 * Admin Routes — Slice G1 (schema-matched) + R1 favorite review writes.
 *
 * All routes require requireAuth + requireAdmin.
 * Named routes under /api/admin to avoid conflicts with user-facing routes.
 *
 * Security:
 * - Favorite list/detail enforce review_group scope in the service layer
 *   (service_role bypasses RLS; must re-check).
 * - Only allowed write: PUT /favorites/:id/review via atomic RPC.
 * - No passwords, tokens, or secrets in any response.
 * - Default lists do NOT return full generation body or feedback body.
 * - Body detail endpoint writes an audit_log entry BEFORE returning data (fail-closed).
 * - Pagination enforced: max 100 rows.
 * - Error messages are sanitized (no internal details exposed).
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin, requireSuperAdmin } from '../middleware/admin.js';
import {
  AdminMetricsError,
  getAdminBadCaseModelAttempts,
  getAdminBadCases,
  getAdminMetricsOverview,
  getAdminModelMetrics,
  parseAdminMetricsRange,
} from '../services/adminMetricsService.js';
import { getDeepSeekProviderBalance } from '../services/providerBalanceService.js';
import {
  getAdminStats,
  getAdminActorReviewGroup,
  getAdminUsersOverview,
  getAdminGenerationMeta,
  adminGenerationExists,
  getAdminGenerationDetail,
  getAdminFeedbackSummary,
  getAdminSubscriptionsOverview,
  getAdminAuditLog,
  getAdminFavoritesOverview,
  getAdminPendingReviewSummary,
  adminFavoriteExists,
  getAdminFavoriteDetail,
  adminCaseLibraryExists,
  getAdminCaseLibraryDetail,
  writeAdminAuditLog,
  updateAdminFavoriteReview,
  AdminFavoriteReviewError,
  type AdminFavoriteActorScope,
  type AdminReviewStatus,
} from '../services/adminService.js';
import {
  BadCaseReviewPackError,
  assertUuid,
  getReviewPackScope,
  isReviewPackVisible,
  listReviewPacksMeta,
  getReviewPackDiagnostics,
  loadReviewPackDetailBody,
  assignReviewPack,
  transitionReviewPackStatus,
  reviewFinding,
  requestPackAnalysis,
  createFindingProposal,
} from '../services/badCaseReviewPackService.js';

const router = Router();

// Auth + admin middleware applies to ALL routes in this router.
// Mounted at /api/admin in app.ts, so every handler under this router
// is protected by both requireAuth and requireAdmin.
router.use(requireAuth);
router.use(requireAdmin);

// ── Helpers ────────────────────────────────────────────────────

function sanitizeError(err: unknown): string {
  if (err instanceof Error) {
    // Only expose generic messages; never stack traces or DB details
    return 'Internal server error';
  }
  return 'Internal server error';
}

function parsePagination(req: Request): { limit: number; offset: number } {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const offset = req.query.offset ? Number(req.query.offset) : undefined;
  return { limit: limit ?? 20, offset: offset ?? 0 };
}

function actorScopeFromReq(req: Request): AdminFavoriteActorScope {
  return {
    actorId: req.userId as string,
    actorRole: (req.userRole === 'super_admin' ? 'super_admin' : 'admin'),
  };
}

const REVIEW_BODY_ALLOW = new Set(['status', 'note', 'annotations']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── GET /api/admin/stats ───────────────────────────────────────

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [stats, reviewGroup] = await Promise.all([
      getAdminStats(),
      getAdminActorReviewGroup(req.userId as string),
    ]);
    // role is server-verified via requireAdmin (req.userRole); never trust client.
    res.json({ ...stats, role: req.userRole ?? 'admin', reviewGroup });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── GET /api/admin/metrics/overview — group-scoped operational metrics ──

router.get('/metrics/overview', async (req: Request, res: Response) => {
  try {
    const range = parseAdminMetricsRange(req.query.from, req.query.to);
    const overview = await getAdminMetricsOverview({
      actorId: req.userId as string,
      actorRole: req.userRole === 'super_admin' ? 'super_admin' : 'admin',
    }, range);
    res.json(overview);
  } catch (err) {
    if (err instanceof AdminMetricsError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── Super-admin-only model health, bad cases and official balance ──

router.get('/metrics/models', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const range = parseAdminMetricsRange(req.query.from, req.query.to);
    res.json(await getAdminModelMetrics(range));
  } catch (err) {
    if (err instanceof AdminMetricsError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.get('/metrics/bad-cases', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const range = parseAdminMetricsRange(req.query.from, req.query.to);
    res.json(await getAdminBadCases(range));
  } catch (err) {
    if (err instanceof AdminMetricsError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.get('/metrics/bad-cases/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    if (typeof jobId !== 'string' || !UUID_PATTERN.test(jobId)) {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    const scope = actorScopeFromReq(req);
    if (!(await adminGenerationExists(jobId, scope))) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    try {
      await writeAdminAuditLog({
        actorId: req.userId as string,
        actorRole: req.userRole as string | undefined,
        action: 'admin_view_bad_case_detail',
        entity: 'generation_jobs',
        entityId: jobId,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    const job = await getAdminGenerationDetail(jobId, scope);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const modelAttempts = await getAdminBadCaseModelAttempts(jobId);
    res.json({ job, modelAttempts });
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.get('/metrics/provider-balance', requireSuperAdmin, async (_req: Request, res: Response) => {
  res.json(await getDeepSeekProviderBalance());
});

// ── 2.1 Slice E3: Bad Case review packs (super_admin only) ────

function superAdminActor(req: Request) {
  return {
    actorId: req.userId as string,
    actorRole: 'super_admin' as const,
  };
}

function mapReviewPackError(err: unknown, res: Response): boolean {
  if (err instanceof BadCaseReviewPackError) {
    res.status(err.status).json({ error: err.code });
    return true;
  }
  return false;
}

router.get('/bad-case-review-packs', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req);
    const result = await listReviewPacksMeta({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      ownerTeam: typeof req.query.ownerTeam === 'string' ? req.query.ownerTeam : undefined,
      triggerKind: typeof req.query.triggerKind === 'string' ? req.query.triggerKind : undefined,
      limit,
      offset,
    });
    res.json(result);
  } catch (err) {
    if (mapReviewPackError(err, res)) return;
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.get('/bad-case-review-packs/diagnostics', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const range = parseAdminMetricsRange(req.query.from, req.query.to);
    res.json(await getReviewPackDiagnostics(range));
  } catch (err) {
    if (err instanceof AdminMetricsError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    if (mapReviewPackError(err, res)) return;
    res.status(500).json({ error: sanitizeError(err) });
  }
});

/**
 * Detail: strict scope -> audit -> recheck -> body (fail-closed).
 * Never read sample body before successful audit write.
 */
router.get('/bad-case-review-packs/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    let packId: string;
    try {
      packId = assertUuid(req.params.id);
    } catch {
      res.status(400).json({ error: 'Invalid pack ID' });
      return;
    }

    // 1. Scope only (id + generation_job_id + subject_owner_id) + visibility
    const scope = await getReviewPackScope(packId);
    if (!scope || !(await isReviewPackVisible(scope))) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    // 2. Audit — fail closed before any body read
    try {
      await writeAdminAuditLog({
        actorId: req.userId as string,
        actorRole: req.userRole as string | undefined,
        action: 'admin_view_bad_case_review_pack',
        entity: 'bad_case_review_packs',
        entityId: packId,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    // 3. Recheck same scope
    const scope2 = await getReviewPackScope(packId);
    if (
      !scope2
      || scope2.generationJobId !== scope.generationJobId
      || scope2.subjectOwnerId !== scope.subjectOwnerId
      || !(await isReviewPackVisible(scope2))
    ) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    // 4. Body only after audit + recheck
    const detail = await loadReviewPackDetailBody(scope2);
    if (!detail) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.json(detail);
  } catch (err) {
    if (mapReviewPackError(err, res)) return;
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.post('/bad-case-review-packs/:id/assign', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const result = await assignReviewPack(superAdminActor(req), String(req.params.id), req.body);
    res.json(result);
  } catch (err) {
    if (mapReviewPackError(err, res)) return;
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.post('/bad-case-review-packs/:id/status', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const result = await transitionReviewPackStatus(superAdminActor(req), String(req.params.id), req.body);
    res.json(result);
  } catch (err) {
    if (mapReviewPackError(err, res)) return;
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.post('/bad-case-review-packs/:id/analyze', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    // Reject untrusted actor fields on empty body payloads too
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      const keys = Object.keys(req.body as object);
      if (keys.some((k) => ['actorId', 'actor_id', 'actorRole', 'ownerId', 'role'].includes(k))) {
        res.status(400).json({ error: 'INVALID_INPUT' });
        return;
      }
    }
    const result = await requestPackAnalysis(superAdminActor(req), String(req.params.id));
    res.json(result);
  } catch (err) {
    if (mapReviewPackError(err, res)) return;
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.post('/bad-case-findings/:id/review', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const result = await reviewFinding(superAdminActor(req), String(req.params.id), req.body);
    res.json(result);
  } catch (err) {
    if (mapReviewPackError(err, res)) return;
    res.status(500).json({ error: sanitizeError(err) });
  }
});

router.post('/bad-case-findings/:id/proposal', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const result = await createFindingProposal(superAdminActor(req), String(req.params.id), req.body);
    res.json(result);
  } catch (err) {
    if (mapReviewPackError(err, res)) return;
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── GET /api/admin/users ───────────────────────────────────────

router.get('/users', async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req);
    const result = await getAdminUsersOverview(limit, offset);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── GET /api/admin/generations ─────────────────────────────────

router.get('/generations', async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req);
    const result = await getAdminGenerationMeta(limit, offset, actorScopeFromReq(req));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── GET /api/admin/generations/:id — drill-down with audit log BEFORE body read ─

router.get('/generations/:id', async (req: Request, res: Response) => {
  try {
    const jobId = req.params.id;
    if (!jobId || typeof jobId !== 'string') {
      res.status(400).json({ error: 'Invalid job ID' });
      return;
    }

    // Step 1: Confirm resource existence WITHOUT reading body content
    const scope = actorScopeFromReq(req);
    const exists = await adminGenerationExists(jobId, scope);
    if (!exists) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Step 2: Write audit log BEFORE reading body (fail-closed).
    // If audit write fails, the full body is never read.
    try {
      const actorId = req.userId as string;
      const actorRole = req.userRole as string | undefined;
      await writeAdminAuditLog({
        actorId,
        actorRole,
        action: 'admin_view_generation_detail',
        entity: 'generation_jobs',
        entityId: jobId,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    // Step 3: Only now read the full body — after audit is confirmed written
    const job = await getAdminGenerationDetail(jobId, scope);
    if (!job) {
      // Edge case: deleted between existence check and detail read
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json(job);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── GET /api/admin/feedback ────────────────────────────────────

router.get('/feedback', async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req);
    const result = await getAdminFeedbackSummary(limit, offset);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── GET /api/admin/subscriptions ───────────────────────────────

router.get('/subscriptions', async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req);
    const result = await getAdminSubscriptionsOverview(limit, offset);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── GET /api/admin/audit-log ───────────────────────────────────

router.get('/audit-log', async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req);
    const result = await getAdminAuditLog(limit, offset);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── GET /api/admin/favorites — metadata only, no copy body ─────

router.get('/favorites', async (req: Request, res: Response) => {
  try {
    const { limit, offset } = parsePagination(req);
    // Optional metadata search (`q`); never selects or returns content.
    // Ordinary admin is scoped to same review_group owners.
    const result = await getAdminFavoritesOverview(
      limit,
      offset,
      req.query.q,
      actorScopeFromReq(req),
      req.query.pendingOnly === 'true',
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── GET /api/admin/favorites/pending-summary — count/timestamp only ─
// Keep this named route before /favorites/:id.
router.get('/favorites/pending-summary', async (req: Request, res: Response) => {
  try {
    const result = await getAdminPendingReviewSummary(actorScopeFromReq(req));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── GET /api/admin/favorites/:id — audited read-only detail ────

router.get('/favorites/:id', async (req: Request, res: Response) => {
  try {
    const favoriteId = req.params.id;
    if (!favoriteId || typeof favoriteId !== 'string') {
      res.status(400).json({ error: 'Invalid favorite ID' });
      return;
    }

    const scope = actorScopeFromReq(req);

    // Scope/exists first — cross-group → 404, no audit, no body.
    const exists = await adminFavoriteExists(favoriteId, scope);
    if (!exists) {
      res.status(404).json({ error: 'Favorite not found' });
      return;
    }

    try {
      await writeAdminAuditLog({
        actorId: req.userId as string,
        actorRole: req.userRole,
        action: 'admin_view_favorite_detail',
        entity: 'favorites',
        entityId: favoriteId,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    const favorite = await getAdminFavoriteDetail(favoriteId, scope);
    if (!favorite) {
      res.status(404).json({ error: 'Favorite not found' });
      return;
    }
    res.json(favorite);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── PUT /api/admin/favorites/:id/review — atomic review upsert/clear ─

router.put('/favorites/:id/review', async (req: Request, res: Response) => {
  try {
    const favoriteId = req.params.id;
    if (!favoriteId || typeof favoriteId !== 'string') {
      res.status(400).json({ error: 'Invalid favorite ID' });
      return;
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const keys = Object.keys(body as Record<string, unknown>);
    if (keys.some((k) => !REVIEW_BODY_ALLOW.has(k))) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    if (!('status' in (body as object))) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const statusRaw = (body as { status: unknown }).status;
    let status: AdminReviewStatus | null;
    if (statusRaw === null) {
      status = null;
    } else if (statusRaw === 'adopted' || statusRaw === 'changes_requested') {
      status = statusRaw;
    } else {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const note = (body as { note?: unknown }).note;
    const annotations = (body as { annotations?: unknown }).annotations;

    const result = await updateAdminFavoriteReview(
      actorScopeFromReq(req),
      favoriteId,
      status,
      note,
      annotations,
    );
    res.json(result);
  } catch (err) {
    if (err instanceof AdminFavoriteReviewError) {
      res.status(err.status).json({ error: err.status === 404 ? 'Favorite not found' : err.message });
      return;
    }
    res.status(500).json({ error: sanitizeError(err) });
  }
});

// ── GET /api/admin/case-library/:id — super_admin only, audited body ─

router.get('/case-library/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const caseId = req.params.id;
    if (!caseId || typeof caseId !== 'string') {
      res.status(400).json({ error: 'Invalid case ID' });
      return;
    }

    // Step 1: existence only (soft-deleted → not found)
    const exists = await adminCaseLibraryExists(caseId);
    if (!exists) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    // Step 2: audit before body read (fail-closed)
    try {
      await writeAdminAuditLog({
        actorId: req.userId as string,
        actorRole: req.userRole,
        action: 'admin_view_case_library_detail',
        entity: 'case_library_entries',
        entityId: caseId,
      });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    // Step 3: allowlist body read only after durable audit
    const detail = await getAdminCaseLibraryDetail(caseId);
    if (!detail) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }
    res.json(detail);
  } catch (err) {
    res.status(500).json({ error: sanitizeError(err) });
  }
});

export default router;
