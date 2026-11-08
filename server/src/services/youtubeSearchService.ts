import type { HKPost } from '../types/index.js';
import { proxyFetch } from './proxyFetch.js';

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_CACHE_TTL_MS = 15 * 60 * 1000;

export type YoutubeFailureCode =
  | 'youtube_not_configured'
  | 'youtube_api_key_invalid'
  | 'youtube_quota_exceeded'
  | 'youtube_access_denied'
  | 'youtube_upstream_unavailable';

export class YoutubeServiceError extends Error {
  readonly code: YoutubeFailureCode;
  readonly upstreamStatus?: number;

  constructor(code: YoutubeFailureCode, upstreamStatus?: number) {
    super(code);
    this.name = 'YoutubeServiceError';
    this.code = code;
    this.upstreamStatus = upstreamStatus;
  }
}

interface YoutubeCacheEntry {
  expiresAt: number;
  posts: HKPost[];
}

const youtubeCache = new Map<string, YoutubeCacheEntry>();
const youtubeInflight = new Map<string, Promise<HKPost[]>>();

async function withYoutubeCache(key: string, loader: () => Promise<HKPost[]>): Promise<HKPost[]> {
  const now = Date.now();
  const cached = youtubeCache.get(key);
  if (cached && cached.expiresAt > now) return cached.posts;
  if (cached) youtubeCache.delete(key);

  const pending = youtubeInflight.get(key);
  if (pending) return pending;

  const request = loader()
    .then((posts) => {
      // Empty arrays usually mean missing configuration or an upstream failure.
      // Do not keep that state for the full TTL; allow the next request to retry.
      if (posts.length > 0) {
        youtubeCache.set(key, { posts, expiresAt: Date.now() + YOUTUBE_CACHE_TTL_MS });
      }
      return posts;
    })
    .finally(() => {
      youtubeInflight.delete(key);
    });

  youtubeInflight.set(key, request);
  return request;
}

/** Test-only reset; never exposes keys or cached content through an API route. */
export function clearYoutubeCacheForTests(): void {
  youtubeCache.clear();
  youtubeInflight.clear();
}

function getApiKey(): string | null {
  return process.env.YOUTUBE_API_KEY?.trim() || null;
}

function classifyYoutubeFailure(status: number, body: string): YoutubeServiceError {
  const normalized = body.toLowerCase();
  if (normalized.includes('api key not valid') || normalized.includes('keyinvalid')) {
    return new YoutubeServiceError('youtube_api_key_invalid', status);
  }
  if (
    normalized.includes('quotaexceeded')
    || normalized.includes('dailylimitexceeded')
    || normalized.includes('quota exceeded')
  ) {
    return new YoutubeServiceError('youtube_quota_exceeded', status);
  }
  if (status === 401 || status === 403) {
    return new YoutubeServiceError('youtube_access_denied', status);
  }
  return new YoutubeServiceError('youtube_upstream_unavailable', status);
}

function normalizeYoutubeException(error: unknown): YoutubeServiceError {
  if (error instanceof YoutubeServiceError) return error;
  return new YoutubeServiceError('youtube_upstream_unavailable');
}

/** Check if proxy is configured (for logging purposes) */
function proxyStatus(): string {
  const p = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
  return p ? `proxy=${p}` : 'direct (no proxy — Google API may be unreachable in mainland China)';
}

