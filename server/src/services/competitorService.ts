import type { CompetitorAd } from '../types/index.js';
import { proxyFetch } from './proxyFetch.js';

/**
 * Search competitor ads from Meta Ad Library.
 *
 * Strategy (tried in order):
 * 1. Direct Facebook GraphQL — replicates the browser-act approach: fetch fb.com
 *    to extract an lsd token, then POST to /api/graphql/ with the Ad Library query.
 * 2. Official Meta Graph API — requires META_ACCESS_TOKEN env var.
 * 3. Return empty array gracefully.
 *
 * ⚠️ Strategy 1 may fail if Facebook changes their token format or blocks
 * server-side requests. Strategy 2 is the reliable long-term option but
 * requires a Meta developer app.
 */
export async function searchCompetitorAds(
  query: string,
  country = 'HK',
  platform = 'facebook,instagram',
  limit = 10,
): Promise<CompetitorAd[]> {
  console.log(`[competitorService] Searching "${query}" (country=${country}, limit=${limit})`);

  // ── Strategy 1: Direct Facebook GraphQL (no API key needed) ──
  console.log('[competitorService] Strategy 1: Direct Facebook GraphQL...');
  try {
    const result = await searchViaDirectGraphQL(query, country, platform, limit);
    if (result.length > 0) {
      console.log(`[competitorService] ✅ Strategy 1 returned ${result.length} ads`);
      return result;
    }
    console.log('[competitorService] Strategy 1 returned 0 ads');
  } catch (err) {
    console.warn('[competitorService] Strategy 1 failed:', (err as Error).message);
  }

  // ── Strategy 2: Official Meta Graph API (needs META_ACCESS_TOKEN) ──
  console.log('[competitorService] Strategy 2: Meta Graph API...');
  try {
    const result = await searchViaMetaGraphAPI(query, country, platform, limit);
    if (result.length > 0) {
      console.log(`[competitorService] ✅ Strategy 2 returned ${result.length} ads`);
      return result;
    }
    console.log('[competitorService] Strategy 2 returned 0 ads (no META_ACCESS_TOKEN or no results)');
  } catch (err) {
    console.warn('[competitorService] Strategy 2 failed:', (err as Error).message);
  }

  // ── Fallback: Demo data for UI preview ──
  console.log('[competitorService] Strategy 3: Demo data fallback...');
  const demoAds = getDemoAds(query, limit);
  if (demoAds.length > 0) {
    console.log(`[competitorService] ✅ Strategy 3: Returning ${demoAds.length} demo ads for "${query}"`);
  } else {
    console.log(`[competitorService] ⚠️ No demo ads match "${query}"`);
  }
  return demoAds;
}

/**
 * Strategy 1: Replicate what the facebook-ads-library-search skill does —
 * fetch facebook.com HTML → extract lsd token → call internal GraphQL.
 * This is the same approach as the browser-act Python script, but running
 * server-side via fetch().
 */
