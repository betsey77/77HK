import type { AuditScores } from '../../types';

interface ScoreDisplayProps {
  generated: AuditScores;
  source?: AuditScores | null;
}

function ScoreBar({ label, value, max = 100 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color =
    pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-yellow-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 light:text-gray-600 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-800 light:bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-gray-300 light:text-gray-800 w-8 text-right font-mono">{value}</span>
    </div>
  );
}

function ScoreDelta({ label, genVal, srcVal }: { label: string; genVal: number; srcVal?: number | null }) {
  const delta = srcVal != null ? genVal - srcVal : null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 light:text-gray-600 w-20 shrink-0">{label}</span>
      {srcVal != null && (
        <span className="text-[10px] text-gray-600 light:text-gray-500 w-7 text-right font-mono line-through">{srcVal}</span>
      )}
      <span className="text-[11px] text-gray-200 light:text-gray-800 w-7 text-right font-mono font-semibold">{genVal}</span>
      {delta != null && (
        <span
          className={`text-[10px] font-mono ${delta > 0 ? 'text-emerald-400 light:text-emerald-600' : delta < 0 ? 'text-red-400' : 'text-gray-600 light:text-gray-500'}`}
        >
          {delta > 0 ? `+${delta}` : delta === 0 ? '0' : delta}
        </span>
      )}
    </div>
  );
}

export default function ScoreDisplay({ generated, source }: ScoreDisplayProps) {
  const delta = source ? generated.total - source.total : null;
  const improved = delta !== null && delta > 0;

  return (
    <div className="space-y-3">
      {/* Total score — generated is prominent */}
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] text-gray-500 light:text-gray-500 uppercase tracking-wider">📊 生成文案评分</div>
          <div className="text-[10px] text-gray-600 light:text-gray-500 mt-0.5">以下评分对象为 AI 生成的文案（非原文）</div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-emerald-300 light:text-emerald-700">{generated.total}</span>
            <span className="text-xs text-gray-500 light:text-gray-500">/100</span>
            {improved && (
              <span className="text-xs text-emerald-400 light:text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                +{delta} vs 原文
              </span>
            )}
          </div>
        </div>
        {source && (
          <div className="text-right">
            <div className="text-[10px] text-gray-600 light:text-gray-500">原文参考分</div>
            <div className="text-sm text-gray-500 light:text-gray-500 font-mono">{source.total}<span className="text-[10px]">/100</span></div>
          </div>
        )}
      </div>

      {/* Five dimension bars */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-gray-500 light:text-gray-500 mb-1">维度分数</div>
        {source ? (
          <>
            <ScoreDelta label="港味纯正度" genVal={generated.cantoneseNaturalness} srcVal={source.cantoneseNaturalness} />
            <ScoreDelta label="品牌安全度" genVal={generated.brandSafety} srcVal={source.brandSafety} />
            <ScoreDelta label="平台适配度" genVal={generated.platformFit} srcVal={source.platformFit} />
            <ScoreDelta label="可读性" genVal={generated.readability} srcVal={source.readability} />
            <ScoreDelta label="创意/吸引力" genVal={generated.creativity} srcVal={source.creativity} />
            <ScoreDelta label="Hook强度" genVal={generated.hookStrength} srcVal={source.hookStrength} />
            <ScoreDelta label="Emoji/Hashtag" genVal={generated.emojiHashtagFit} srcVal={source.emojiHashtagFit} />
            <ScoreDelta label="互动引导" genVal={generated.engagementPotential} srcVal={source.engagementPotential} />
          </>
        ) : (
          <>
            <ScoreBar label="港味纯正度" value={generated.cantoneseNaturalness} />
            <ScoreBar label="品牌安全度" value={generated.brandSafety} />
            <ScoreBar label="平台适配度" value={generated.platformFit} />
            <ScoreBar label="可读性" value={generated.readability} />
            <ScoreBar label="创意/吸引力" value={generated.creativity} />
            <ScoreBar label="Hook强度" value={generated.hookStrength} />
            <ScoreBar label="Emoji/Hashtag" value={generated.emojiHashtagFit} />
            <ScoreBar label="互动引导" value={generated.engagementPotential} />
          </>
        )}
      </div>
    </div>
  );
}
