import { useState, useEffect } from 'react';
import type { HKPost } from '../../types';
import PostCard from './PostCard';
import SkeletonCard from './SkeletonCard';
import { apiUrl } from '../../services/apiBase';
import { SHORTS_TK_LABEL } from '../../constants';

/**
 * Static example HK social media posts used as language vibe references.
 * These are real Hong Kong-style posts demonstrating sentence structure,
 * tone, emoji usage, and engagement patterns.
 */
const STATIC_EXAMPLE_POSTS: HKPost[] = [
  {
    id: 'static-1',
    platform: 'ig',
    type: 'organic',
    headline: '港式美食文案示例',
    body: '是但问个港岛人，中秋必买嘅饼铺系？留言话我知👇 唔好同我讲系美心，我哋要嘅系隐世小店㗎～',
    hashtags: ['hkfoodie', '中秋節', '香港美食', '隱世小店'],
    engagement: { likes: 2300, comments: 186 },
    url: '#',
    authorName: 'hkfoodgram',
    fetchedAt: new Date().toISOString(),
    expressionFingerprint: '是但问个___人，___必买嘅___系？留言话我知👇 唔好同我讲系___，我哋要嘅系隐世___㗎～',
  },
  {
    id: 'static-2',
    platform: 'ig',
    type: 'organic',
    headline: '港式生活文案示例',
    body: '老实讲，呢个月最值得使嘅$100，唔系去买奶茶，系买呢个。用完你会返嚟多谢我😌',
    hashtags: ['hkbuys', '好物分享', '真心推介', '香港生活'],
    engagement: { likes: 1800, comments: 92 },
    url: '#',
    authorName: 'hklifestyle_ig',
    fetchedAt: new Date().toISOString(),
    expressionFingerprint: '老实讲，呢个___最值得使嘅$___，唔系去买___，系买呢个。用完你会返嚟多谢我😌',
  },
  {
    id: 'static-3',
    platform: 'facebook',
    type: 'organic',
    headline: '港式促销文案示例',
    body: '话俾大家知个秘密：我哋老板呢个星期生日，佢话全部八折。唔知几时会后悔㗎，快啲落单啦🤫',
    hashtags: ['限時優惠', '生日優惠', 'hkpromo'],
    engagement: { likes: 3400, comments: 215, shares: 420 },
    url: '#',
    authorName: 'hkshop_fb',
    fetchedAt: new Date().toISOString(),
    expressionFingerprint: '话俾大家知个秘密：我哋___呢个星期___，佢话全部___。唔知几时会后悔㗎，快啲___啦🤫',
  },
  {
    id: 'static-4',
    platform: 'ig',
    type: 'organic',
    headline: '港式互动文案示例',
    body: '见到张相你就明🌸 今年嘅design系近几年最靓，冇之一。Tag你嗰个会识欣赏嘅朋友出嚟～',
    hashtags: ['hkdesign', '打卡', '香港設計', 'aesthetic'],
    engagement: { likes: 5100, comments: 340 },
    url: '#',
    authorName: 'hkdesignstudio',
    fetchedAt: new Date().toISOString(),
    expressionFingerprint: '见到张相你就明🌸 今年嘅___系近几年最___，冇之一。Tag你嗰个会识欣赏嘅朋友出嚟～',
  },
  {
    id: 'static-5',
    platform: 'youtube',
    type: 'organic',
    headline: `港式${SHORTS_TK_LABEL}文案示例`,
    body: '3秒俾你睇到分别🔥左边系普通，右边系我哋。个客send返嚟嘅对比图冇P过㗎！想试嘅link in bio',
    hashtags: ['beforeafter', '真實效果', 'hkbeauty'],
    engagement: { likes: 8200, comments: 430, views: 120000 },
    url: '#',
    authorName: 'hkbeauty_yt',
    fetchedAt: new Date().toISOString(),
    expressionFingerprint: '___秒俾你睇到分别🔥左边系___，右边系我哋。个客send返嚟嘅对比图冇P过㗎！想试嘅link in bio',
  },
  {
    id: 'static-6',
    platform: 'ig',
    type: 'ad',
    headline: '港式广告文案示例',
    body: '试过咁多间，呢间嘅CP值真系冇得输。$188食到呢个质素，你话边度揾？每星期只做三日，bookmark定先📌',
    hashtags: ['hkeats', 'CP值高', '平靓正', 'hkrestaurant'],
    engagement: { likes: 1500, comments: 78 },
    url: '#',
    authorName: 'hkfoodie_ad',
    fetchedAt: new Date().toISOString(),
    expressionFingerprint: '试过咁多间，呢间嘅CP值真系冇得输。$___食到呢个质素，你话边度揾？每___只做___，bookmark定先📌',
  },
];

export default function LanguageVibeTab() {
  const [externalPosts, setExternalPosts] = useState<HKPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLanguageVibe = () => {
    setLoading(true);
    setError(null);
    fetch(apiUrl('/inspiration/language-vibe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('数据获取失败');
        return res.json();
      })
      .then((data) => {
        setExternalPosts((data as { posts: HKPost[] }).posts ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '获取失败');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLanguageVibe();
  }, []);

  // Merge: external posts first, then static examples as fillers
  const allPosts = [...externalPosts, ...STATIC_EXAMPLE_POSTS];

  if (loading) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] text-gray-500 mb-2">⏳ 正在获取港式语感参考...</p>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error && externalPosts.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-[10px] text-amber-400 mb-2">⚠️ 外部数据获取失败，以下为内置参考示例</p>
        <button
          onClick={fetchLanguageVibe}
          className="text-[10px] px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20
            text-amber-400 hover:bg-amber-500/20 transition-colors mb-3"
        >
          重试
        </button>
        <div className="space-y-2">
          {STATIC_EXAMPLE_POSTS.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-500 light:text-gray-500 mb-1">
        💡 以下系近期港式社媒高互动帖文，参考佢哋嘅语气、句式同互动方式（唔好直接抄内容）
      </p>
      <div className="space-y-2">
        {allPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      <p className="text-[9px] text-gray-600 light:text-gray-500 text-center mt-1">
        {externalPosts.length > 0
          ? `📡 实时数据 ${externalPosts.length} 条（来源：YouTube API HK）+ 内置参考 ${STATIC_EXAMPLE_POSTS.length} 条`
          : '📌 内置港式语感参考示例（YouTube API 暂未返回数据，请检查网络或 API Key）'}
      </p>
    </div>
  );
}
