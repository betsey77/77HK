import { Router } from 'express';
import type { Request, Response } from 'express';
import { getYoutubeTrending, searchYoutube } from '../services/youtubeSearchService.js';
import type { YoutubeTrendingRequest, YoutubeSearchRequest } from '../types/index.js';

const router = Router();

/**
 * POST /api/inspiration/language-vibe
 * Returns YouTube HK content as Cantonese language style references.
 * Uses multiple search queries to capture different content categories.
 * Falls back gracefully when external APIs are unavailable.
 *
 * Data sources (all via YouTube Data API v3):
 *   - HK food/lifestyle search queries (Cantonese-language content)
 *   - HK trending videos (real-time popular content in HK)
 *
 * Note: IG scraping was replaced because Instagram blocks server-side requests.
 * YouTube API provides sufficient HK Cantonese content for language reference.
 */
router.post('/inspiration/language-vibe', async (_req: Request, res: Response) => {
  try {
    // Search HK-relevant content categories via YouTube (Cantonese language filter)
    const [food, lifestyle, beauty, trending] = await Promise.all([
      searchYoutube('香港美食 試食', 3).catch(() => []),
      searchYoutube('香港生活 開箱', 3).catch(() => []),
      searchYoutube('香港 好物推介', 2).catch(() => []),
      getYoutubeTrending(undefined, 4).catch(() => []),
    ]);

    const posts = [...food, ...lifestyle, ...beauty, ...trending];

    res.json({
      posts,
      fetchedAt: new Date().toISOString(),
      source: {
        youtube: posts.length > 0 ? 'available' : 'unavailable',
        method: 'YouTube Data API v3 (search + trending, relevanceLanguage=zh-HK)',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Language vibe fetch failed';
    res.status(500).json({ error: message, posts: [] });
  }
});

/**
 * POST /api/inspiration/hot-trends
 * Returns trending content from YouTube (HK region) with metadata.
 * Uses multiple search angles to capture diverse trending topics.
 */
router.post('/inspiration/hot-trends', async (_req: Request, res: Response) => {
  try {
    const [trending, hotSearch, latestSearch] = await Promise.all([
      getYoutubeTrending(undefined, 6).catch(() => []),
      searchYoutube('香港熱門話題 2026', 3).catch(() => []),
      searchYoutube('香港 最新 趨勢', 3).catch(() => []),
    ]);

    const posts = [...trending, ...hotSearch, ...latestSearch];

    res.json({
      posts,
      fetchedAt: new Date().toISOString(),
      source: {
        youtube: posts.length > 0 ? 'available' : 'unavailable',
        method: 'YouTube Data API v3 (trending HK + search queries)',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Hot trends fetch failed';
    res.status(500).json({ error: message, posts: [] });
  }
});

/**
 * POST /api/inspiration/youtube-search
 * Search YouTube for HK-relevant content.
 */
router.post('/inspiration/youtube-search', async (req: Request, res: Response) => {
  try {
    const { query, limit } = req.body as YoutubeSearchRequest;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ error: 'query is required' });
      return;
    }

    const videos = await searchYoutube(query.trim(), limit ?? 12);

    res.json({ videos });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'YouTube search failed';
    res.status(500).json({ error: message, videos: [] });
  }
});

/**
 * POST /api/inspiration/youtube-trending
 * Returns trending YouTube videos in HK.
 */
router.post('/inspiration/youtube-trending', async (req: Request, res: Response) => {
  try {
    const { categoryId, limit } = req.body as YoutubeTrendingRequest;

    const videos = await getYoutubeTrending(categoryId, limit ?? 12);

    res.json({ videos });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'YouTube trending fetch failed';
    res.status(500).json({ error: message, videos: [] });
  }
});

export default router;