async function searchViaDirectGraphQL(
  query: string,
  country: string,
  platform: string,
  limit: number,
): Promise<CompetitorAd[]> {
  // Step 1: Get a Facebook page to extract the lsd token
  // Note: This will likely fail in mainland China or be blocked by FB anti-bot.
  // We keep a short timeout so the demo fallback activates quickly.
  const fbRes = await proxyFetch('https://www.facebook.com/', {
    timeout: 5000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9,zh-HK;q=0.8,zh;q=0.7',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!fbRes.ok) {
    console.warn(`[competitorService] Facebook returned ${fbRes.status} — will try fallback`);
    return [];
  }

  const html = await fbRes.text();

  // Extract lsd token — it's embedded in one of the <script> tags as "token":"..."
  const lsdMatch = html.match(/"token":"([A-Za-z0-9_-]{20,})"/);
  if (!lsdMatch || !lsdMatch[1]) {
    console.warn('[competitorService] Could not extract lsd token from Facebook HTML');
    return [];
  }
  const lsd = lsdMatch[1];

  // Step 2: Build the Ad Library GraphQL query (same variables as search-ads.py)
  const countries = country.toUpperCase() === 'ALL' ? ['ALL'] : [country.toUpperCase()];
  const platforms = platform
    ? platform.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  const variables: Record<string, unknown> = {
    activeStatus: 'active',
    adType: 'ALL',
    bylines: [],
    collationToken: null,
    contentLanguages: [],
    countries,
    cursor: null,
    excludedIDs: null,
    first: Math.min(limit, 50),
    isTargetedCountry: false,
    location: null,
    mediaType: 'all',
    multiCountryFilterMode: null,
    pageIDs: [],
    potentialReachInput: null,
    publisherPlatforms: platforms,
    queryString: query,
    regions: null,
    searchType: 'keyword_unordered',
    sessionID: '77copywriter-server',
    sortData: null,
    source: null,
    startDate: null,
    v: '1368af',
  };

  const formBody =
    'av=0&__user=0&__a=1' +
    '&lsd=' + encodeURIComponent(lsd) +
    '&fb_api_req_friendly_name=AdLibrarySearchPaginationQuery' +
    '&variables=' + encodeURIComponent(JSON.stringify(variables)) +
    '&doc_id=27201872659451053';

  const apiRes = await proxyFetch('https://www.facebook.com/api/graphql/', {
    method: 'POST',
    timeout: 8000,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-FB-LSD': lsd,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: formBody,
  });

  if (!apiRes.ok) {
    console.warn(`[competitorService] GraphQL API returned ${apiRes.status}`);
    return [];
  }

  const data = await apiRes.json();
  const conn = data?.data?.ad_library_main?.search_results_connection;

  if (!conn || !Array.isArray(conn.edges)) {
    const hint = data?.errors?.[0]?.message ?? JSON.stringify(data).slice(0, 200);
    console.warn(`[competitorService] Unexpected GraphQL response: ${hint}`);
    return [];
  }

  // Flatten collated_results from all edges
  const ads: CompetitorAd[] = [];
  for (const edge of conn.edges) {
    const collated = edge?.node?.collated_results ?? [];
    for (const ad of collated) {
      const snap = ad.snapshot ?? {};
      ads.push({
        adArchiveId: ad.ad_archive_id as string,
        pageName: (ad.page_name ?? snap.page_name ?? query) as string,
        pageId: ad.page_id as string | undefined,
        platform: (ad.publisher_platform as CompetitorAd['platform']) ?? ['facebook'],
        body: (snap.body as string) ?? '',
        title: snap.title as string | undefined,
        ctaText: snap.cta_text as string | undefined,
        linkUrl: snap.link_url as string | undefined,
        isActive: (ad.is_active as boolean) ?? true,
        startDate: (ad.start_date as number) ?? 0,
      });
    }
  }

  console.log(`[competitorService] Direct GraphQL found ${ads.length} ads for "${query}"`);
  return ads.slice(0, limit);
}

/**
 * Strategy 2: Official Meta Graph API ads_archive endpoint.
 * Requires a Meta App access token (META_ACCESS_TOKEN).
 */
async function searchViaMetaGraphAPI(
  query: string,
  country: string,
  platform: string,
  limit: number,
): Promise<CompetitorAd[]> {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    return [];
  }

  const searchParams = new URLSearchParams({
    search_terms: query,
    ad_type: 'ALL',
    countries: country,
    platforms: platform,
    limit: String(Math.min(limit, 50)),
    access_token: accessToken,
    fields: 'id,ad_creative_body,page_name,platforms,ad_delivery_start_time,ad_snapshot_url',
  });

  const res = await proxyFetch(
    `https://graph.facebook.com/v19.0/ads_archive?${searchParams}`,
    { timeout: 8000 },
  );

  if (!res.ok) {
    console.warn(`[competitorService] Meta API returned ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items = Array.isArray(data.data) ? data.data : [];

  return items.map((item: Record<string, unknown>) => ({
    adArchiveId: (item.id as string) ?? '',
    pageName: (item.page_name as string) ?? query,
    pageId: (item.page_id as string) ?? undefined,
    platform: Array.isArray(item.platforms)
      ? (item.platforms as CompetitorAd['platform'])
      : ['facebook'],
    body: (item.ad_creative_body as string) ?? '',
    title: (item.ad_creative_link_title as string) ?? undefined,
    ctaText: (item.ad_creative_link_description as string) ?? undefined,
    linkUrl: (item.ad_snapshot_url as string) ?? undefined,
    isActive: (item.ad_delivery_start_time as string) ? true : false,
    startDate: item.ad_delivery_start_time
      ? Math.floor(new Date(item.ad_delivery_start_time as string).getTime() / 1000)
      : 0,
  }));
}

// ── Demo ads (fallback when live strategies fail) ──

interface DemoAdTemplate {
  pageName: string;
  title: string;
  body: string;
  ctaText: string;
  platform: CompetitorAd['platform'];
}

const DEMO_AD_POOL: DemoAdTemplate[] = [
  {
    pageName: '美心月餅',
    title: '中秋限定 · 流心奶黃月餅',
    body: '今年中秋唔使諗！美心流心奶黃月餅返嚟喇🌕 預訂即享早鳥優惠 $288/盒，買四送一～ 限量禮盒，手快有手慢冇！\n📦 全港免費送貨 · 🎁 企業訂購另設優惠',
    ctaText: '立即預訂',
    platform: ['facebook', 'instagram'],
  },
  {
    pageName: '奇華餅家',
    title: '傳承港式味道 · 手工月餅系列',
    body: '70幾年嚟，奇華堅持香港製造🇭🇰 今年中秋，用心製作每一件月餅，等你同屋企人一齊分享呢份港式傳統滋味。\n#奇華餅家 #香港製造 #中秋月餅',
    ctaText: '選購月餅',
    platform: ['facebook'],
  },
  {
    pageName: '大家樂',
    title: '全日早餐 · $36 起',
    body: '朝早趕返工唔使愁！大家樂全日早餐 $36 起🍳 炒蛋·多士·腸仔·熱飲，快靚正～\n📱用 App 落單唔使排隊，积分仲可以換免費餐！',
    ctaText: '下載 App',
    platform: ['facebook', 'instagram'],
  },
  {
    pageName: '太興',
    title: '經典燒味 · 外賣自取 8 折',
    body: '太興燒味，港人嘅集體回憶🔥 叉燒·燒鵝·燒肉，每日新鮮出爐！\n依家外賣自取全單 8 折，用 App 落單再減 $10～\n#太興 #港式燒味 #外賣優惠',
    ctaText: '立即下單',
    platform: ['facebook', 'instagram', 'messenger'],
  },
  {
    pageName: '莎莎',
    title: '夏日美肌節 · 全場低至 5 折',
    body: 'SaSa 夏日美肌節開鑼！💄 國際大牌護膚品、化妝品低至半價～\n新會員註冊即送 $50 現金券，買滿 $399 免運費！\n#莎莎 #夏日優惠 #護膚美妝',
    ctaText: '立即選購',
    platform: ['facebook', 'instagram'],
  },
  {
    pageName: '萬寧',
    title: '萬寧藥妝 · 每週限定優惠',
    body: '今期萬寧精選💊 保健品買二送一、日本藥妝限時特價、嬰兒用品低至 75 折！\nMann Card 會員更可享額外 95 折～ 快啲去附近萬寧掃貨啦🛒',
    ctaText: '查看優惠',
    platform: ['facebook', 'instagram'],
  },
  {
    pageName: '屈臣氏',
    title: '屈臣氏健康月 · 免費健康諮詢',
    body: '關注你嘅健康，就係我哋嘅使命💚 依家嚟屈臣氏，藥劑師免費健康諮詢＋指定保健品 85 折。\n下載屈臣氏 App 仲有專屬優惠𠻹～',
    ctaText: '了解更多',
    platform: ['facebook', 'instagram', 'messenger'],
  },
  {
    pageName: '百老匯電器',
    title: '年中大減價 · 4K 電視低至 6 折',
    body: 'Broadway 年中開倉！📺 Samsung/LG 4K 電視、Dyson 吸塵機、iPhone 全部激減！\n分期 24 個月免息，舊機換新機再減 $500。數量有限，售完即止⚡',
    ctaText: '查看優惠',
    platform: ['facebook', 'instagram'],
  },
];

/**
 * Return realistic HK competitor ad demo data for a given search query.
 * Matches brand names exactly, or returns ads whose pageName/title/body
 * contain the query string.
 */
function getDemoAds(query: string, limit: number): CompetitorAd[] {
  const q = query.toLowerCase().trim();

  // Try exact brand match first
  const exactMatches = DEMO_AD_POOL.filter(
    (ad) => ad.pageName.toLowerCase() === q,
  );

  // Fall back to fuzzy match (query appears in pageName, title, or body)
  const fuzzyMatches = DEMO_AD_POOL.filter(
    (ad) =>
      ad.pageName.toLowerCase().includes(q) ||
      ad.title.toLowerCase().includes(q) ||
      ad.body.toLowerCase().includes(q),
  );

  // Prefer exact matches, then fuzzy, no duplicates
  const seen = new Set(exactMatches.map((a) => a.pageName));
  const combined = [...exactMatches];
  for (const ad of fuzzyMatches) {
    if (!seen.has(ad.pageName)) {
      seen.add(ad.pageName);
      combined.push(ad);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  return combined.slice(0, limit).map((ad, i) => ({
    adArchiveId: `demo-${ad.pageName}-${i}`,
    pageName: ad.pageName,
    platform: ad.platform,
    body: ad.body,
    title: ad.title,
    ctaText: ad.ctaText,
    isActive: true,
    startDate: now - 86400 * (30 + i), // staggered start dates
    isDemo: true,
  }));
}
