import { describe, expect, it } from 'vitest';
import type { GenerationJob } from '../types';
import {
  HISTORY_RECOVERY_NOTE,
  buildWorkbenchSnapshotFromHistory,
} from '../services/workbenchSnapshot';

function makeCompletedJob(brief: Record<string, unknown>): GenerationJob {
  const now = new Date().toISOString();

  return {
    id: 'history-settings-job',
    ownerId: 'owner-a',
    idempotencyKey: 'history-settings-key',
    status: 'completed',
    source: '历史原文',
    platform: 'ig',
    tone: '穩妥',
    cantoneseLevel: 4,
    englishMixingLevel: 1,
    creativityLevel: 1,
    inputLanguage: 'mandarin',
    brandName: '思念',
    productName: '煎饺王',
    brandRedLines: '不要夸大',
    brief,
    diagnosis: { hasSimplifiedChars: false, mainlandPhrases: [], issues: [] },
    variants: {
      standardHK: '标准港式',
      lightCantonese: '轻粤语',
      ig: 'IG 文案',
      facebook: 'Facebook 文案',
      shorts: 'Shorts 文案',
    },
    audit: {
      thermometer: { overall: 88, dimensions: {} as never },
      issues: [],
      replacements: [],
      risks: [],
      comments: [],
    },
    scores: null,
    consumerFeedback: null,
    variantMeta: null,
    generationEngine: 'deepseek',
    errorMessage: null,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    deletedAt: null,
  };
}

describe('生成历史恢复左侧输入配置', () => {
  it('兼容恢复旧历史中已经保存的结构化写作、画像、收藏案例和日历事件', () => {
    const persona = {
      id: 'persona-1',
      name: '香港通勤族',
      ageRange: '25-34',
      occupation: '白领',
      habits: '通勤时刷 IG',
      apps: 'Instagram',
      notes: '重视方便快捷',
    };

    const { snapshot } = buildWorkbenchSnapshotFromHistory(makeCompletedJob({
      structuredBriefEnabled: true,
      consumerPersonas: [persona],
      referenceCases: [{ id: 'favorite-1', content: '参考文案', variantKey: 'ig' }],
      calendarEventIds: ['mid-autumn'],
    }));

    expect(snapshot?.settings.structuredBriefEnabled).toBe(true);
    expect(snapshot?.settings.consumerPersonas).toEqual([persona]);
    expect(snapshot?.settings.selectedReferenceCaseIds).toEqual(['favorite-1']);
    expect(snapshot?.settings.selectedCalendarEventIds).toEqual(['mid-autumn']);
  });

  it('优先恢复新历史保存的完整工作台配置', () => {
    const { snapshot } = buildWorkbenchSnapshotFromHistory(makeCompletedJob({
      workbenchSettings: {
        structuredBriefEnabled: true,
        consumerPersonas: [],
        targetDate: '2026-09-25',
        competitorQueries: ['竞品甲', '竞品乙'],
        selectedReferenceCaseIds: ['favorite-2', 'favorite-3'],
        selectedCalendarEventIds: ['national-day'],
      },
    }));

    expect(snapshot?.settings.targetDate).toBe('2026-09-25');
    expect(snapshot?.settings.competitorQueries).toEqual(['竞品甲', '竞品乙']);
    expect(snapshot?.settings.selectedReferenceCaseIds).toEqual(['favorite-2', 'favorite-3']);
    expect(snapshot?.settings.selectedCalendarEventIds).toEqual(['national-day']);
  });

  it('提供明确的历史恢复提示文案', () => {
    expect(HISTORY_RECOVERY_NOTE).toContain('文字消失');
    expect(HISTORY_RECOVERY_NOTE).toContain('载入工作台');
  });
});
