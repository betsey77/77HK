/**
 * Admin Routes — Slice G1 (schema-matched).
 *
 * Read-only admin API. All routes require requireAuth + requireAdmin.
 * Named routes under /api/admin to avoid conflicts with user-facing routes.
 *
 * Security:
 * - No write operations (no DELETE, PATCH, PUT with mutation semantics).
 * - No passwords, tokens, or secrets in any response.
 * - Default lists do NOT return full generation body or feedback body.
 * - Body detail endpoint writes an audit_log entry BEFORE returning data (fail-closed).
 * - Pagination enforced: max 100 rows.
 * - Error messages are sanitized (no internal details exposed).
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';
import {
  getAdminStats,
  getAdminUsersOverview,
  getAdminGenerationMeta,
  adminGenerationExists,
  getAdminGenerationDetail,
  getAdminFeedbackSummary,
  getAdminSubscriptionsOverview,
  getAdminAuditLog,
  writeAdminAuditLog,
} from '../services/adminService.js';

const router = Router();

// Auth + admin middleware only applies to /api/admin/* routes
router.use('/admin', requireAuth);
router.use('/admin', requireAdmin);

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

// ── GET /api/admin/stats ───────────────────────────────────────

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await getAdminStats();
    res.json(stats);
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

export default router;
