/**
 * W4 — Admin favorite review summary + super_admin case library review UI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const mockApi = vi.hoisted(() => ({
  checkAdminAccess: vi.fn().mockResolvedValue(true),
  getAdminStats: vi.fn().mockResolvedValue({
    totalUsers: 1,
    activeSubscriptions: 0,
    totalGenerations: 0,
    totalFeedback: 0,
    adminUsers: 1,
    role: 'admin' as 'admin' | 'super_admin',
  }),
  getAdminUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }),
  getAdminGenerations: vi.fn().mockResolvedValue({ jobs: [], total: 0 }),
  getAdminFeedback: vi.fn().mockResolvedValue({ feedback: [], total: 0 }),
  getAdminSubscriptions: vi.fn().mockResolvedValue({ subscriptions: [], total: 0 }),
  getAdminAuditLog: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
  getAdminFavorites: vi.fn().mockResolvedValue({
    favorites: [{
      id: 'favorite-1',
      ownerDisplayName: '用户 abc',
      userEmail: 'user@example.com',
      variantKey: 'ig',
      rating: 4,
      notes: '语气好',
      favoriteReason: '钩子强',
      reasonTags: ['hook'],
      savedAt: '2026-07-14T10:00:00Z',
      brandName: '港饮',
      productName: null as string | null,
      copyType: 'social',
      platform: 'ig',
    }],
    total: 1,
  }),
  getAdminFavoriteDetail: vi.fn().mockResolvedValue({
    id: 'favorite-1',
    ownerDisplayName: '用户 abc',
    userEmail: 'user@example.com',
    variantKey: 'ig',
    content: '只应复制这段正文',
    rating: 4,
    notes: '语气好',
    favoriteReason: '钩子强',
    reasonTags: ['hook'],
    savedAt: '2026-07-14T10:00:00Z',
    brandName: '港饮',
    productName: null as string | null,
    copyType: 'social',
    platform: 'ig',
  }),
  getAdminCaseLibraryDetail: vi.fn().mockResolvedValue({
    id: '11111111-1111-4111-8111-111111111111',
    ownerDisplayName: '用户 xyz',
    caseType: 'good',
    title: null as string | null,
    body: '案例库正文内容',
    reason: '自然口语',
    tags: ['粤语'],
    createdAt: '2026-07-14T00:00:00Z',
    updatedAt: '2026-07-14T01:00:00Z',
  }),
}));

vi.mock('../services/api', () => mockApi);

describe('W4 — favorite review summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.checkAdminAccess.mockResolvedValue(true);
    mockApi.getAdminStats.mockResolvedValue({
      totalUsers: 1, activeSubscriptions: 0, totalGenerations: 0,
      totalFeedback: 0, adminUsers: 1, role: 'admin',
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('shows review summary above body with required fields; missing → 未填写', async () => {
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('用户收藏')).toBeInTheDocument());
    fireEvent.click(screen.getByText('用户收藏'));
    await waitFor(() => expect(screen.getByRole('button', { name: '查看收藏详情' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '查看收藏详情' }));

    await waitFor(() => expect(screen.getByTestId('favorite-review-summary')).toBeInTheDocument());
    const summary = screen.getByTestId('favorite-review-summary');
    const body = screen.getByTestId('favorite-review-body');
    expect(summary.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(summary).toHaveTextContent('品牌');
    expect(summary).toHaveTextContent('港饮');
    expect(summary).toHaveTextContent('产品');
    expect(summary).toHaveTextContent('未填写');
    expect(summary).toHaveTextContent('文案类型');
    expect(summary).toHaveTextContent('社媒文案');
    expect(summary).toHaveTextContent('平台');
    expect(summary).toHaveTextContent('IG');
    expect(summary).toHaveTextContent('评分');
    expect(summary).toHaveTextContent('用户备注');
    expect(summary).toHaveTextContent('收藏原因');
    expect(summary).toHaveTextContent('标签');
    expect(summary).toHaveTextContent('收藏时间');

    fireEvent.click(screen.getByRole('button', { name: '复制文案' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('只应复制这段正文');
    expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(expect.stringContaining('user@example.com'));
    expect(screen.queryByText('编辑')).not.toBeInTheDocument();
    expect(screen.queryByText('删除')).not.toBeInTheDocument();
    expect(screen.queryByText('导出')).not.toBeInTheDocument();
  });
});

describe('W4 — super_admin case review entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.checkAdminAccess.mockResolvedValue(true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('hides case review tab for ordinary admin', async () => {
    mockApi.getAdminStats.mockResolvedValue({
      totalUsers: 1, activeSubscriptions: 0, totalGenerations: 0,
      totalFeedback: 0, adminUsers: 1, role: 'admin',
    });
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByText('用户收藏')).toBeInTheDocument());
    expect(screen.queryByText('案例审阅')).not.toBeInTheDocument();
  });

  it('shows case review only for super_admin; lookup by id; copy body only', async () => {
    mockApi.getAdminStats.mockResolvedValue({
      totalUsers: 1, activeSubscriptions: 0, totalGenerations: 0,
      totalFeedback: 0, adminUsers: 1, role: 'super_admin',
    });
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('案例审阅')).toBeInTheDocument());
    fireEvent.click(screen.getByText('案例审阅'));

    const input = await screen.findByTestId('case-review-id-input');
    fireEvent.change(input, {
      target: { value: '11111111-1111-4111-8111-111111111111' },
    });
    fireEvent.click(screen.getByRole('button', { name: '查询案例' }));

    await waitFor(() => expect(mockApi.getAdminCaseLibraryDetail).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    ));
    await waitFor(() => expect(screen.getByTestId('case-review-summary')).toBeInTheDocument());
    expect(screen.getByTestId('case-review-summary')).toHaveTextContent('未命名案例');
    expect(screen.getByTestId('case-review-body')).toHaveTextContent('案例库正文内容');

    const summary = screen.getByTestId('case-review-summary');
    const body = screen.getByTestId('case-review-body');
    expect(summary.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '复制案例正文' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('案例库正文内容');
    expect(screen.queryByText('编辑')).not.toBeInTheDocument();
    expect(screen.queryByText('删除')).not.toBeInTheDocument();
    expect(screen.queryByText('导出')).not.toBeInTheDocument();
  });
});
