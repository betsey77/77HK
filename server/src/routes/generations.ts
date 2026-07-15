import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  upsertJob, listJobs, getJob, softDeleteJob, isJobWithinHistoryLimit,
} from '../services/generationJobsService.js';
import { FREE_HISTORY_LIMIT, resolveUserPlanId } from '../services/planAccessService.js';

const router = Router();

// All routes require auth
router.use(requireAuth);

// ============================================================
// Validation helpers
// ============================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,126}[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;

function validateUUID(id: string, field: string): void {
  if (!UUID_RE.test(id)) {
    throw new Error(`Invalid ${field}: must be a valid UUID`);
  }
}

function validateIdempotencyKey(key: string): void {
  if (!key || typeof key !== 'string' || key.length === 0 || key.length > 128) {
    throw new Error('idempotencyKey must be a string between 1 and 128 characters');
  }
  if (!IDEMPOTENCY_KEY_RE.test(key)) {
    throw new Error('idempotencyKey must contain only alphanumeric characters, hyphens, and underscores');
  }
}

function validateLimitOffset(limit: number, offset: number): void {
  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be an integer between 1 and 100');
  }
  if (!Number.isFinite(offset) || offset < 0) {
    throw new Error('offset must be a non-negative integer');
  }
}

function validateSearchQuery(query: string): void {
  if (query.length > 80) {
    throw new Error('search query must be 80 characters or fewer');
  }
  if (/[,%()\\]/.test(query)) {
    throw new Error('search query must be free of filter syntax');
  }
}

// ============================================================
// GET /api/generations — list user's non-deleted jobs
// ============================================================
router.get('/generations', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const jwt = req.userJwt as string;
    const rawLimit = (req.query.limit as string) ?? '';
    const rawOffset = (req.query.offset as string) ?? '';
    const limit = rawLimit !== '' ? Number(rawLimit) : 20;
    const offset = rawOffset !== '' ? Number(rawOffset) : 0;
    const rawQuery = req.query.q;
    if (rawQuery !== undefined && typeof rawQuery !== 'string') {
      throw new Error('search query must be a string');
    }
    const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';

    validateLimitOffset(limit, offset);
    validateSearchQuery(query);

    const planId = await resolveUserPlanId(userId);
    const result = await listJobs(jwt, userId, {
      limit,
      offset,
      ...(query ? { query } : {}),
      ...(planId === 'free' ? { accessLimit: FREE_HISTORY_LIMIT } : {}),
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('Invalid') || message.includes('must be') ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

// ============================================================
// GET /api/generations/:id — single job detail
// ============================================================
router.get('/generations/:id', async (req: Request, res: Response) => {
  try {
    const jwt = req.userJwt as string;
    const userId = req.userId as string;
    const jobId = req.params.id as string;

    validateUUID(jobId, 'id');

    const job = await getJob(jwt, jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const planId = await resolveUserPlanId(userId);
    if (
      planId === 'free'
      && !(await isJobWithinHistoryLimit(jwt, userId, jobId, FREE_HISTORY_LIMIT))
    ) {
      res.status(403).json({
        error: '该历史记录需要 Pro 解锁',
        code: 'PLAN_LIMIT',
      });
      return;
    }

    res.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('Invalid') || message.includes('must be') ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

// ============================================================
// DELETE /api/generations/:id — soft delete via SECURITY DEFINER RPC
// ============================================================
router.delete('/generations/:id', async (req: Request, res: Response) => {
  try {
    const jwt = req.userJwt as string;
    const jobId = req.params.id as string;

    validateUUID(jobId, 'id');

    const deleted = await softDeleteJob(jwt, jobId);
    if (!deleted) {
      // RPC returned false: not found, not owner, or already deleted.
      // Cross-user indistinguishable from not-found — no enumeration.
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('Invalid') || message.includes('must be') ? 400 : 500;
    res.status(status).json({ error: message });
  }
});

// ============================================================
// PATCH /api/generations/:id — REMOVED
// ============================================================
// The PATCH endpoint has been intentionally removed.
// Job status transitions happen ONLY server-side inside POST /api/generate:
//   pending → processing (markProcessing)
//   processing → completed (completeJob)
//   processing → failed (failJob)
// Browsers cannot inject arbitrary status/results via a BFF endpoint.
// If a trusted-write endpoint is needed later (C2), it should use a
// separate internal service with service_role, not the user-facing BFF.

export default router;
