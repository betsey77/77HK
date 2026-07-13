import PostCard from './PostCard';
import SkeletonCard from './SkeletonCard';
import type { HKPost } from '../../types';

interface Props {
  posts?: HKPost[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function HotTrendsTab({ posts = [], loading, error, onRetry }: Props) {
  if (loading) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] text-gray-500 mb-2">⏳ 正在获取实时热点...</p>
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-[10px] text-amber-400 mb-2">⚠️ {error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-[10px] px-3 py-1 rounded bg-amber-500/10 border border-amber-500/20
              text-amber-400 hover:bg-amber-500/20 transition-colors mb-3"
          >
            重试
          </button>
        )}
        <div className="bg-gray-800/20 light:bg-gray-100 border border-gray-700/20 light:border-gray-200 rounded-lg p-2.5 text-left max-w-xs mx-auto">
          <p className="text-[9px] text-gray-500 light:text-gray-500 mb-1">💡 热点功能依赖</p>
          <p className="text-[9px] text-gray-400 light:text-gray-600">
            · YouTube Data API v3（HK 热门 + 趋势搜索）
            <br />
            · 请确认已配置 YOUTUBE_API_KEY
            <br />
            · 如服务器无法访问 Google API，需配置代理
          </p>
        </div>
      </div>
    );
  }

  if (posts.length > 0) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] text-gray-500 light:text-gray-500 mb-1">
          🔴 以下系近期香港社媒实时热点帖文，反映当下话题趋势
        </p>
        <div className="space-y-2">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
        <p className="text-[9px] text-gray-600 light:text-gray-500 text-center mt-1">
          📡 实时数据 · 来源：IG Hashtag + YouTube Trending HK
        </p>
      </div>
    );
  }

  // Empty — no data available
  return (
    <div className="text-center py-4">
      <div className="text-2xl mb-2">🔴</div>
      <p className="text-[11px] text-gray-400 light:text-gray-600 mb-2">
        暂无实时热点数据
      </p>
      <p className="text-[10px] text-gray-600 light:text-gray-500 leading-relaxed mb-3 max-w-xs mx-auto">
        此功能依赖 YouTube Data API v3 获取 HK 区域热门内容。
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-1 text-amber-400 light:text-amber-600 underline"
          >
            点击重试
          </button>
        )}
      </p>
      <div className="bg-gray-800/20 light:bg-gray-100 border border-gray-700/20 light:border-gray-200 rounded-lg p-2.5 text-left max-w-xs mx-auto">
        <p className="text-[9px] text-gray-500 light:text-gray-500 mb-1">💡 热点帖文卡片将显示：</p>
        <div className="text-[9px] text-gray-400 light:text-gray-600 space-y-0.5">
          <p>· 帖文正文（截断 ~120 字）</p>
          <p>· 互动数据（❤️ 💬 👁）</p>
          <p>· 仅提供「📋 复制表达」按钮</p>
        </div>
      </div>
    </div>
  );
}

// Export a helper to display trend velocity badge
export function TrendVelocityBadge({ velocity }: { velocity: 'rising' | 'peak' | 'cooling' }) {
  const badges: Record<string, { bg: string; label: string }> = {
    rising: { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: '📈 上升中' },
    peak: { bg: 'bg-red-500/10 text-red-400 border-red-500/20', label: '🔴 高峰' },
    cooling: { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: '📉 降温中' },
  };
  const badge = badges[velocity] ?? badges.rising!;
  return (
    <span className={`text-[8px] px-1 py-0.5 rounded-full border ${badge.bg}`}>
      {badge.label}
    </span>
  );
}
