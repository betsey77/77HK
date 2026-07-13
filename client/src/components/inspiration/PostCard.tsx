import { useState } from 'react';
import type { HKPost } from '../../types';

interface Props {
  post: HKPost;
}

const PLATFORM_BADGES: Record<string, { bg: string; label: string }> = {
  ig: { bg: 'bg-pink-500/15 text-pink-400 border-pink-500/20', label: 'IG' },
  facebook: { bg: 'bg-blue-500/15 text-blue-400 border-blue-500/20', label: 'FB' },
  youtube: { bg: 'bg-red-500/15 text-red-400 border-red-500/20', label: 'YT' },
};

function formatEngagement(eng: HKPost['engagement']): string {
  const parts: string[] = [];
  if (eng.likes > 0) parts.push(`❤️ ${eng.likes >= 1000 ? `${(eng.likes / 1000).toFixed(1)}K` : eng.likes}`);
  if (eng.comments > 0) parts.push(`💬 ${eng.comments}`);
  if (eng.views && eng.views > 0) parts.push(`👁 ${eng.views >= 1000 ? `${(eng.views / 1000).toFixed(1)}K` : eng.views}`);
  return parts.join(' · ');
}

/**
 * Extract expression skeleton from a post body:
 * - Strip hashtags, brand names, product names, specific topics
 * - Preserve sentence structure, punctuation, and interaction patterns
 */
function extractExpressionFingerprint(body: string): string {
  let skeleton = body
    // Remove hashtags
    .replace(/#[\w一-鿿]+/g, '___')
    // Replace URLs
    .replace(/https?:\/\/\S+/g, '___')
    // Replace @mentions
    .replace(/@\S+/g, '@___');

  // Return a version that's clearly marked as a skeleton
  return skeleton;
}

export default function PostCard({ post }: Props) {
  const [copied, setCopied] = useState<'expression' | 'full' | null>(null);
  const badge = PLATFORM_BADGES[post.platform] ?? PLATFORM_BADGES.ig!;

  const handleCopy = async (text: string, type: 'expression' | 'full') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback: ignore
    }
  };

  const truncatedBody = post.body.length > 120 ? post.body.slice(0, 120) + '...' : post.body;
  const fingerprint = post.expressionFingerprint ?? extractExpressionFingerprint(post.body);

  return (
    <div className="bg-gray-800/30 light:bg-gray-100/80 border border-gray-700/30 light:border-gray-300/50 rounded-lg p-2.5 transition-all hover:border-gray-600/50 light:hover:border-gray-400/50">
      {/* Header: platform badge + engagement */}
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${badge.bg}`}>
          {badge.label}
        </span>
        <span className="text-[9px] text-gray-600 light:text-gray-500">
          {formatEngagement(post.engagement)}
        </span>
      </div>

      {/* Body */}
      <p className="text-[11px] leading-relaxed text-gray-300 light:text-gray-700 mb-2">
        {truncatedBody}
      </p>

      {/* Hashtags */}
      {post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {post.hashtags.slice(0, 5).map((tag) => (
            <span key={tag} className="text-[9px] text-amber-400/70 light:text-amber-600">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5">
        <button
          onClick={() => handleCopy(fingerprint, 'expression')}
          className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/15
            text-amber-400 light:text-amber-600 hover:bg-amber-500/20 transition-colors"
          title="复制句式骨架（去话题化）"
        >
          {copied === 'expression' ? '✓ 已复制' : '📋 复制表达'}
        </button>
        <button
          onClick={() => handleCopy(post.body, 'full')}
          className="text-[9px] px-2 py-0.5 rounded bg-gray-700/30 light:bg-gray-200/50 border border-gray-600/30 light:border-gray-300
            text-gray-400 light:text-gray-600 hover:text-gray-200 light:hover:text-gray-800 hover:border-gray-500 transition-colors"
          title="复制完整原文"
        >
          {copied === 'full' ? '✓ 已复制' : '📝 复制全文'}
        </button>
      </div>
    </div>
  );
}
