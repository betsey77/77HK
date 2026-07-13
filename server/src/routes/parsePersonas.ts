import { Router } from 'express';
import type { Request, Response } from 'express';
import { parsePersonasFromText } from '../services/deepseekService.js';
import { createEmptyPersona } from '../services/personaService.js';

const router = Router();

router.post('/parse-personas', async (req: Request, res: Response) => {
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

    const personas = await parsePersonasFromText(text.trim());

    if (!personas || personas.length === 0) {
      // Return a single empty persona as fallback
      res.json({ personas: [createEmptyPersona()] });
      return;
    }

    res.json({ personas });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ error: message });
  }
});

export default router;
