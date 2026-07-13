import { Router } from 'express';
import type { Request, Response } from 'express';
import { quickCheck } from '../services/quickCheckService.js';
import type { Variants } from '../types/index.js';

const router = Router();

/**
 * POST /api/quick-check
 * Run local rules-based checks on generated variants.
 * Pure local computation — no AI call, always fast.
 */
router.post('/quick-check', async (req: Request, res: Response) => {
  try {
    const { variants, brandName, brandRedLines, platform } = req.body as {
      variants?: Variants;
      brandName?: string;
      brandRedLines?: string;
      platform?: string;
    };

    if (!variants) {
      res.status(400).json({ error: 'variants is required' });
      return;
    }

    const requiredKeys = ['standardHK', 'lightCantonese', 'ig', 'facebook', 'shorts'];
    for (const key of requiredKeys) {
      if (typeof (variants as unknown as Record<string, unknown>)[key] !== 'string') {
        res.status(400).json({ error: `variants.${key} is required and must be a string` });
        return;
      }
    }

    const result = quickCheck(variants, { brandName, brandRedLines, platform });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Quick check failed';
    res.status(500).json({ error: message });
  }
});

export default router;
