import type { HKPost } from '../types/index.js';
import { proxyFetch } from './proxyFetch.js';

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

function getApiKey(): string | null {
  return process.env.YOUTUBE_API_KEY ?? null;
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
export async function getYoutubeTrending(categoryId?: string, limit = 12): Promise<HKPost[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[youtubeService] YOUTUBE_API_KEY not configured — trending unavailable');
    return [];
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
      console.warn(`[youtubeService] Trending API returned ${res.status}: ${body.slice(0, 200)}`);
      return [];
    }

    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];
    console.log(`[youtubeService] Trending returned ${items.length} videos`);
    return items.map(mapYtItemToHKPost);
  } catch (err) {
    console.warn('[youtubeService] Trending failed:', (err as Error).message);
    return [];
  }
}

/**
 * Search YouTube for HK-relevant content.
 * Requires YOUTUBE_API_KEY env var.
 */
export async function searchYoutube(query: string, limit = 12): Promise<HKPost[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('[youtubeService] YOUTUBE_API_KEY not configured — search unavailable');
    return [];
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
      console.warn(`[youtubeService] Search API returned ${res.status}`);
      return [];
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
    console.warn('[youtubeService] Search failed:', (err as Error).message);
    return [];
  }
}
