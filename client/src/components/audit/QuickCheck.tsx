import { useState, useCallback } from 'react';
import { Check, X, AlertTriangle, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import { runQuickCheck } from '../../services/api';
import type { Variants, QuickCheckResult, QuickCheckItem } from '../../types';

const SEVERITY_ICON = {
  error: <X className="w-3.5 h-3.5 text-red-400" />,
  warning: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  info: <Check className="w-3.5 h-3.5 text-emerald-400" />,
} as const;

const SEVERITY_BG = {
  error: 'bg-red-500/10 border-red-500/20',
  warning: 'bg-amber-500/10 border-amber-500/20',
  info: 'bg-emerald-500/10 border-emerald-500/20',
} as const;

const SEVERITY_LABEL = {
  error: '错误',
  warning: '警告',
  info: '通过',
} as const;

interface QuickCheckProps {
  variants: Variants;
  brandName?: string;
  brandRedLines?: string;
}

export default function QuickCheck({ variants, brandName, brandRedLines }: QuickCheckProps) {
  const [result, setResult] = useState<QuickCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runQuickCheck(variants, { brandName, brandRedLines });
      setResult(res);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '检查失败');
    } finally {
      setLoading(false);
    }
  }, [variants, brandName, brandRedLines]);

  // Group items by variant
  const grouped = result
    ? result.items.reduce<Record<string, QuickCheckItem[]>>((acc, item) => {
        const key = item.variantKey;
        if (!acc[key]) acc[key] = [];
        acc[key].push(item);
        return acc;
      }, {})
    : {};

  // Sort variant keys consistently
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const order = ['standardHK', 'lightCantonese', 'ig', 'facebook', 'shorts'];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <div className="border-t border-gray-700/30 light:border-gray-300/50 pt-3 mt-3">
      {/* Header + Run button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] text-gray-400 light:text-gray-500 font-medium">
            快速规则检查
          </span>
          {result && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
              result.passed
                ? 'bg-emerald-500/20 text-emerald-300 light:text-emerald-600'
                : 'bg-amber-500/20 text-amber-300 light:text-amber-600'
            }`}>
              {result.passed ? '✓ 全部通过' : `✗ ${result.summary.failed} 项未通过`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {result && result.items.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] px-1.5 py-0.5 rounded text-gray-500 light:text-gray-500 hover:text-gray-300 light:hover:text-gray-700 transition-colors"
              title={expanded ? '收起详情' : '展开详情'}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
          <button
            onClick={handleCheck}
            disabled={loading}
            className={`text-[10px] px-2.5 py-1 rounded border transition-colors ${
              loading
                ? 'bg-gray-800/20 border-gray-700/30 text-gray-500 cursor-wait'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300 light:text-amber-600 hover:bg-amber-500/20 cursor-pointer'
            }`}
          >
            {loading ? '检查中...' : result ? '重新检查' : '⚡ 快速检查'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <p className="text-[10px] text-red-400 mb-2">{error}</p>
      )}

      {/* Empty state / CTA */}
      {!result && !loading && !error && (
        <p className="text-[10px] text-gray-500 light:text-gray-500 mb-1">
          本地规则引擎，瞬间检查 emoji 数量、hashtag、字数、简体字、内地词汇等，无需等待 AI
        </p>
      )}

      {/* Results */}
      {result && expanded && (
        <div className="space-y-2 mt-2">
          {/* Summary bar */}
          <div className="flex items-center gap-3 text-[10px] text-gray-500 light:text-gray-500">
            <span className="text-emerald-400">{result.summary.passed} 通过</span>
            <span className="text-amber-400">{result.summary.warnings} 警告</span>
            <span className="text-red-400">{result.summary.failed - result.summary.warnings} 错误</span>
          </div>

          {/* Grouped results by variant */}
          {sortedKeys.map((variantKey) => {
            const variantItems = grouped[variantKey];
            if (!variantItems || variantItems.length === 0) return null;
            const variantLabel = variantItems[0]?.variantLabel || variantKey;
            const hasFailure = variantItems.some((i) => !i.passed);

            return (
              <div key={variantKey} className="border border-gray-700/20 light:border-gray-300/30 rounded-lg overflow-hidden">
                {/* Variant header */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] ${
                  hasFailure ? 'bg-amber-500/5' : 'bg-emerald-500/5'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    hasFailure ? 'bg-amber-400' : 'bg-emerald-400'
                  }`} />
                  <span className="text-gray-400 light:text-gray-600 font-medium">{variantLabel}</span>
                </div>

                {/* Items */}
                <div className="px-2.5 py-1.5 space-y-1">
                  {variantItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-1.5 text-[10px] px-2 py-1 rounded border ${SEVERITY_BG[item.severity]}`}
                    >
                      <span className="mt-px shrink-0">{SEVERITY_ICON[item.severity]}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-gray-300 light:text-gray-700">{item.message}</span>
                        {item.actual && item.expected && (
                          <span className="text-gray-500 light:text-gray-500 ml-1">
                            ({item.actual}{item.expected ? ` / ${item.expected}` : ''})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
