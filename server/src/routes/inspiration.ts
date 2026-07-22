import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  getYoutubeTrending,
  searchYoutube,
  YoutubeServiceError,
  type YoutubeFailureCode,
} from '../services/youtubeSearchService.js';
import type { YoutubeTrendingRequest, YoutubeSearchRequest } from '../types/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

interface YoutubeBatchResult {
  posts: Awaited<ReturnType<typeof getYoutubeTrending>>;
  failureCode: YoutubeFailureCode | null;
}

const FAILURE_PRIORITY: YoutubeFailureCode[] = [
  'youtube_api_key_invalid',
  'youtube_quota_exceeded',
  'youtube_access_denied',
  'youtube_not_configured',
  'youtube_upstream_unavailable',
];

async function resolveYoutubeBatch(requests: Promise<Awaited<ReturnType<typeof getYoutubeTrending>>>[]): Promise<YoutubeBatchResult> {
  const settled = await Promise.allSettled(requests);
  const posts = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  const failureCodes = settled.flatMap((result) => (
    result.status === 'rejected' && result.reason instanceof YoutubeServiceError
      ? [result.reason.code]
      : []
  ));
  const failureCode = FAILURE_PRIORITY.find((code) => failureCodes.includes(code)) ?? null;
  return { posts, failureCode };
}

function youtubeFailureBody(reason: YoutubeFailureCode, emptyKey: 'posts' | 'videos') {
  return {
    error: 'youtube_unavailable',
    reason,
    [emptyKey]: [],
  };
}

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
router.post('/inspiration/language-vibe', requireAuth, async (_req: Request, res: Response) => {
  try {
    // Search HK-relevant content categories via YouTube (Cantonese language filter)
    const { posts, failureCode } = await resolveYoutubeBatch([
      searchYoutube('香港美食 試食', 3),
      searchYoutube('香港生活 開箱', 3),
      searchYoutube('香港 好物推介', 2),
      getYoutubeTrending(undefined, 4),
    ]);

    if (posts.length === 0 && failureCode) {
      res.status(502).json(youtubeFailureBody(failureCode, 'posts'));
      return;
    }

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
router.post('/inspiration/hot-trends', requireAuth, async (_req: Request, res: Response) => {
  try {
    const { posts, failureCode } = await resolveYoutubeBatch([
      getYoutubeTrending(undefined, 6),
      searchYoutube('香港熱門話題 2026', 3),
      searchYoutube('香港 最新 趨勢', 3),
    ]);

    if (posts.length === 0 && failureCode) {
      res.status(502).json(youtubeFailureBody(failureCode, 'posts'));
      return;
    }

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
router.post('/inspiration/youtube-search', requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, limit } = req.body as YoutubeSearchRequest;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      res.status(400).json({ error: 'query is required' });
      return;
    }

    const videos = await searchYoutube(query.trim(), limit ?? 12);

    res.json({ videos });
  } catch (err) {
    if (err instanceof YoutubeServiceError) {
      res.status(502).json(youtubeFailureBody(err.code, 'videos'));
      return;
    }
    const message = err instanceof Error ? err.message : 'YouTube search failed';
    res.status(500).json({ error: message, videos: [] });
  }
});

/**
 * POST /api/inspiration/youtube-trending
 * Returns trending YouTube videos in HK.
 */
router.post('/inspiration/youtube-trending', requireAuth, async (req: Request, res: Response) => {
  try {
    const { categoryId, limit } = req.body as YoutubeTrendingRequest;

    const videos = await getYoutubeTrending(categoryId, limit ?? 12);

    res.json({ videos });
  } catch (err) {
    if (err instanceof YoutubeServiceError) {
      res.status(502).json(youtubeFailureBody(err.code, 'videos'));
      return;
    }
    const message = err instanceof Error ? err.message : 'YouTube trending fetch failed';
    res.status(500).json({ error: message, videos: [] });
  }
});

export default router;
