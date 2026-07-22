import { Router } from 'express';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { parsePersonasFromText } from '../services/deepseekService.js';
import { createEmptyPersona } from '../services/personaService.js';
import { requireAuth } from '../middleware/auth.js';
import type { ModelCallContext } from '../services/telemetryService.js';

const router = Router();

function createModelCallContext(): ModelCallContext {
  return { jobId: null, requestId: randomUUID() };
}

router.post('/parse-personas', requireAuth, async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text?: string };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'text is required and must be a non-empty string' });
      return;
    }

    if (text.trim().length < 10) {
      res.status(400).json({ error: 'text is too short — please provide at least 10 characters describing your target consumers' });
      return;
    }

    const modelCallContext = createModelCallContext();
    const personas = await parsePersonasFromText(text.trim(), modelCallContext);

    if (!personas || personas.length === 0) {
      // Return a single empty persona as fallback
      res.json({ personas: [createEmptyPersona()] });
      return;
    }

    res.json({ personas: personas.slice(0, 1) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

export default router;
