import { Router } from 'express';
import type { Request, Response } from 'express';
import { matchCalendarEvents } from '../services/calendarData.js';
import type { CalendarRequest, CalendarResponse } from '../types/index.js';

const router = Router();

/**
 * POST /api/inspiration/calendar
 * Returns HK local topic calendar events matching an optional target date and industry.
 */
router.post('/inspiration/calendar', async (req: Request, res: Response) => {
  try {
    const { targetDate, industry } = req.body as CalendarRequest;

    const events = matchCalendarEvents(targetDate, industry);

    const result: CalendarResponse = {
      events,
      matchedCount: events.length,
    };

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Calendar fetch failed';
    res.status(500).json({ error: message });
  }
});

export default router;
