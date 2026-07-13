/**
 * POST /api/feedback — submit user feedback
 * GET  /api/feedback — list own feedback
 *
 * Slice H1: User feedback center.
 * All routes require auth. Input is validated server-side.
 * Feedback is persisted first, notified best-effort second.
 * Notification failure never rolls back persisted feedback.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  validateFeedbackInput,
  createFeedback,
  getMyFeedback,
} from '../services/feedbackService.js';
import { createUserClient } from '../services/supabase.js';
import { getTrustedSupabase } from '../services/trustedSupabase.js';

const router = Router();

// All routes require auth
router.use(requireAuth);

// ── POST /api/feedback ─────────────────────────────────────────

router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const userEmail = req.userEmail as string | undefined;
    const userJwt = req.userJwt as string;

    // 严格输入校验（在 validateFeedbackInput 内部完成）
    const input = validateFeedbackInput(req.body);

    // 持久化 + 通知（trusted client 用于通知状态写回）
    const result = await createFeedback(
      userId, userEmail, userJwt, input, createUserClient,
      () => {
        try { return getTrustedSupabase(); } catch { return undefined; }
      },
    );

    // 始终返回 201——通知结果不影响 HTTP 状态码
    res.status(201).json({
      id: result.feedback.id,
      type: result.feedback.type,
      title: result.feedback.title,
      content: result.feedback.content,
      createdAt: result.feedback.created_at,
      // 通知状态脱敏：只返回 sent/failed，不返回 last_error（可能含脱敏但仍属服务端信息）
      notifyStatus: result.feedback.notify_status,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e?.status === 400) {
      res.status(400).json({ error: e.message });
      return;
    }
    if (e?.status === 429) {
      res.status(429).json({ error: e.message });
      return;
    }
    // 500 — 不泄漏内部细节
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/feedback ──────────────────────────────────────────

router.get('/feedback', async (req: Request, res: Response) => {
  try {
    const userId = req.userId as string;
    const userJwt = req.userJwt as string;

    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
    const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;

    if (isNaN(limit) || limit < 1 || limit > 100) {
      res.status(400).json({ error: 'limit must be between 1 and 100' });
      return;
    }
    if (isNaN(offset) || offset < 0) {
      res.status(400).json({ error: 'offset must be >= 0' });
      return;
    }

    const result = await getMyFeedback(userId, userJwt, createUserClient, limit, offset);

    res.json({
      items: result.items.map(f => ({
        id: f.id,
        type: f.type,
        title: f.title,
        content: f.content,
        notifyStatus: f.notify_status,
        createdAt: f.created_at,
      })),
      total: result.total,
    });
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e?.status === 400) {
      res.status(400).json({ error: e.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
