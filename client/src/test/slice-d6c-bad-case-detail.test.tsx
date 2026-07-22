import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({
  overview: vi.fn(), models: vi.fn(), badCases: vi.fn(), balance: vi.fn(), detail: vi.fn(),
}));

vi.mock('../services/adminMetricsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/adminMetricsApi')>()),
  getAdminMetricsOverview: mocks.overview,
  getAdminModelMetrics: mocks.models,
  getAdminBadCases: mocks.badCases,
  getAdminProviderBalance: mocks.balance,
  getAdminBadCaseDetail: mocks.detail,
}));

import AdminMetricsPanel from '../components/admin/AdminMetricsPanel';

const JOB_ID = '7f177000-0000-4000-8000-000000000001';

describe('D6c low-score task detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.overview.mockResolvedValue({
      scope: 'global', reviewGroup: null, from: '2026-06-20', to: '2026-07-19',
      activity: { dau: 1, wau: 2, mau: 3 }, membershipGrants: { total: 0, pending: 0, applied: 0 }, quota: { consumed: 1, remaining: 9 },
    });
    mocks.models.mockResolvedValue({ from: '2026-06-20', to: '2026-07-19', rows: [] });
    mocks.badCases.mockResolvedValue({
      from: '2026-06-20', to: '2026-07-19', threshold: 50,
      items: [{ id: JOB_ID, score: 42, platform: 'ig', tone: '生鬼', generationEngine: 'deepseek', createdAt: '2026-07-18T03:00:00Z', completedAt: null }],
    });
    mocks.balance.mockResolvedValue({ provider: 'deepseek', status: 'unavailable' });
    mocks.detail.mockResolvedValue({
      job: {
        id: JOB_ID, status: 'completed', source: '测试原始任务内容', platform: 'ig', tone: '生鬼',
        generation_engine: 'deepseek', variants: { ig: '低分文案内容' },
        scores: { generated: { total: 42, naturalness: 35 } }, created_at: '2026-07-18T03:00:00Z', completed_at: null,
      },
      modelAttempts: { status: 'unavailable', items: [] },
    });
  });

  it('opens the audited detail with full UUID and keeps task content visible when logs are unavailable', async () => {
    render(<AdminMetricsPanel role="super_admin" />);
    const card = await screen.findByRole('button', { name: /查看低分任务 7f177000/ });
    fireEvent.click(card);

    expect(await screen.findByRole('dialog', { name: '低分任务详情' })).toBeInTheDocument();
    expect(screen.getByText(JOB_ID)).toBeInTheDocument();
    expect(screen.getByText('测试原始任务内容')).toBeInTheDocument();
    expect(screen.getByText('低分文案内容')).toBeInTheDocument();
    expect(screen.getByText(/模型调用日志暂不可用/)).toBeInTheDocument();
    expect(mocks.detail).toHaveBeenCalledWith(JOB_ID);
  });
});
