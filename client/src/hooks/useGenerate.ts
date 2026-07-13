import { useCallback, useContext, useRef } from 'react';
import { AppContext } from '../context/AppContext';
import { generateCopy } from '../services/api';
import type { GenerationProgress, GenerationStage, StageProgress } from '../types';

const STAGE_LABELS: Record<GenerationStage, string> = {
  diagnosis: '诊断原文',
  generation: '生成变体',
  audit: '质量审核',
  feedback: '消费者反馈',
};

/** Estimated durations in ms for each stage (for simulated progress) */
const STAGE_DURATIONS: Record<GenerationStage, { min: number; max: number }> = {
  diagnosis: { min: 800, max: 2500 },
  generation: { min: 3000, max: 12000 },
  audit: { min: 2000, max: 8000 },
  feedback: { min: 3000, max: 15000 },
};

/** Generate a UUID v4 string — uses crypto.randomUUID() with an RFC 4122 v4 fallback. */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function buildProgress(stages: GenerationStage[]): GenerationProgress {
  return {
    stages: stages.map((stage) => ({
      stage,
      label: STAGE_LABELS[stage],
      status: 'pending' as const,
    })),
    startedAt: Date.now(),
    isEstimated: true,
  };
}

export function useGenerate() {
  const { state, dispatch } = useContext(AppContext);
  const stageTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /** Clear all active stage timers */
  function clearAllTimers() {
    stageTimers.current.forEach(clearTimeout);
    stageTimers.current = [];
  }

  /** Advance a stage to active, with estimated completion timeout */
  function scheduleStage(stage: GenerationStage) {
    dispatch({
      type: 'ADVANCE_STAGE',
      payload: { stage, status: 'active' },
    });
  }

  /** Mark a stage as done */
  function completeStage(stage: GenerationStage) {
    dispatch({
      type: 'ADVANCE_STAGE',
      payload: { stage, status: 'done' },
    });
  }

  /** Mark a stage as failed */
  function failPendingStages(completedIndex: number) {
    const allStages: GenerationStage[] = ['diagnosis', 'generation', 'audit', 'feedback'];
    for (const stage of allStages.slice(completedIndex + 1)) {
      dispatch({
        type: 'ADVANCE_STAGE',
        payload: { stage, status: 'failed' },
      });
    }
  }

  const generate = useCallback(async (refresh = false) => {
    if (!state.source.trim()) return;

    dispatch({ type: 'START_GENERATING' });

    // Initialize progress — all 4 stages pending
    const allStages: GenerationStage[] = ['diagnosis', 'generation', 'audit', 'feedback'];
    dispatch({
      type: 'SET_GENERATION_PROGRESS',
      payload: buildProgress(allStages),
    });

    // Start first stage immediately
    scheduleStage('diagnosis');

    // Schedule stage transitions
    // Stage 1→2: diagnosis→generation
    stageTimers.current.push(
      setTimeout(() => {
        completeStage('diagnosis');
        scheduleStage('generation');
      }, STAGE_DURATIONS.diagnosis.min + Math.random() * (STAGE_DURATIONS.diagnosis.max - STAGE_DURATIONS.diagnosis.min)),
    );

    // Stage 2→3: generation→audit
    stageTimers.current.push(
      setTimeout(() => {
        completeStage('generation');
        scheduleStage('audit');
      }, STAGE_DURATIONS.diagnosis.max + STAGE_DURATIONS.generation.min + Math.random() * (STAGE_DURATIONS.generation.max - STAGE_DURATIONS.generation.min)),
    );

    // Stage 3→4: audit→feedback
    stageTimers.current.push(
      setTimeout(() => {
        completeStage('audit');
        scheduleStage('feedback');
      }, STAGE_DURATIONS.diagnosis.max + STAGE_DURATIONS.generation.max + STAGE_DURATIONS.audit.min + Math.random() * (STAGE_DURATIONS.audit.max - STAGE_DURATIONS.audit.min)),
    );

    const idempotencyKey = `gen-${Date.now()}-${generateUUID().slice(0, 8)}`;

    try {
      const referenceCases =
        state.settings.selectedReferenceCaseIds &&
        state.settings.selectedReferenceCaseIds.length > 0
          ? state.bookmarkedCopies
              .filter((b) => state.settings.selectedReferenceCaseIds?.includes(b.id))
              .map((b) => ({
                id: b.id,
                content: b.content,
                rating: b.rating,
                reasonTags: b.reasonTags,
                favoriteReason: b.favoriteReason,
                variantKey: b.variantKey,
              }))
          : undefined;

      const result = await generateCopy(
        {
          source: state.source,
          platform: state.settings.platform,
          tone: state.settings.tone,
          cantoneseLevel: state.settings.cantoneseLevel,
          englishMixingLevel: state.settings.englishMixingLevel,
          useEnhancement: false,
          brandName: state.settings.brandName || undefined,
          productName: state.settings.productName || undefined,
          brandRedLines: state.settings.brandRedLines || undefined,
          structuredBriefEnabled: state.settings.structuredBriefEnabled || undefined,
          creativityLevel: state.settings.creativityLevel,
          inputLanguage: state.settings.inputLanguage,
          refresh: refresh || undefined,
          consumerPersonas:
            state.settings.consumerPersonas.length > 0
              ? state.settings.consumerPersonas
              : undefined,
          referenceCases,
          calendarEventIds:
            state.settings.selectedCalendarEventIds &&
            state.settings.selectedCalendarEventIds.length > 0
              ? state.settings.selectedCalendarEventIds
              : undefined,
        },
        idempotencyKey,
      );

      // Success — complete all remaining stages
      clearAllTimers();
      allStages.forEach((s) => completeStage(s));
      dispatch({ type: 'CLEAR_PROGRESS' });
      dispatch({ type: 'SET_RESULTS', payload: result });
    } catch (err) {
      clearAllTimers();
      // Mark current and remaining stages as failed
      failPendingStages(-1); // fail all
      dispatch({ type: 'CLEAR_PROGRESS' });
      const message = err instanceof Error ? err.message : '生成失败，请重试';
      dispatch({ type: 'SET_ERROR', payload: message });
    }
  }, [state.source, state.settings, dispatch]);

  return {
    generate,
    isLoading: state.uiState === 'loading',
    error: state.error,
    canGenerate: state.source.trim().length > 0 && state.uiState !== 'loading',
  };
}
