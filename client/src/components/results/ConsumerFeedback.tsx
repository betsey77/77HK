import { useState, useCallback, useContext, useRef, useEffect } from 'react';
import type { ConsumerFeedback as ConsumerFeedbackType, ConsumerSuggestion, VariantKey } from '../../types';
import { AppContext } from '../../context/AppContext';
import { VARIANT_TABS } from '../../constants';
import { apiUrl } from '../../services/apiBase';

interface Props {
  feedback: ConsumerFeedbackType[];
}

const VARIANT_KEYS: VariantKey[] = ['standardHK', 'lightCantonese', 'ig', 'facebook', 'shorts'];

// Unique ID for each suggestion to track applied state
function suggestionId(s: ConsumerSuggestion): string {
  return s.personaId + '|' + s.suggestion.slice(0, 30);
}

// Normalize platform names from model output to valid VariantKey
function normalizePlatform(raw: string): VariantKey | null {
  const lower = raw.toLowerCase().trim();
  if (['ig', 'instagram', 'ins'].includes(lower)) return 'ig';
  if (['facebook', 'fb', '臉書', 'fb/ig'].some(k => lower.includes(k) || k.includes(lower))) return 'facebook';
  if (['shorts', 'youtube', 'yt', 'youtube shorts'].some(k => lower.includes(k) || k.includes(lower))) return 'shorts';
  if (['standardhk', '標準繁中', '繁中', 'standard'].some(k => lower.includes(k) || k.includes(lower))) return 'standardHK';
  if (['lightcantonese', '輕粵語', 'light', '粵語'].some(k => lower.includes(k) || k.includes(lower))) return 'lightCantonese';
  return null;
}

function normalizeTargetPlatforms(raw?: string[]): VariantKey[] {
  if (!raw || raw.length === 0) return [];
  const result: VariantKey[] = [];
  for (const r of raw) {
    const key = normalizePlatform(r);
    if (key && !result.includes(key)) result.push(key);
  }
  return result;
}

// Relevance indicator badge
function RelevanceBadge({ score, reason }: { score: number; reason: string }) {
  const colors: Record<number, string> = {
    1: 'bg-red-500/15 text-red-400 border-red-500/30',
    2: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    3: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    4: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    5: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  };
  const labels: Record<number, string> = {
    1: '不相關', 2: '略偏離', 3: '一般', 4: '高度相關', 5: '精準相關',
  };

  return (
    <span
      className={`text-[9px] px-1.5 py-0.5 rounded-full border ${colors[score] ?? colors[3]}`}
      title={reason}
    >
      🎯 {labels[score] ?? '一般'}
    </span>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-[11px]">
      {'★'.repeat(Math.max(1, Math.min(5, Math.round(rating))))}
      {'☆'.repeat(Math.max(0, 5 - Math.max(1, Math.min(5, Math.round(rating)))))}
    </span>
  );
}

// ---- Feedback Card ----
function FeedbackCard({
  fb,
  mandarinOverride,
}: {
  fb: ConsumerFeedbackType;
  mandarinOverride?: string | null;
}) {
  const showMandarin = !!mandarinOverride;

  return (
    <div className="bg-gray-800/30 light:bg-gray-200/50 border border-gray-700/50 light:border-gray-300 rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-300 light:text-gray-800 font-medium">👁 {fb.personaName}</span>
        <StarRating rating={fb.rating} />
      </div>
      <p className="text-xs text-gray-400 light:text-gray-600 leading-relaxed italic">
        「{showMandarin ? mandarinOverride : fb.feedback}」
      </p>
      {showMandarin && (
        <p className="text-[10px] text-gray-600 light:text-gray-500 mt-1">已翻譯為普通話</p>
      )}
    </div>
  );
}

