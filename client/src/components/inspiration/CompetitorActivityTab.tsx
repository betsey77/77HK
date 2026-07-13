import { useState, useEffect, useContext, useCallback } from 'react';
import { AppContext } from '../../context/AppContext';
import CompetitorAdCard from './CompetitorAdCard';
import type { CompetitorAd } from '../../types';

/** Preset HK competitor brands for quick selection */
const PRESET_COMPETITORS = [
  '美心月餅',
  '奇華餅家',
  '大家樂',
  '太興',
  '莎莎',
  '萬寧',
  '屈臣氏',
  '百老匯電器',
];

interface Props {
  ads: CompetitorAd[];
  loading: boolean;
  error: string | null;
  onSearch: (queries: string[]) => void;
}

export default function CompetitorActivityTab({ ads, loading, error, onSearch }: Props) {
  const { state, dispatch } = useContext(AppContext);
  const selectedQueries = state.settings.competitorQueries ?? [];
  const [customInput, setCustomInput] = useState('');

  /** Toggle a preset brand */
  const toggleBrand = useCallback((brand: string) => {
    if (selectedQueries.includes(brand)) {
      dispatch({
        type: 'SET_COMPETITOR_QUERIES',
        payload: selectedQueries.filter((q) => q !== brand),
      });
    } else {
      dispatch({
        type: 'SET_COMPETITOR_QUERIES',
        payload: [...selectedQueries, brand],
      });
    }
  }, [selectedQueries, dispatch]);

  /** Add custom brand */
  const addCustom = useCallback(() => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (selectedQueries.includes(trimmed)) {
      setCustomInput('');
      return;
    }
    dispatch({
      type: 'SET_COMPETITOR_QUERIES',
      payload: [...selectedQueries, trimmed],
    });
    setCustomInput('');
  }, [customInput, selectedQueries, dispatch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addCustom();
  };

  /** Search all selected brands */
  const handleSearchAll = useCallback(() => {
    if (selectedQueries.length > 0) {
      onSearch(selectedQueries);
    }
  }, [selectedQueries, onSearch]);

  // Show search prompt if no query has been performed
  const hasSearched = ads.length > 0 || loading || error;

  return (
    <div className="space-y-2">
      {/* Custom input + add button */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入竞品 Facebook Page 名称..."
          className="flex-1 bg-gray-800/50 light:bg-white border border-gray-700/50 light:border-gray-300/50
            rounded-lg px-2.5 py-1.5 text-xs text-gray-200 light:text-gray-800
            focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20
            transition-colors"
        />
        <button
          onClick={handleSearchAll}
          disabled={selectedQueries.length === 0 || loading}
          className="text-[10px] px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25
            text-amber-400 light:text-amber-600 hover:bg-amber-500/25 transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loading ? '⏳ 搜索中...' : (selectedQueries.length > 0 ? `🔍 搜索 (${selectedQueries.length})` : '🔍 搜索')}
        </button>
      </div>

      {/* Preset competitor chips (toggle-based multi-select) */}
      <div className="flex flex-wrap gap-1">
        {PRESET_COMPETITORS.map((name) => {
          const isSelected = selectedQueries.includes(name);
          return (
            <button
              key={name}
              onClick={() => toggleBrand(name)}
              className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                isSelected
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 light:text-amber-700'
                  : 'bg-gray-800/30 light:bg-gray-100 border-gray-700/30 light:border-gray-300/30 text-gray-400 light:text-gray-600 hover:border-amber-500/30 hover:text-amber-400'
              }`}
            >
              {isSelected ? '✓ ' : ''}{name}
            </button>
          );
        })}
      </div>

      {/* Selected brands summary */}
      {selectedQueries.length > 0 && (
        <p className="text-[10px] text-gray-500">
          已选 {selectedQueries.length} 个竞品：{selectedQueries.join('、')}
        </p>
      )}

      {/* Results area */}
      {loading ? (
        <div className="space-y-2 mt-2">
          <p className="text-[10px] text-gray-500">⏳ 正在搜索竞品广告...</p>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="bg-gray-800/20 light:bg-gray-100 border border-gray-700/20 rounded-lg p-3 animate-pulse">
              <div className="w-16 h-3 bg-gray-700/30 light:bg-gray-300 rounded mb-2" />
              <div className="w-full h-2.5 bg-gray-700/20 light:bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-4">
          <p className="text-[10px] text-red-400 mb-2">❌ {error}</p>
          <button
            onClick={handleSearchAll}
            className="text-[10px] px-3 py-1 rounded bg-red-500/10 border border-red-500/20
              text-red-400 hover:bg-red-500/20 transition-colors"
          >
            重试
          </button>
          <p className="text-[9px] text-gray-500 mt-2">
            💡 提示：竞品搜索依赖 Meta Ad Library API。<br />
            如需真实数据，请在 .env 配置 META_ACCESS_TOKEN
          </p>
        </div>
      ) : ads.length > 0 ? (
        <div className="space-y-2 mt-2 max-h-[400px] overflow-y-auto">
          <p className="text-[10px] text-gray-500">
            找到 {ads.length} 条竞品广告
          </p>
          {ads.map((ad) => (
            <CompetitorAdCard key={ad.adArchiveId} ad={ad} />
          ))}
        </div>
      ) : hasSearched ? (
        <div className="text-center py-4">
          <p className="text-[10px] text-gray-500">未找到竞品广告</p>
          <p className="text-[9px] text-gray-600 light:text-gray-500 mt-1 mb-3">
            可能原因：Facebook 反爬限制、网络无法访问、或未配置 META_ACCESS_TOKEN
          </p>
          <div className="bg-gray-800/20 light:bg-gray-100 border border-gray-700/20 light:border-gray-200 rounded-lg p-2.5 text-left max-w-xs mx-auto">
            <p className="text-[9px] text-gray-500 mb-1">💡 如何获取真实数据：</p>
            <p className="text-[9px] text-gray-400 light:text-gray-600">
              1. 前往 developers.facebook.com 创建应用<br />
              2. 获取 Access Token 并填入 .env 的 META_ACCESS_TOKEN<br />
              3. 重启服务器后生效
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="text-2xl mb-2">🔍</div>
          <p className="text-[11px] text-gray-400 light:text-gray-600 mb-1">
            多选竞品品牌，一键搜索广告
          </p>
          <p className="text-[10px] text-gray-600 light:text-gray-500 leading-relaxed max-w-xs mx-auto mb-3">
            勾选上方预设品牌或输入自定义名称，然后点击「🔍 搜索」查看各品牌在 Meta 平台的最新广告。
          </p>
          <p className="text-[9px] text-gray-600 light:text-gray-500 mt-2">
            ⚠️ 竞品广告数据仅供研究参考
          </p>
        </div>
      )}
    </div>
  );
}
