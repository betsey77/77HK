import { useContext, useMemo } from 'react';
import { AppContext } from '../../context/AppContext';

/**
 * 🆕 Ph1: Structured Writing Brief toggle
 *
 * Detects whether source text contains product-related descriptions and shows
 * a smart hint suggesting the user enable the toggle for better generation quality.
 */
const PRODUCT_SIGNAL_KEYWORDS = [
  // Chinese product-related keywords
  '成分', '功效', '採用', '選用', '材料', '配方', '含有', '富含', '來自',
  '產地', '進口', '原料', '製作', '工藝', '品質', '營養', '含量',
  '推出', '新品', '上市', '限時', '優惠', '折扣', '促銷',
  '適合', '專為', '針對', '有效', '改善', '解決',
  // English signal words
  'ingredient', 'formula', 'extract', 'premium', 'quality', 'imported',
  'limited', 'offer', 'new launch', 'made with', 'made from',
];

function detectProductInfo(source: string): boolean {
  if (!source || source.trim().length < 10) return false;

  const lower = source.toLowerCase();

  // Check for keyword matches
  const keywordHits = PRODUCT_SIGNAL_KEYWORDS.filter((kw) =>
    lower.includes(kw.toLowerCase()),
  );

  // Check for structured product descriptions: colon-separated specs, ingredient lists
  const hasSpecPattern = /[：:][^，。,.\n]{4,}/.test(source);
  const hasPercentage = /\d+%/.test(source);
  const hasMeasurement = /\d+\s*(克|毫升|mg|ml|g|kg|公克|毫|升)/i.test(source);

  // Need at least 2 keyword hits, or 1 keyword + a structural pattern
  return (
    keywordHits.length >= 2 ||
    (keywordHits.length >= 1 && (hasSpecPattern || hasPercentage || hasMeasurement))
  );
}

export default function StructuredBriefToggle() {
  const { state, dispatch } = useContext(AppContext);

  const enabled = state.settings.structuredBriefEnabled;
  const showSmartHint = useMemo(
    () => !enabled && detectProductInfo(state.source),
    [enabled, state.source],
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <label className="text-xs text-gray-400 light:text-gray-600 font-medium select-none">
            📋 结构化写作简报
          </label>
          <p className="text-[10px] text-gray-500 light:text-gray-500 mt-0.5 leading-relaxed">
            启用后 AI 会按 6-part Value Prop 结构理解品牌定位，适合有明确产品信息的文案。纯创意/互动文案建议关闭。
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() =>
            dispatch({
              type: 'SET_STRUCTURED_BRIEF_ENABLED',
              payload: !enabled,
            })
          }
          className={`relative ml-3 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
            transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 light:focus:ring-orange-500/30
            ${enabled ? 'bg-emerald-500 light:bg-orange-500' : 'bg-gray-700 light:bg-gray-300'}`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm
              transition-transform duration-200
              ${enabled ? 'translate-x-4.5' : 'translate-x-1'}`}
          />
        </button>
      </div>

      {/* Smart hint: source contains product info but toggle is OFF */}
      {showSmartHint && (
        <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-[10px] text-amber-400 light:text-amber-600 leading-relaxed">
            💡 这条文案包含产品信息，开启「结构化写作简报」可能会提升生成质量
          </p>
        </div>
      )}
    </div>
  );
}
