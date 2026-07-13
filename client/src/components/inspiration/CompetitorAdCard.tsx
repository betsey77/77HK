import { useState } from 'react';
import type { CompetitorAd } from '../../types';

interface Props {
  ad: CompetitorAd;
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'FB',
  instagram: 'IG',
  messenger: 'MSG',
  audience_network: 'AN',
};

export default function CompetitorAdCard({ ad }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ad.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const truncatedBody = ad.body.length > 100 ? ad.body.slice(0, 100) + '...' : ad.body;
  const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=HK&id=${ad.adArchiveId}`;

  return (
    <div className="bg-gray-800/20 light:bg-gray-100 border border-gray-700/20 light:border-gray-200 rounded-lg p-2.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-300 light:text-gray-800">
            {ad.pageName}
          </span>
          {ad.isDemo && (
            <span className="text-[8px] px-1 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              DEMO
            </span>
          )}
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
          ad.isActive
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-gray-700/30 text-gray-500 border border-gray-600/20'
        }`}>
          {ad.isActive ? '投放中' : '已暂停'}
        </span>
      </div>

      {/* Body */}
      <p className="text-[11px] leading-relaxed text-gray-400 light:text-gray-600 mb-1.5">
        {truncatedBody}
      </p>

      {/* CTA + Platforms */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {ad.ctaText && (
          <span className="text-[9px] text-amber-400/80 light:text-amber-600 bg-amber-500/5 px-1 rounded">
            CTA: {ad.ctaText}
          </span>
        )}
        <span className="text-[9px] text-gray-600 light:text-gray-500">
          {ad.platform.map((p) => PLATFORM_LABELS[p] ?? p).join(' · ')}
        </span>
        {ad.startDate > 0 && (
          <span className="text-[9px] text-gray-600 light:text-gray-500">
            {new Date(ad.startDate * 1000).toLocaleDateString('zh-HK')} 起
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          onClick={handleCopy}
          className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/15
            text-amber-400 light:text-amber-600 hover:bg-amber-500/20 transition-colors"
        >
          {copied ? '✓ 已复制' : '📋 复制文案'}
        </button>
        <a
          href={adLibraryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] px-2 py-0.5 rounded bg-gray-700/30 light:bg-gray-200/50 border border-gray-600/30 light:border-gray-300
            text-gray-400 light:text-gray-600 hover:text-gray-200 light:hover:text-gray-800 transition-colors"
        >
          查看完整广告 ↗
        </a>
      </div>
    </div>
  );
}
