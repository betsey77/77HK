/**
 * W2 — Personal case library BFF
 *
 * GET    /api/case-library?query=&caseType=
 * POST   /api/case-library
 * PATCH  /api/case-library/:id
 * DELETE /api/case-library/:id  (soft delete)
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createUserClient } from '../services/supabase.js';
import {
  validateCaseLibraryInput,
  listCaseLibrary,
  createCaseLibraryEntry,
  updateCaseLibraryEntry,
  softDeleteCaseLibraryEntry,
  CaseLibraryHttpError,
  VALID_CASE_TYPES,
  type CaseType,
} from '../services/caseLibraryService.js';

const router = Router();

router.use(requireAuth);

function handleError(res: Response, err: unknown): void {
  const e = err instanceof CaseLibraryHttpError ? err : null;
  // Mapped safe client-facing business errors (validation / authz / not found)
  if (e?.status === 400) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
    return;
  }
  if (e?.status === 403) {
    res.status(403).json({ error: e.message ?? 'Forbidden' });
    return;
  }
  if (e?.status === 404) {
    res.status(404).json({ error: e.message ?? 'Not found' });
    return;
  }
  // Service-layer mapped 500s (httpError with intentional safe copy) only.
  // Unknown throws (no status) must never leak e.message.
  if (e && e.status >= 500 && e.message) {
    res.status(e.status).json({ error: e.message });
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
}

// GET /api/case-library
router.get('/case-library', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const userJwt = req.userJwt as string;

    let caseType: CaseType | undefined;
    if (typeof req.query.caseType === 'string' && req.query.caseType.trim()) {
      if (!VALID_CASE_TYPES.includes(req.query.caseType as CaseType)) {
        res.status(400).json({ error: "caseType must be 'good' or 'bad'" });
        return;
      }
      caseType = req.query.caseType as CaseType;
    }

    const query = typeof req.query.query === 'string' ? req.query.query : undefined;

    const items = await listCaseLibrary(userId, userJwt, createUserClient, {
      query,
      caseType,
    });
    res.json({ items });
  } catch (err) {
    handleError(res, err);
  }
});

// POST /api/case-library
router.post('/case-library', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const userJwt = req.userJwt as string;
    const input = validateCaseLibraryInput(req.body);
    const item = await createCaseLibraryEntry(userId, userJwt, createUserClient, input);
    res.status(201).json(item);
  } catch (err) {
    handleError(res, err);
  }
});

// PATCH /api/case-library/:id
router.patch('/case-library/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const userJwt = req.userJwt as string;
    const id = req.params.id as string;
    const input = validateCaseLibraryInput(req.body);
    const item = await updateCaseLibraryEntry(userId, userJwt, createUserClient, id, input);
    res.json(item);
  } catch (err) {
    handleError(res, err);
  }
});

// DELETE /api/case-library/:id — soft delete
router.delete('/case-library/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const userJwt = req.userJwt as string;
    const id = req.params.id as string;
    await softDeleteCaseLibraryEntry(userId, userJwt, createUserClient, id);
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
