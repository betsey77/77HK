import { Router } from 'express';
import type { Request, Response } from 'express';
import { searchCompetitorAds } from '../services/competitorService.js';
import type { CompetitorSearchRequest, CompetitorSearchResponse } from '../types/index.js';

const router = Router();

/**
 * POST /api/competitor/search
 * Search competitor ads from Meta Ad Library.
 * Falls back gracefully with empty array when the search service is unavailable.
 */
router.post('/competitor/search', async (req: Request, res: Response) => {
  try {
    const { query, country, platform, limit } = req.body as CompetitorSearchRequest;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ error: 'query is required' });
      return;
    }

    const ads = await searchCompetitorAds(
      query.trim(),
      country ?? 'HK',
      platform ?? 'facebook,instagram',
      limit ?? 10,
    );

    const result: CompetitorSearchResponse = {
      ads,
      query: query.trim(),
      totalFound: ads.length,
    };

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Competitor search failed';
    res.status(500).json({ error: message, ads: [], query: '', totalFound: 0 });
  }
});

export default router;