// ---- Suggestion Card ----
function SuggestionCard({
  s,
  onApply,
  onUndo,
  onDismiss,
  applying,
  applied,
  appliedCount,
  mandarinSuggestion,
  mandarinReason,
  lowRelevance,
}: {
  s: ConsumerSuggestion;
  onApply: (variantKeys: VariantKey[]) => void;
  onUndo: () => void;
  onDismiss: () => void;
  applying: boolean;
  applied: boolean;
  appliedCount: number;
  mandarinSuggestion?: string | null;
  mandarinReason?: string | null;
  lowRelevance: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [selected, setSelected] = useState<Set<VariantKey>>(new Set());

  const targetPlatforms = normalizeTargetPlatforms(s.targetPlatforms);

  const toggleVariant = (k: VariantKey) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k); else next.add(k);
    setSelected(next);
  };

  const handleApplyClick = () => {
    // If the model identified specific platforms, auto-select them
    if (targetPlatforms.length > 0) {
      // Auto-apply to those platforms directly
      onApply(targetPlatforms);
      return;
    }
    // Otherwise show picker for manual selection
    setShowPicker(true);
  };

  const handleConfirm = () => {
    if (selected.size === 0) return;
    onApply(Array.from(selected));
    setShowPicker(false);
    setSelected(new Set());
  };

  const showMandarin = !!mandarinSuggestion;

  return (
    <div
      className={`rounded-lg p-2.5 transition-all ${
        applied
          ? 'bg-gray-800/10 border border-gray-700/30 light:border-gray-300/50 opacity-60'
          : lowRelevance
            ? 'bg-gray-800/20 light:bg-gray-100 border border-gray-700/20 opacity-50'
            : 'bg-amber-500/5 border border-amber-500/15'
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
        <span className="text-[10px] text-amber-400/80 font-medium">{s.aspect}</span>
        <span className="text-[10px] text-gray-600 light:text-gray-500"> — {s.personaName} 的建議</span>
        {applied && (
          <span className="text-[10px] text-emerald-400 light:text-emerald-600 bg-emerald-500/10 px-1 rounded">✓ 已修改</span>
        )}
        {lowRelevance && !applied && (
          <span className="text-[9px] text-gray-600 light:text-gray-500 bg-gray-700/30 light:bg-gray-200/50 px-1 rounded">低相關</span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {s.relevanceScore != null && (
            <RelevanceBadge score={s.relevanceScore} reason={s.relevanceReason ?? ''} />
          )}
          <button
            onClick={onDismiss}
            className="text-[10px] text-gray-600 light:text-gray-500 hover:text-gray-400 light:hover:text-gray-500 transition-colors"
            title="收起這條建議"
          >
            ✕
          </button>
        </div>
      </div>

      <p className={`text-[11px] leading-relaxed mb-1 ${applied ? 'text-gray-500 light:text-gray-500 line-through' : 'text-gray-300 light:text-gray-800'}`}>
        {showMandarin ? mandarinSuggestion : s.suggestion}
      </p>
      <p className={`text-[10px] italic mb-2 ${applied ? 'text-gray-600 light:text-gray-500 line-through' : 'text-gray-600 light:text-gray-500'}`}>
        💡 {showMandarin ? mandarinReason : s.reason}
      </p>

      {applied ? (
        <button
          onClick={onUndo}
          className="text-[10px] px-2 py-0.5 rounded bg-gray-700/30 light:bg-gray-200/50 border border-gray-600/30 light:border-gray-300
            text-gray-400 light:text-gray-600 hover:text-gray-200 light:hover:text-gray-800 hover:border-gray-500 transition-colors"
        >
          ↩ 復原修改
        </button>
      ) : !showPicker ? (
        <div className="space-y-1.5">
          {appliedCount > 0 && (
            <p className="text-[9px] text-amber-400/70 bg-amber-500/5 px-1.5 py-0.5 rounded">
              ⚠️ 已套用 {appliedCount} 條建議，本次修改會整合避免重複
            </p>
          )}
          <button
            onClick={handleApplyClick}
            disabled={applying}
            className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20
              text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            title={targetPlatforms.length > 0 ? `自動選擇：${targetPlatforms.join(', ')}` : '手動選擇平台'}
          >
            {applying
              ? '⏳ 修改中...'
              : targetPlatforms.length > 0
                ? `🖊 一鍵修改 (${targetPlatforms.map(k => VARIANT_TABS.find(t => t.key === k)?.label ?? k).join('、')})`
                : '🖊 一鍵修改'}
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-500">
            {targetPlatforms.length === 0
              ? '⚠️ 未指定平台，請手動選擇要修改的版本：'
              : '選擇要修改的版本：'}
          </p>
          <div className="flex flex-wrap gap-1">
            {VARIANT_KEYS.map((k) => {
              const label = VARIANT_TABS.find((t) => t.key === k)?.label ?? k;
              return (
                <button
                  key={k}
                  onClick={() => toggleVariant(k)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    selected.has(k)
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-gray-800/50 light:bg-gray-200 border-gray-700/50 light:border-gray-300 text-gray-500 light:text-gray-500 hover:text-gray-300 light:hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="text-[10px] px-2 py-0.5 rounded bg-emerald-600/20 border border-emerald-500/30
                text-emerald-400 light:text-emerald-600 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              確認修改 ({selected.size})
            </button>
            <button
              onClick={() => { setShowPicker(false); setSelected(new Set()); }}
              className="text-[10px] px-2 py-0.5 rounded text-gray-500 light:text-gray-500 hover:text-gray-300 light:hover:text-gray-700"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Score Tracker ----
function ScoreTracker({
  currentScore,
  scoreDelta,
  round,
  scoreHistory,
}: {
  currentScore: number | null;
  scoreDelta: number | null;
  round: number;
  scoreHistory: number[];
}) {
  if (currentScore === null) return null;

  const scoreColor =
    currentScore >= 80 ? 'text-emerald-400 light:text-emerald-600' :
    currentScore >= 65 ? 'text-amber-400' :
    'text-red-400';

  const bgColor =
    currentScore >= 80 ? 'bg-emerald-500/10 border-emerald-500/25' :
    currentScore >= 65 ? 'bg-amber-500/10 border-amber-500/25' :
    'bg-red-500/10 border-red-500/25';

  return (
    <div className={`rounded-lg p-3 border ${bgColor}`}>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] text-gray-500 light:text-gray-500 uppercase tracking-wider">
            📊 生成文案總分
            {round > 0 && <span className="text-gray-600 light:text-gray-500 ml-1"> — 第{round} 輪</span>}
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className={`text-xl font-bold ${scoreColor}`}>{currentScore}</span>
            <span className="text-[10px] text-gray-600 light:text-gray-500">/ 100</span>
            {scoreDelta !== null && round > 0 && (
              <span className={`text-xs font-medium ${
                scoreDelta > 2 ? 'text-emerald-400 light:text-emerald-600' :
                Math.abs(scoreDelta) <= 2 ? 'text-gray-400 light:text-gray-600' :
                'text-red-400'
              }`}>
                {scoreDelta > 0 ? `↑ +${scoreDelta}` : scoreDelta < 0 ? `↓ ${scoreDelta}` : '→ 0'}
              </span>
            )}
          </div>
        </div>

        {/* Mini score history */}
        {scoreHistory.length > 1 && (
          <div className="flex items-center gap-1">
            {scoreHistory.map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                {i > 0 && <span className="text-[9px] text-gray-700">→</span>}
                <span className={`text-[10px] font-mono ${
                  i === scoreHistory.length - 1 ? scoreColor : 'text-gray-600 light:text-gray-500'
                }`}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Convergence verdict */}
      {round >= 1 && scoreDelta !== null && Math.abs(scoreDelta) <= 2 && (
        <div className="mt-2 pt-2 border-t border-gray-700/30 light:border-gray-300/50">
          <p className="text-[11px] text-gray-400 light:text-gray-600 text-center">
            {round >= 2
              ? '🎯 文案已接近最優 — 分數連續穩定，再修改可能無明顯改善，建議定稿'
              : '📊 本輪修改對總分影響不大，可以考慮接受當前版本'}
          </p>
        </div>
      )}
      {round >= 1 && scoreDelta !== null && scoreDelta < -2 && (
        <div className="mt-2 pt-2 border-t border-gray-700/30 light:border-gray-300/50">
          <p className="text-[11px] text-red-400 text-center">
            ⚠️ 修改後總分下降 — 建議復原修改，或換一個建議再試
          </p>
        </div>
      )}
    </div>
  );
}

// ---- Main Section ----
export default function ConsumerFeedbackSection({ feedback }: Props) {
  const { state, dispatch } = useContext(AppContext);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [reEvaluating, setReEvaluating] = useState(false);
  const [hasModifications, setHasModifications] = useState(false);

  // Track applied suggestions + original variant texts for undo
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  // Track the text of applied suggestions for dedup & history passthrough
  const appliedSuggestionsTexts = useRef<string[]>([]);
  // Clean original variant texts — set once on first modification, never mutated until re-evaluate
  const cleanOriginals = useRef<Map<VariantKey, string>>(new Map());
  // Per-suggestion snapshot: before-text for each variant this suggestion modified
  // Key: suggestionId → Map<variantKey, text-before-this-suggestion>
  const suggestionSnapshots = useRef<Map<string, Map<VariantKey, string>>>(new Map());
  // Ordered list of applied suggestion IDs (for dependency tracking)
  const appliedOrder = useRef<string[]>([]);

  // Track dismissed (hidden) suggestions
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);

  // Global translate state
  const [globalMandarin, setGlobalMandarin] = useState(false);
  const [globalTranslating, setGlobalTranslating] = useState(false);
  const [translationCache, setTranslationCache] = useState<Map<string, string>>(new Map());

  // ---- Convergence tracking ----
  const [modificationRound, setModificationRound] = useState(0);
  const [scoreDelta, setScoreDelta] = useState<number | null>(null);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const previousTotalScore = useRef<number | null>(null);

  // Initialize score history from initial generation
  useEffect(() => {
    const currentTotal = state.scores?.generated?.total;
    if (currentTotal != null) {
      previousTotalScore.current = currentTotal;
      if (scoreHistory.length === 0) {
        setScoreHistory([currentTotal]);
      }
    }
  }, [state.scores?.generated?.total]); // eslint-disable-line react-hooks/exhaustive-deps

  // Collect all suggestions across all personas
  const allSuggestions: ConsumerSuggestion[] = feedback.flatMap(
    (fb) => (fb.suggestions ?? []).map((s) => ({
      ...s,
      personaId: fb.personaId,
      personaName: fb.personaName,
      // Default relevanceScore if model didn't provide one
      relevanceScore: s.relevanceScore ?? 3,
      relevanceReason: s.relevanceReason ?? '',
    })),
  );
  // Separate suggestions by relevance
  const highRelevance = allSuggestions.filter((s) => (s.relevanceScore ?? 3) >= 3);
  const lowRelevance = allSuggestions.filter((s) => (s.relevanceScore ?? 3) <= 2);
  const [showLowRelevance, setShowLowRelevance] = useState(false);

  const handleApplySuggestion = useCallback(
    async (suggestion: ConsumerSuggestion, variantKeys: VariantKey[]) => {
      const id = suggestionId(suggestion);
      setApplyingId(id);

      // ---- Save per-suggestion snapshot BEFORE modification ----
      // Each suggestion records the text of each affected variant BEFORE it runs,
      // so undoing this suggestion can restore exactly the right state.
      const snapshots = new Map<VariantKey, string>();
      for (const key of variantKeys) {
        const variantText = state.variants?.[key];
        if (!variantText) continue;
        // Save clean original (first time this variant is touched)
        if (!cleanOriginals.current.has(key)) {
          cleanOriginals.current.set(key, variantText);
        }
        // Save before-text for THIS suggestion
        snapshots.set(key, variantText);
      }
      suggestionSnapshots.current.set(id, snapshots);

      // ---- Apply modification to each variant ----
      for (const key of variantKeys) {
        const variantText = state.variants?.[key];
        if (!variantText) continue;

        try {
          const res = await fetch(apiUrl('/apply-suggestion'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              variantText,
              suggestion: suggestion.suggestion,
              reason: suggestion.reason,
              brandRedLines: state.settings.brandRedLines || undefined,
              // Pass clean original + history so LLM can make a clean edit
              originalText: cleanOriginals.current.get(key) || undefined,
              appliedSuggestions: appliedSuggestionsTexts.current.length > 0
                ? [...appliedSuggestionsTexts.current]
                : undefined,
            }),
          });
          const data = await res.json();
          if (data.modifiedText) {
            // Save diff baseline — use text BEFORE this modification
            if (!state.modifiedVariants[key]) {
              dispatch({ type: 'MARK_VARIANT_MODIFIED', payload: { key, originalText: variantText } });
            }
            dispatch({ type: 'UPDATE_VARIANT', payload: { key, text: data.modifiedText } });
          }
        } catch {
          // continue
        }
      }

      // Track this suggestion
      appliedSuggestionsTexts.current = [...appliedSuggestionsTexts.current, suggestion.suggestion];
      appliedOrder.current = [...appliedOrder.current, id];

      setApplyingId(null);
      setAppliedIds((prev) => new Set(prev).add(id));
      setHasModifications(true);
    },
    [state.variants, state.settings.brandRedLines, state.modifiedVariants, dispatch],
  );

  const handleUndoSuggestion = useCallback(
    (suggestion: ConsumerSuggestion) => {
      const id = suggestionId(suggestion);

      // ---- Get the before-state snapshot for THIS suggestion ----
      const snapshots = suggestionSnapshots.current.get(id);
      if (!snapshots || snapshots.size === 0) return;

      // Find all suggestions applied AFTER this one that touch the SAME variants
      const idx = appliedOrder.current.indexOf(id);
      const laterIds =
        idx >= 0
          ? appliedOrder.current.slice(idx + 1).filter((laterId) => {
              const laterSnapshots = suggestionSnapshots.current.get(laterId);
              if (!laterSnapshots) return false;
              // Check if any variant overlaps
              for (const key of snapshots.keys()) {
                if (laterSnapshots.has(key)) return true;
              }
              return false;
            })
          : [];

      // If later suggestions depend on this one, warn and remove them too
      const removedLaterIds = new Set(laterIds);

      // ---- Restore each variant to its before-this-suggestion state ----
      for (const [key, beforeText] of snapshots) {
        dispatch({ type: 'UPDATE_VARIANT', payload: { key, text: beforeText } });
      }

      // ---- Clean up: remove this suggestion + dependent later ones ----
      suggestionSnapshots.current.delete(id);
      for (const laterId of laterIds) {
        suggestionSnapshots.current.delete(laterId);
      }

      // Rebuild appliedOrder and appliedSuggestionsTexts without removed suggestions
      const removedIds = new Set([id, ...laterIds]);
      appliedOrder.current = appliedOrder.current.filter((oid) => !removedIds.has(oid));
      // Rebuild suggestion texts from remaining order
      appliedSuggestionsTexts.current = appliedOrder.current
        .map((oid) => {
          // Find the suggestion text from allSuggestions
          const s = allSuggestions.find((as) => suggestionId(as) === oid);
          return s?.suggestion ?? '';
        })
        .filter(Boolean);

      // For variants that no longer have any modifications, clear diff
      const stillModifiedKeys = new Set<VariantKey>();
      for (const snap of suggestionSnapshots.current.values()) {
        for (const key of snap.keys()) {
          stillModifiedKeys.add(key);
        }
      }
      for (const key of snapshots.keys()) {
        if (!stillModifiedKeys.has(key)) {
          // No more modifications for this variant — restore clean original
          const clean = cleanOriginals.current.get(key);
          if (clean) {
            dispatch({ type: 'UPDATE_VARIANT', payload: { key, text: clean } });
          }
        }
      }

      // If no suggestions remain, fully reset
      if (appliedOrder.current.length === 0) {
        cleanOriginals.current.clear();
        dispatch({ type: 'CLEAR_MODIFICATIONS' });
        setHasModifications(false);
      }

      setAppliedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        for (const lid of laterIds) next.delete(lid);
        if (next.size === 0) setHasModifications(false);
        return next;
      });

      // Log warning for removed dependent suggestions
      if (laterIds.length > 0) {
        console.warn(
          `[ConsumerFeedback] Undo "${suggestion.aspect}" also removed ${laterIds.length} dependent later suggestion(s) that touched the same variants.`,
        );
      }
    },
    [dispatch, allSuggestions],
  );

  const handleReEvaluate = useCallback(async () => {
    if (!state.variants) return;
    setReEvaluating(true);

    // Save current score for delta comparison
    const prevTotal = state.scores?.generated?.total ?? previousTotalScore.current;

    try {
      const res = await fetch(apiUrl('/re-evaluate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variants: state.variants,
          consumerPersonas: state.settings.consumerPersonas.length > 0
            ? state.settings.consumerPersonas
            : undefined,
          platform: state.settings.platform,
          source: state.source,
          brandName: state.settings.brandName || undefined,
          productName: state.settings.productName || undefined,
          previousScores: state.scores?.generated ?? undefined,
        }),
      });

      if (!res.ok) throw new Error('Re-evaluation failed');

      const data = await res.json();
      dispatch({
        type: 'SET_RE_EVALUATION',
        payload: {
          audit: data.audit,
          scores: data.scores ?? null,
          consumerFeedback: data.consumerFeedback ?? null,
        },
      });

      // Compute score delta
      const newTotal = data.scores?.generated?.total;
      if (prevTotal != null && newTotal != null) {
        const delta = newTotal - prevTotal;
        setScoreDelta(delta);
        previousTotalScore.current = newTotal;
        setScoreHistory((prev) => [...prev, newTotal]);
      } else if (newTotal != null) {
        setScoreHistory((prev) => [...prev, newTotal]);
      }

      setModificationRound((r) => r + 1);
      setHasModifications(false);
      setAppliedIds(new Set());
      appliedSuggestionsTexts.current = [];
      appliedOrder.current = [];
      cleanOriginals.current.clear();
      suggestionSnapshots.current.clear();
    } catch {
      // silently fail
    } finally {
      setReEvaluating(false);
    }
  }, [state.variants, state.settings, state.source, state.scores, dispatch]);

  // ---- Batch translate all feedback + suggestions ----
  const handleGlobalTranslate = useCallback(async () => {
    if (globalMandarin) {
      setGlobalMandarin(false);
      return;
    }

    setGlobalTranslating(true);

    const textsToTranslate: string[] = [];
    for (const fb of feedback) {
      if (!translationCache.has(fb.feedback)) textsToTranslate.push(fb.feedback);
    }
    for (const s of allSuggestions) {
      if (!translationCache.has(s.suggestion)) textsToTranslate.push(s.suggestion);
      if (!translationCache.has(s.reason)) textsToTranslate.push(s.reason);
    }

    if (textsToTranslate.length > 0) {
      const results = await Promise.all(
        textsToTranslate.map(async (text) => {
          try {
            const res = await fetch(apiUrl('/translate'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text }),
            });
            const data = await res.json();
            return { original: text, translated: data.translated ?? text };
          } catch {
            return { original: text, translated: text };
          }
        }),
      );

      setTranslationCache((prev) => {
        const next = new Map(prev);
        for (const r of results) {
          next.set(r.original, r.translated);
        }
        return next;
      });
    }

    setGlobalTranslating(false);
    setGlobalMandarin(true);
  }, [globalMandarin, feedback, allSuggestions, translationCache]);

  if (!feedback || feedback.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Score Tracker — always visible */}
      <ScoreTracker
        currentScore={state.scores?.generated?.total ?? null}
        scoreDelta={scoreDelta}
        round={modificationRound}
        scoreHistory={scoreHistory}
      />

      {/* Section header with batch translate */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 light:text-gray-500 uppercase tracking-wider">📰 目標消費者反饋</span>
          {modificationRound > 0 && (
            <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              第{modificationRound} 輪優化
            </span>
          )}
        </div>
        <button
          onClick={handleGlobalTranslate}
          disabled={globalTranslating}
          className="text-[10px] px-2 py-0.5 rounded border border-gray-600/50 light:border-gray-300
            text-gray-500 light:text-gray-500 hover:text-gray-300 light:hover:text-gray-700 hover:border-gray-500 transition-colors
            disabled:opacity-50"
        >
          {globalTranslating ? '⏳ 翻譯中...' : globalMandarin ? '🇭🇰 顯示粵語原文' : '🔄 一鍵翻譯普通話'}
        </button>
      </div>

      {/* Feedback comments */}
      <div className="space-y-2">
        {feedback.map((fb) => (
          <FeedbackCard
            key={fb.personaId}
            fb={fb}
            mandarinOverride={globalMandarin ? translationCache.get(fb.feedback) ?? null : null}
          />
        ))}
      </div>

      {/* Modification suggestions */}
      {allSuggestions.length > 0 ? (
        <div className="space-y-2 border-t border-gray-800 light:border-gray-200 pt-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-gray-500 light:text-gray-500 uppercase tracking-wider">
              🖊 消費者修改建議
              <span className="text-gray-600 light:text-gray-500 normal-case ml-1">— 根據建議一鍵優化文案</span>
              {appliedIds.size > 0 && (
                <span className="text-emerald-400 light:text-emerald-600 ml-1">({appliedIds.size} 已套用)</span>
              )}
            </div>
            {appliedIds.size > 0 && (
              <button
                onClick={() => {
                  // Reset all variants to clean originals
                  for (const [key, originalText] of cleanOriginals.current) {
                    dispatch({ type: 'UPDATE_VARIANT', payload: { key, text: originalText } });
                  }
                  cleanOriginals.current.clear();
                  suggestionSnapshots.current.clear();
                  appliedSuggestionsTexts.current = [];
                  appliedOrder.current = [];
                  dispatch({ type: 'CLEAR_MODIFICATIONS' });
                  setAppliedIds(new Set());
                  setHasModifications(false);
                }}
                className="text-[9px] px-2 py-0.5 rounded border border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                title="放棄所有修改，恢復為原始文案"
              >
                ↩ 重置為原文              </button>
            )}
          </div>

          {/* High relevance suggestions */}
          <div className="space-y-2">
            {highRelevance.map((s, i) => {
              const id = suggestionId(s);
              const isDismissed = dismissedIds.has(id);
              if (isDismissed && !showDismissed) return null;
              return (
                <SuggestionCard
                  key={`${s.personaId}-${i}`}
                  s={s}
                  applying={applyingId === id}
                  applied={appliedIds.has(id)}
                  appliedCount={appliedIds.size}
                  onApply={(keys) => handleApplySuggestion(s, keys)}
                  onUndo={() => handleUndoSuggestion(s)}
                  onDismiss={() => setDismissedIds((prev) => new Set(prev).add(id))}
                  mandarinSuggestion={globalMandarin ? translationCache.get(s.suggestion) ?? null : null}
                  mandarinReason={globalMandarin ? translationCache.get(s.reason) ?? null : null}
                  lowRelevance={false}
                />
              );
            })}
          </div>

          {/* Low relevance suggestions — collapsed by default */}
          {lowRelevance.length > 0 && (
            <div className="border-t border-gray-800/50 light:border-gray-200 pt-2">
              <button
                onClick={() => setShowLowRelevance(!showLowRelevance)}
                className="text-[10px] text-gray-600 light:text-gray-500 hover:text-gray-400 light:hover:text-gray-500 transition-colors flex items-center gap-1"
              >
                {showLowRelevance
                  ? '🔿 隱藏低相關建議'
                  : `⚠️ 低相關建議(${lowRelevance.length}) — 這些建議可能偏離主題，點擊展開`}
              </button>
              {showLowRelevance && (
                <div className="space-y-2 mt-2">
                  {lowRelevance.map((s, i) => {
                    const id = suggestionId(s);
                    const isDismissed = dismissedIds.has(id);
                    if (isDismissed && !showDismissed) return null;
                    return (
                      <SuggestionCard
                        key={`low-${s.personaId}-${i}`}
                        s={s}
                        applying={applyingId === id}
                        applied={appliedIds.has(id)}
                        appliedCount={appliedIds.size}
                        onApply={(keys) => handleApplySuggestion(s, keys)}
                        onUndo={() => handleUndoSuggestion(s)}
                        onDismiss={() => setDismissedIds((prev) => new Set(prev).add(id))}
                        mandarinSuggestion={globalMandarin ? translationCache.get(s.suggestion) ?? null : null}
                        mandarinReason={globalMandarin ? translationCache.get(s.reason) ?? null : null}
                        lowRelevance={true}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {dismissedIds.size > 0 && (
            <button
              onClick={() => setShowDismissed(!showDismissed)}
              className="text-[10px] text-gray-600 light:text-gray-500 hover:text-gray-400 light:hover:text-gray-500 transition-colors"
            >
              {showDismissed ? '🔿 隱藏已收起的建議' : `📥 顯示已收起的建議 (${dismissedIds.size})`}
            </button>
          )}
        </div>
      ) : (
        <div className="border-t border-gray-800 light:border-gray-200 pt-2">
          <p className="text-[10px] text-gray-600 light:text-gray-500 italic">
            💡 重新生成即可獲得每位消費者的具體修改建議，支持一鍵優化文案
          </p>
        </div>
      )}

      {/* Re-evaluate button — shown after modifications */}
      {hasModifications && (
        <div className="border-t border-gray-800 light:border-gray-200 pt-3">
          <div className="bg-emerald-500/5 light:bg-emerald-50 border border-emerald-500/20 light:border-emerald-200 rounded-lg p-3 text-center">
            <p className="text-[11px] text-gray-400 light:text-gray-600 mb-2">
              文案已修改，評分和消費者反饋需要更新才會反映改動
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={handleReEvaluate}
                disabled={reEvaluating}
                className="text-xs px-4 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30
                  text-emerald-400 light:text-emerald-600 hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
              >
                {reEvaluating
                  ? '⏳ 重新評分中...'
                  : `🔄 重新評分及消費者反饋${modificationRound > 0 ? ` (第${modificationRound + 1}輪)` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
