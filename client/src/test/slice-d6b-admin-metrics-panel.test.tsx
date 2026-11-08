import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({
  overview: vi.fn(), models: vi.fn(), badCases: vi.fn(), balance: vi.fn(),
}));

vi.mock('../services/adminMetricsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/adminMetricsApi')>()),
  getAdminMetricsOverview: mocks.overview,
  getAdminModelMetrics: mocks.models,
  getAdminBadCases: mocks.badCases,
  getAdminProviderBalance: mocks.balance,
}));

import AdminMetricsPanel from '../components/admin/AdminMetricsPanel';

const overview = {
  scope: 'group' as const, reviewGroup: 'group-a', from: '2026-06-20', to: '2026-07-19',
  activity: { dau: 3, wau: 8, mau: 12 },
  membershipGrants: { total: 2, pending: 1, applied: 1 },
  quota: { consumed: 9, remaining: 91 },
};

describe('D6b AdminMetricsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.overview.mockResolvedValue(overview);
    mocks.models.mockResolvedValue({
      from: overview.from, to: overview.to,
      rows: [{ provider: 'deepseek', model: 'v4', total: 10, success: 9, error: 1, errorRate: 0.1, avgLatencyMs: 900, p95LatencyMs: 1400, promptTokens: 100, completionTokens: 40, totalTokens: 140, cacheHitTokens: 10, cacheMissTokens: 90, unavailableUsageCount: 2 }],
    });
    mocks.badCases.mockResolvedValue({ from: overview.from, to: overview.to, threshold: 50, items: [{ id: 'job-1', score: 42, platform: 'ig', tone: '生鬼', generationEngine: 'deepseek', createdAt: '2026-07-18T00:00:00Z', completedAt: null }] });
    mocks.balance.mockResolvedValue({ provider: 'deepseek', status: 'unavailable' });
  });

  it('shows group overview to ordinary admins without requesting super-admin data', async () => {
    render(<AdminMetricsPanel role="admin" />);
    expect(await screen.findByText('运营概览')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/group-a/)).toBeInTheDocument();
    expect(screen.queryByText('模型健康')).not.toBeInTheDocument();
    expect(mocks.models).not.toHaveBeenCalled();
    expect(mocks.badCases).not.toHaveBeenCalled();
    expect(mocks.balance).not.toHaveBeenCalled();
  });

  it('shows model health, bad-case metadata and unavailable balance only to super admins', async () => {
    render(<AdminMetricsPanel role="super_admin" />);
    expect(await screen.findByText('模型健康')).toBeInTheDocument();
    expect(screen.getByText('deepseek / v4')).toBeInTheDocument();
    expect(screen.getByText('42 分')).toBeInTheDocument();
    expect(screen.getByText('暂不可用')).toBeInTheDocument();
    expect(screen.queryByText(/正文|source|prompt/i)).not.toBeInTheDocument();
  });

  it('keeps overview visible when only super-admin metrics fail', async () => {
    mocks.models.mockRejectedValue(new Error('failed'));
    mocks.badCases.mockRejectedValue(new Error('failed'));
    mocks.balance.mockRejectedValue(new Error('failed'));
    render(<AdminMetricsPanel role="super_admin" />);

    expect(await screen.findByText('运营概览')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('模型指标加载失败，请重试')).toBeInTheDocument());
    expect(screen.getByText('12')).toBeInTheDocument();
  });
});
