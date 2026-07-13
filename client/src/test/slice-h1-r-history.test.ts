import { beforeEach, describe, expect, it } from 'vitest';
import type { GenerationJob } from '../types';
import {
  buildWorkbenchSnapshotFromHistory,
  getHistoryJobLoadability,
  loadWorkbenchSnapshot,
  saveWorkbenchSnapshotFromHistory,
} from '../services/workbenchSnapshot';

function makeCompletedJob(overrides: Partial<GenerationJob> = {}): GenerationJob {
  return {
    id: 'history-job-1',
    ownerId: 'owner-a',
    idempotencyKey: 'history-key-1',
    status: 'completed',
    source: '历史原文',
    platform: 'facebook',
    tone: '高級',
    cantoneseLevel: 5,
    englishMixingLevel: 2,
    creativityLevel: 3,
    inputLanguage: 'cantonese',
    brandName: '测试品牌',
    productName: '测试产品',
    brandRedLines: '不要夸大',
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
    brief: null,
    errorMessage: null,
    errorCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  sessionStorage.clear();
});

describe('历史记录载入工作台', () => {
  it('恢复历史记录的真实平台、语气、语言和生成结果', () => {
    const { snapshot, reason } = buildWorkbenchSnapshotFromHistory(makeCompletedJob());

    expect(reason).toBeUndefined();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.settings.platform).toBe('facebook');
    expect(snapshot?.settings.tone).toBe('高級');
    expect(snapshot?.settings.inputLanguage).toBe('cantonese');
    expect(snapshot?.settings.cantoneseLevel).toBe(5);
    expect(snapshot?.settings.creativityLevel).toBe(3);
    expect(snapshot?.activeTab).toBe('facebook');
    expect(snapshot?.variants?.facebook).toBe('Facebook 文案');
    expect(snapshot?.uiState).toBe('success');
  });

  it('拒绝未完成或缺少核心结果的历史记录', () => {
    expect(getHistoryJobLoadability(makeCompletedJob({ status: 'failed' })).loadable).toBe(false);
    const incomplete = buildWorkbenchSnapshotFromHistory(makeCompletedJob({ audit: null }));
    expect(incomplete.snapshot).toBeNull();
    expect(incomplete.reason).toMatch(/缺少审核结果/);
  });
});

describe('工作台 session 快照', () => {
  it('按 owner 隔离并可在当前标签页恢复', () => {
    const { snapshot } = buildWorkbenchSnapshotFromHistory(makeCompletedJob());
    expect(snapshot).not.toBeNull();
    saveWorkbenchSnapshotFromHistory('owner-a', snapshot!);

    expect(loadWorkbenchSnapshot('owner-a')?.source).toBe('历史原文');
    expect(loadWorkbenchSnapshot('owner-b')).toBeNull();
  });

  it('损坏 JSON 或字段类型不合法时安全回退', () => {
    sessionStorage.setItem('hk-cantonese-workbench:owner-a', '{bad json');
    expect(loadWorkbenchSnapshot('owner-a')).toBeNull();

    const { snapshot } = buildWorkbenchSnapshotFromHistory(makeCompletedJob());
    sessionStorage.setItem(
      'hk-cantonese-workbench:owner-a',
      JSON.stringify({ ...snapshot, settings: { ...snapshot!.settings, platform: 'invalid' } }),
    );
    expect(loadWorkbenchSnapshot('owner-a')).toBeNull();
  });
});
