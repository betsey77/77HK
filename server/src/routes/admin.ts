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
  getAdminStats,
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

// ── GET /api/admin/stats ───────────────────────────────────────

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getAdminStats();
    // role is server-verified via requireAdmin (req.userRole); never trust client.
    res.json({ ...stats, role: req.userRole ?? 'admin' });
  } catch (err) {
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
    const result = await getAdminGenerationMeta(limit, offset);
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
    const exists = await adminGenerationExists(jobId);
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
    const job = await getAdminGenerationDetail(jobId);
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
