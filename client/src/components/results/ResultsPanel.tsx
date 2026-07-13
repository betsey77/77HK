import { useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AppContext } from '../../context/AppContext';
import Tabs from '../shared/Tabs';
import Spinner from '../shared/Spinner';
import GenerationProgress from './GenerationProgress';
import DiagnosisSummary from './DiagnosisSummary';
import ResultCard from './ResultCard';
import { VARIANT_TABS } from '../../constants';
import type { VariantKey } from '../../types';

type TranslationCache = Partial<Record<VariantKey, string>>;

export default function ResultsPanel() {
  const { state, dispatch } = useContext(AppContext);
  const { variants, diagnosis, uiState, activeTab, error } = state;

  // Translate-all state
  const [translatingAll, setTranslatingAll] = useState(false);
  const [translationCache, setTranslationCache] = useState<TranslationCache>({});
  const [showAllTranslations, setShowAllTranslations] = useState(false);

  // Track previous variants to detect content changes (new generation / modification)
  const prevVariantsRef = useRef(variants);

  // Auto-clear translations when variants change (new generation, modification applied, etc.)
  useEffect(() => {
    if (variants !== prevVariantsRef.current) {
      prevVariantsRef.current = variants;
      setTranslationCache({});
      setShowAllTranslations(false);
    }
  }, [variants]);

  const handleTranslateAll = useCallback(async () => {
    if (showAllTranslations) {
      // Toggle off — hide all translations
      setShowAllTranslations(false);
      return;
    }

    if (!variants) return;

    // If already cached, just toggle on
    const allKeys: VariantKey[] = ['standardHK', 'lightCantonese', 'ig', 'facebook', 'shorts'];
    const allCached = allKeys.every((k) => translationCache[k]);

    if (allCached) {
      setShowAllTranslations(true);
      return;
    }

    setTranslatingAll(true);

    // Translate uncached variants in parallel
    const uncached = allKeys.filter((k) => !translationCache[k]);
    const results = await Promise.all(
      uncached.map(async (key) => {
        const text = variants[key];
        if (!text) return { key, translated: '' };
        try {
          const res = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          const data = await res.json();
          return { key, translated: data.translated ?? text };
        } catch {
          return { key, translated: text };
        }
      }),
    );

    setTranslationCache((prev) => {
      const next = { ...prev };
      for (const r of results) {
        next[r.key] = r.translated;
      }
      return next;
    });

    setTranslatingAll(false);
    setShowAllTranslations(true);
  }, [variants, translationCache, showAllTranslations]);

  if (uiState === 'loading') {
    return (
      <div className="flex items-center justify-center h-full p-4">
        {state.generationProgress ? (
          <GenerationProgress progress={state.generationProgress} />
        ) : (
          <Spinner label="生成中，请稍候..." />
        )}
      </div>
    );
  }

  if (uiState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 gap-3">
        <div className="text-red-400 text-sm text-center">{error}</div>
        <button
          onClick={() => dispatch({ type: 'RESET' })}
          className="px-4 py-1.5 bg-gray-800 light:bg-gray-100 text-gray-300 light:text-gray-800 text-xs rounded-lg hover:bg-gray-700 light:hover:bg-gray-200 transition-colors"
        >
          重试
        </button>
      </div>
    );
  }

  if (!variants || uiState === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-2">
        <div className="text-3xl opacity-30">🎋</div>
        <p className="text-sm text-gray-500 light:text-gray-500">在左边贴上原文，设定参数，然后按「生成文案」</p>
        <p className="text-xs text-gray-600 light:text-gray-500">支持普通话、简体中文、英文社媒文案</p>
      </div>
    );
  }

  const currentContent = variants[activeTab] ?? variants.lightCantonese;
  const currentTranslated = showAllTranslations ? (translationCache[activeTab] ?? null) : undefined;

  return (
    <div className="flex flex-col h-full">
      {diagnosis && <DiagnosisSummary diagnosis={diagnosis} />}

      <div className="flex items-end justify-between mt-2">
        <Tabs
          tabs={VARIANT_TABS}
          activeTab={activeTab}
          onTabChange={(key) => dispatch({ type: 'SET_ACTIVE_TAB', payload: key as VariantKey })}
        />
        <button
          onClick={handleTranslateAll}
          disabled={translatingAll}
          className="text-[10px] px-2 py-1 rounded border border-gray-600/40 light:border-gray-300
            text-gray-500 light:text-gray-500 hover:text-gray-300 light:hover:text-gray-700 hover:border-gray-500 transition-colors
            disabled:opacity-50 whitespace-nowrap ml-2 mb-0.5"
        >
          {translatingAll
            ? '⏳ 翻译中...'
            : showAllTranslations
              ? '🇭🇰 显示粤语'
              : '🔤 译普'}
        </button>
      </div>

      <div className="flex-1 mt-3 overflow-hidden">
        <ResultCard
          key={activeTab}
          title={VARIANT_TABS.find((t) => t.key === activeTab)?.label ?? ''}
          variantKey={activeTab}
          content={currentContent}
          originalText={state.modifiedVariants[activeTab] ?? null}
          externalTranslatedText={currentTranslated}
          externalTranslating={translatingAll}
          variantMeta={state.variantMeta?.[activeTab] ?? null}
          onEdit={(newText: string) => {
            // Save original before first modification (for diff highlighting)
            if (!state.modifiedVariants[activeTab]) {
              dispatch({ type: 'MARK_VARIANT_MODIFIED', payload: { key: activeTab, originalText: currentContent } });
            }
            dispatch({ type: 'UPDATE_VARIANT', payload: { key: activeTab, text: newText } });
          }}
        />
      </div>
    </div>
  );
}