function mapYtItemToHKPost(item: Record<string, unknown>): HKPost {
  const snippet = (item.snippet ?? {}) as Record<string, unknown>;
  const statistics = (item.statistics ?? item.contentDetails) as Record<string, unknown> | undefined;
  const videoId = (item.id as string)
    ?? ((item.id as Record<string, unknown>)?.videoId as string)
    ?? 'unknown';

  return {
    id: `yt-${videoId}`,
    platform: 'youtube',
    type: 'organic',
    headline: (snippet.title as string) ?? '',
    body: (snippet.description as string)?.slice(0, 300) ?? '',
    hashtags: ((snippet.tags as string[]) ?? []).map((t: string) => t.replace(/^#/, '')),
    engagement: {
      likes: (statistics?.likeCount as number) ?? 0,
      comments: (statistics?.commentCount as number) ?? 0,
      views: (statistics?.viewCount as number) ?? 0,
    },
    url: `https://www.youtube.com/watch?v=${videoId}`,
    authorName: (snippet.channelTitle as string) ?? undefined,
    fetchedAt: new Date().toISOString(),
    publishedAt: (snippet.publishedAt as string) ?? undefined,
  };
}

/**
 * Fetch trending YouTube videos in HK region.
 * Requires YOUTUBE_API_KEY env var.
 */
async function fetchYoutubeTrending(categoryId?: string, limit = 12): Promise<HKPost[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[youtubeService] YOUTUBE_API_KEY not configured — trending unavailable');
    throw new YoutubeServiceError('youtube_not_configured');
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      chart: 'mostPopular',
      regionCode: 'HK',
      maxResults: String(Math.min(limit, 50)),
      key: apiKey,
    });

    if (categoryId) {
      params.set('videoCategoryId', categoryId);
    }

    const url = `${YT_API_BASE}/videos?${params}`;
    console.log(`[youtubeService] Fetching trending (${proxyStatus()})...`);
    const res = await proxyFetch(url, { timeout: 10000 });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const failure = classifyYoutubeFailure(res.status, body);
      console.warn(`[youtubeService] Trending API failed: status=${res.status} code=${failure.code}`);
      throw failure;
    }

    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    console.log(`[youtubeService] Trending returned ${items.length} videos`);
    return items.map(mapYtItemToHKPost);
  } catch (err) {
    const failure = normalizeYoutubeException(err);
    console.warn(`[youtubeService] Trending failed: code=${failure.code}`);
    throw failure;
  }
}

/**
 * Search YouTube for HK-relevant content.
 * Requires YOUTUBE_API_KEY env var.
 */
async function fetchYoutubeSearch(query: string, limit = 12): Promise<HKPost[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[youtubeService] YOUTUBE_API_KEY not configured — search unavailable');
    throw new YoutubeServiceError('youtube_not_configured');
  }

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      q: `${query} 香港`,
      type: 'video',
      regionCode: 'HK',
      relevanceLanguage: 'zh-HK',
      maxResults: String(Math.min(limit, 50)),
      key: apiKey,
    });

    const url = `${YT_API_BASE}/search?${params}`;
    const res = await proxyFetch(url, { timeout: 10000 });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const failure = classifyYoutubeFailure(res.status, body);
      console.warn(`[youtubeService] Search API failed: status=${res.status} code=${failure.code}`);
      throw failure;
    }

    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];

    // Get video IDs for statistics lookup
    const videoIds = items
      .map((item: Record<string, unknown>) => (item.id as Record<string, unknown>)?.videoId as string)
      .filter(Boolean)
      .join(',');

    // Try to get statistics in a separate call
    let statsMap: Record<string, Record<string, unknown>> = {};
    if (videoIds) {
      try {
        const statsParams = new URLSearchParams({
          part: 'statistics',
          id: videoIds,
          key: apiKey,
        });
        const statsRes = await proxyFetch(`${YT_API_BASE}/videos?${statsParams}`, {
          timeout: 8000,
        });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          for (const statItem of (statsData.items ?? [])) {
            statsMap[statItem.id as string] = statItem.statistics as Record<string, unknown>;
          }
        }
      } catch {
        // Statistics are optional — continue without them
      }
    }

    return items.map((item: Record<string, unknown>) => {
      const videoId = (item.id as Record<string, unknown>)?.videoId as string;
      const base = mapYtItemToHKPost(item);
      if (videoId && statsMap[videoId]) {
        base.engagement = {
          likes: (statsMap[videoId]?.likeCount as number) ?? 0,
          comments: (statsMap[videoId]?.commentCount as number) ?? 0,
          views: (statsMap[videoId]?.viewCount as number) ?? 0,
        };
      }
      return base;
    });
  } catch (err) {
    const failure = normalizeYoutubeException(err);
    console.warn(`[youtubeService] Search failed: code=${failure.code}`);
    throw failure;
  }
}

export function getYoutubeTrending(categoryId?: string, limit = 12): Promise<HKPost[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  const safeCategory = categoryId?.trim() || 'all';
  return withYoutubeCache(
    `trending:${safeCategory}:${safeLimit}`,
    () => fetchYoutubeTrending(categoryId, safeLimit),
  );
}

export function searchYoutube(query: string, limit = 12): Promise<HKPost[]> {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 50);
  return withYoutubeCache(
    `search:${normalizedQuery.toLocaleLowerCase('zh-HK')}:${safeLimit}`,
    () => fetchYoutubeSearch(normalizedQuery, safeLimit),
  );
}
