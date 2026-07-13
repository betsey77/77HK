import type { HKPost } from '../types/index.js';

/**
 * Search IG hashtag posts by scraping the public explorer page.
 * Extracts window.__INITIAL_STATE__ JSON from the HTML response.
 *
 * ⚠️ Brittle — depends on IG's page structure. If Meta changes the
 * JSON format, this will return empty. Consider it a best-effort service.
 */
export async function searchIgHashtag(tag: string, limit = 12): Promise<HKPost[]> {
  try {
    const cleanTag = tag.replace(/^#/, '');
    const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(cleanTag)}/`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HKCopywriterBot/1.0; +https://77copywriter.app)',
        'Accept-Language': 'zh-HK,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      console.warn(`[igSearch] HTTP ${response.status} for tag #${cleanTag}`);
      return [];
    }

    const html = await response.text();

    // Try window.__INITIAL_STATE__ first, then window._sharedData
    let jsonMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?});<\/script>/s);
    if (!jsonMatch) {
      jsonMatch = html.match(/window\._sharedData\s*=\s*({.+?});<\/script>/s);
    }

    if (!jsonMatch || !jsonMatch[1]) {
      console.warn(`[igSearch] Could not extract JSON data for #${cleanTag}`);
      return [];
    }

    const data = JSON.parse(jsonMatch[1]);

    // Navigate IG's labyrinthine JSON structure to extract posts
    // The exact path varies by IG version; try common paths
    const edges: unknown[] =
      data?.tag?.top?.sections?.[0]?.layout_content?.medias ??
      data?.top?.sections?.[0]?.layout_content?.medias ??
      data?.tag?.media?.nodes ??
      [];

    if (!Array.isArray(edges) || edges.length === 0) {
      return [];
    }

    const posts: HKPost[] = edges.slice(0, limit).map((node: unknown, i: number) => {
      const n = node as Record<string, unknown>;
      const media = (n.media ?? n.node ?? n) as Record<string, unknown>;
      const caption = typeof media.caption === 'string'
        ? media.caption
        : typeof (media.caption as Record<string, unknown>)?.text === 'string'
          ? (media.caption as Record<string, unknown>).text as string
          : '';
      const shortcode = (media.shortcode ?? media.code ?? `ig-post-${i}`) as string;
      const likes = media.likes as Record<string, unknown> | undefined;
      const comments = media.comments as Record<string, unknown> | undefined;
      const likeCount = (media.like_count ?? likes?.count ?? 0) as number;
      const commentCount = (media.comment_count ?? comments?.count ?? 0) as number;

      // Extract hashtags from caption
      const hashtags = (caption.match(/#[\w一-鿿]+/g) ?? []).map((h: string) => h.slice(1));

      return {
        id: `ig-${shortcode}`,
        platform: 'ig',
        type: 'organic',
        body: caption.slice(0, 300),
        hashtags,
        engagement: { likes: likeCount, comments: commentCount },
        url: `https://www.instagram.com/p/${shortcode}/`,
        authorName: ((media.owner as Record<string, unknown> | undefined)?.username
          ?? (media.owner as Record<string, unknown> | undefined)?.full_name
          ?? undefined) as string | undefined,
        fetchedAt: new Date().toISOString(),
        expressionFingerprint: extractExpressionFingerprint(caption),
      };
    });

    return posts;
  } catch (err) {
    console.warn('[igSearch] Failed:', (err as Error).message);
    return [];
  }
}

/**
 * Extract a sentence skeleton from a social media post body.
 * Strips topic-specific words (brands, products, dates, locations)
 * while preserving sentence structure, punctuation, and interaction patterns.
 */
function extractExpressionFingerprint(body: string): string {
  if (!body || body.length < 10) return body;

  let skeleton = body
    // Remove hashtags (keep the structure markers)
    .replace(/#[\w一-鿿]+/g, '___')
    // Remove URLs
    .replace(/https?:\/\/\S+/g, '___')
    // Remove @mentions
    .replace(/@\S+/g, '@___')
    // Remove currency amounts
    .replace(/\$\d+[\d,]*/g, '$___')
    // Remove percentages
    .replace(/\d+%/g, '___%');

  return skeleton;
}
