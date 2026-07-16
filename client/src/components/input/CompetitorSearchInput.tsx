import { useState, useContext, useCallback } from 'react';
import { AppContext } from '../../context/AppContext';

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

export default function CompetitorSearchInput() {
  const { state, dispatch } = useContext(AppContext);
  const selectedQueries = state.settings.competitorQueries ?? [];
  const [customInput, setCustomInput] = useState('');

  /** Toggle a brand in/out of the selected list */
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

  /** Add custom brand from text input */
  const addCustom = useCallback(() => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    if (selectedQueries.includes(trimmed)) {
      setCustomInput('');
      return; // already selected
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

  /** Remove a single brand */
  const removeBrand = useCallback((brand: string) => {
    dispatch({
      type: 'SET_COMPETITOR_QUERIES',
      payload: selectedQueries.filter((q) => q !== brand),
    });
  }, [selectedQueries, dispatch]);

  /** Clear all selections */
  const clearAll = () => {
    dispatch({ type: 'SET_COMPETITOR_QUERIES', payload: [] });
    setCustomInput('');
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-emerald-400 light:text-orange-600">
        🔍 竞品分析{' '}
        <span className="font-normal text-emerald-600/70 light:text-orange-500/80">（可选 · 多选）</span>
      </label>

      {/* Custom input + add button */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入品牌名称后按 Enter 添加"
          className="flex-1 bg-gray-800/50 light:bg-white border border-gray-700/50 light:border-gray-300/50
            rounded-lg px-2.5 py-1.5 text-xs text-gray-200 light:text-gray-800
            focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20
            transition-colors"
        />
        {customInput.trim() && (
          <button
            onClick={addCustom}
            className="text-[10px] px-2 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/25
              text-amber-400 light:text-amber-600 hover:bg-amber-500/25 transition-colors"
          >
            添加
          </button>
        )}
        {selectedQueries.length > 0 && (
          <button
            onClick={clearAll}
            className="text-[10px] px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 light:hover:text-gray-700 transition-colors"
            title="清除全部竞品"
          >
            ✕
          </button>
        )}
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

      {/* Selected brands display */}
      {selectedQueries.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-gray-500">
            已选 {selectedQueries.length} 个竞品：
          </span>
          {selectedQueries.map((q) => (
            <span
              key={q}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20
                text-amber-400 light:text-amber-600 flex items-center gap-1"
            >
              {q}
              <button
                onClick={() => removeBrand(q)}
                className="hover:text-red-400 transition-colors"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {selectedQueries.length > 0 && (
        <p className="text-[10px] text-amber-400/80 light:text-amber-600">
          🔍 已选 {selectedQueries.length} 个竞品 — 查看「灵感参考 → 竞品动态」获取广告素材
        </p>
      )}
    </div>
  );
}
