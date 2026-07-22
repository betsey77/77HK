import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  applyDailyCheckIn,
  claimCheckInMembershipGrant,
  getCheckInStatus,
} from '../services/checkInService.js';

const router = Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function respondWithFailure(error: unknown, res: Response): void {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? error.code
    : null;
  if (code === 'CHECK_IN_UNAVAILABLE') {
    res.status(503).json({ error: 'Check-in service temporarily unavailable' });
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
}

router.get('/me/check-in', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await getCheckInStatus(req.userId!));
  } catch (error) {
    respondWithFailure(error, res);
  }
});

router.post('/me/check-in', requireAuth, async (req: Request, res: Response) => {
  try {
    res.json(await applyDailyCheckIn(req.userId!));
  } catch (error) {
    respondWithFailure(error, res);
  }
});

router.post(
  '/me/membership-grants/:id/claim',
  requireAuth,
  async (req: Request, res: Response) => {
    const rawGrantId = req.params.id;
    const grantId = Array.isArray(rawGrantId) ? rawGrantId[0] : rawGrantId;
    if (!UUID_PATTERN.test(grantId)) {
      res.status(400).json({ error: 'Invalid grant id', code: 'INVALID_GRANT_ID' });
      return;
    }

    try {
      const result = await claimCheckInMembershipGrant(req.userId!, grantId);
      if (!result.success && result.reason === 'not_found') {
        res.status(404).json({ error: 'Reward not found', code: 'REWARD_NOT_FOUND' });
        return;
      }
      if (!result.success && result.reason === 'active_pro') {
        res.status(409).json({
          error: 'Current Pro period is still active',
          code: 'ACTIVE_PRO',
          grantStatus: result.grantStatus,
          subscriptionExpiresAt: result.subscriptionExpiresAt,
        });
        return;
      }
      res.json(result);
    } catch (error) {
      respondWithFailure(error, res);
    }
  },
);

export default router;
