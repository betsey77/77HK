import { describe, expect, it } from 'vitest';
import {
  shouldBlockCloudSync,
  shouldRefreshCloudSyncOnFocus,
} from '../App';

describe('工作台聚焦后的云端同步', () => {
  it('只在首次同步或首次同步失败时遮挡工作台', () => {
    expect(shouldBlockCloudSync('hydrating', false)).toBe(true);
    expect(shouldBlockCloudSync('error', false)).toBe(true);
    expect(shouldBlockCloudSync('ready', false)).toBe(false);

    expect(shouldBlockCloudSync('hydrating', true)).toBe(false);
    expect(shouldBlockCloudSync('error', true)).toBe(false);
  });

  it('窗口聚焦刷新至少间隔 30 秒', () => {
    const initialReadyAt = Date.parse('2026-07-15T16:00:00+08:00');

    expect(shouldRefreshCloudSyncOnFocus('ready', initialReadyAt, initialReadyAt + 10_000)).toBe(false);
    expect(shouldRefreshCloudSyncOnFocus('ready', initialReadyAt, initialReadyAt + 30_000)).toBe(true);
    expect(shouldRefreshCloudSyncOnFocus('hydrating', initialReadyAt, initialReadyAt + 60_000)).toBe(false);
  });
});
