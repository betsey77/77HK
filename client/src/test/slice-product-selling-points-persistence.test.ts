import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../context/AppContext';
import { configRecordToSavedConfig, configToSyncConfig } from '../services/cloudSync';
import { buildWorkbenchSnapshotFromHistory } from '../services/workbenchSnapshot';
import type { GenerationJob, ProductSellingPoint, SavedConfig } from '../types';

const points: ProductSellingPoint[] = [
  {
    id: 'point-1',
    sourceText: '轻便易携带',
    cantoneseText: '夠輕身，拎出街都方便',
    status: 'ready',
  },
];

function makeConfig(): SavedConfig {
  return {
    id: 'config-1',
    name: '卖点配置',
    brandName: '测试品牌',
    productName: '测试产品',
    brandRedLines: '禁止夸大',
    productSellingPoints: points,
    structuredBriefEnabled: false,
    creativityLevel: 1,
    cantoneseLevel: 4,
    englishMixingLevel: 1,
    tone: '穩妥',
    platform: 'all',
    inputLanguage: 'mandarin',
    consumerPersonas: [],
    createdAt: '2026-07-18T00:00:00.000Z',
  };
}

function makeCompletedJob(): GenerationJob {
  const now = '2026-07-18T00:00:00.000Z';
  return {
    id: 'job-1', ownerId: 'owner-1', idempotencyKey: 'key-1', status: 'completed',
    source: '历史原文', platform: 'ig', tone: '穩妥', cantoneseLevel: 4,
    englishMixingLevel: 1, creativityLevel: 1, inputLanguage: 'mandarin',
    brandName: '测试品牌', productName: '测试产品', brandRedLines: '禁止夸大',
    brief: { workbenchSettings: { productSellingPoints: points } },
    diagnosis: { hasSimplifiedChars: false, mainlandPhrases: [], issues: [] },
    variants: { standardHK: '一', lightCantonese: '二', ig: '三', facebook: '四', shorts: '五' },
    audit: { thermometer: { overall: 80, dimensions: {} as never }, issues: [], replacements: [], risks: [], comments: [] },
    scores: null, consumerFeedback: null, variantMeta: null, generationEngine: 'deepseek',
    errorMessage: null, errorCode: null, createdAt: now, updatedAt: now, completedAt: now, deletedAt: null,
  };
}

describe('产品卖点配置与历史恢复', () => {
  it('normalizeSettings 白名单并限制产品卖点', () => {
    const normalized = normalizeSettings({ productSellingPoints: [...points, { bad: true }] });
    expect(normalized.productSellingPoints).toEqual(points);
  });

  it('云配置序列化与恢复保留原文、港话表达和状态', () => {
    const config = makeConfig();
    const payload = configToSyncConfig(config);
    expect(payload.config.productSellingPoints).toEqual(points);

    const restored = configRecordToSavedConfig({
      id: 'row-1', ownerId: 'owner-1', clientId: config.id, name: config.name,
      config: payload.config, createdAt: config.createdAt, updatedAt: config.createdAt,
    });
    expect(restored.productSellingPoints).toEqual(points);
  });

  it('生成历史载入完整恢复卖点原文与港话表达', () => {
    const { snapshot } = buildWorkbenchSnapshotFromHistory(makeCompletedJob());
    expect(snapshot?.settings.productSellingPoints).toEqual(points);
  });
});
