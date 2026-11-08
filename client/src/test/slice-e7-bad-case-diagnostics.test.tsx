import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({
  getDiagnostics: vi.fn(),
}));

vi.mock('../services/badCaseDiagnosticsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/badCaseDiagnosticsApi')>();
  return {
    ...actual,
    getBadCaseDiagnostics: mocks.getDiagnostics,
  };
});

import BadCaseDiagnosticsPanel from '../components/admin/BadCaseDiagnosticsPanel';

const fullFixture = {
  from: '2026-06-22',
  to: '2026-07-22',
  summary: {
    categoryDistribution: {
      total: 3,
      byCategory: {
        input_contract: { count: 0, share: 0 },
        context_resolution: { count: 0, share: 0 },
        prompt_instruction: { count: 0, share: 0 },
        knowledge_retrieval: { count: 0, share: 0 },
        model_transport: { count: 0, share: 0 },
        model_output_schema: { count: 0, share: 0 },
        content_quality: { count: 2, share: 0.6667 },
        compliance: { count: 1, share: 0.3333 },
        persistence: { count: 0, share: 0 },
        ui_presentation: { count: 0, share: 0 },
        evaluation_gap: { count: 0, share: 0 },
      },
    },
    recurrence: {
      totalFindings: 3,
      sampleRecurrenceRate: 0.6667,
      categoryRecurrenceRate: 0.5,
      duplicateSampleCount: 1,
    },
    dispositionRates: {
      total: 3,
      reviewed: 2,
      reviewCoverage: 0.6667,
      confirmationRate: 0.5,
      falsePositiveRate: 0.5,
    },
    criterionCoverage: {
      total: 4,
      evaluated: 3,
      notEvaluated: 1,
      evaluatedRate: 0.75,
      notEvaluatedRate: 0.25,
      failRateAmongEvaluated: 0.3333,
    },
    resolutionLatency: {
      sampleSize: 2,
      p50Ms: 3_600_000,
      p95Ms: 86_400_000,
      invalidCount: 1,
    },
    tokenCost: {
      costStatus: 'partial' as const,
      sumCny: 0.12,
      okCount: 1,
      unavailableCount: 1,
      sampleSize: 2,
    },
  },
};

const emptyRatesFixture = {
  from: '2026-06-22',
  to: '2026-07-22',
  summary: {
    categoryDistribution: {
      total: 0,
      byCategory: {
        content_quality: { count: 0, share: null },
        compliance: { count: 0, share: null },
      },
    },
    recurrence: {
      totalFindings: 0,
      sampleRecurrenceRate: null,
      categoryRecurrenceRate: null,
      duplicateSampleCount: 0,
    },
    dispositionRates: {
      total: 3,
      reviewed: 0,
      reviewCoverage: 0,
      confirmationRate: null,
      falsePositiveRate: null,
    },
    criterionCoverage: {
      total: 0,
      evaluated: 0,
      notEvaluated: 0,
      evaluatedRate: null,
      notEvaluatedRate: null,
      failRateAmongEvaluated: null,
    },
    resolutionLatency: {
      sampleSize: 0,
      p50Ms: null,
      p95Ms: null,
      invalidCount: 0,
    },
    tokenCost: {
      costStatus: 'unavailable' as const,
      sumCny: null,
      okCount: 0,
      unavailableCount: 2,
      sampleSize: 2,
    },
  },
};

describe('E7 BadCaseDiagnosticsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mocks.getDiagnostics.mockResolvedValue(fullFixture);
  });

  it('hides the panel for ordinary admins and does not fetch diagnostics', () => {
    const { container } = render(<BadCaseDiagnosticsPanel role="admin" />);
    expect(container).toBeEmptyDOMElement();
    expect(mocks.getDiagnostics).not.toHaveBeenCalled();
  });

  it('loads diagnostics collapsed, surfaces an attention badge and expands on demand', async () => {
    render(<BadCaseDiagnosticsPanel role="super_admin" />);

    expect(await screen.findByTestId('bad-case-diagnostics-panel')).toBeInTheDocument();
    expect(await screen.findByTestId('bad-case-diagnostics-alert')).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('bad-case-diagnostics-attention').textContent).toMatch(/5 类指标需关注/);
    const toggle = screen.getByRole('button', { name: /展开 Bad Case 诊断指标/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('bad-case-diagnostics-category')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('bad-case-diagnostics-help').textContent).toMatch(
      /综合成功|错误率|定位/,
    );
    expect(screen.getByText(/2026-06-22/)).toBeInTheDocument();
    expect(screen.getByTestId('bad-case-diagnostics-category')).toBeInTheDocument();
    expect(screen.getByTestId('bad-case-diagnostics-recurrence')).toBeInTheDocument();
    expect(screen.getByTestId('bad-case-diagnostics-disposition')).toBeInTheDocument();
    expect(screen.getByTestId('bad-case-diagnostics-criteria')).toBeInTheDocument();
    expect(screen.getByTestId('bad-case-diagnostics-latency')).toBeInTheDocument();
    expect(screen.getByTestId('bad-case-diagnostics-token-cost')).toBeInTheDocument();

    expect(screen.getByTestId('bad-case-diagnostics-metric-sample-recurrence').textContent).toMatch(
      /66\.7%/,
    );
    expect(screen.getByTestId('bad-case-diagnostics-metric-duplicate-count').textContent).toMatch(
      /1/,
    );
    expect(screen.getByTestId('bad-case-diagnostics-metric-sum-cny').textContent).toMatch(/0\.12/);
    expect(screen.getByText(/部分可估算|partial/i)).toBeInTheDocument();
    expect(screen.queryByText(/@/)).toBeNull();
    expect(mocks.getDiagnostics).toHaveBeenCalled();
  });

  it('does not repeat the same alert after refresh in one browser session', async () => {
    render(<BadCaseDiagnosticsPanel role="super_admin" />);

    await screen.findByTestId('bad-case-diagnostics-alert');
    fireEvent.click(screen.getByRole('button', { name: '关闭诊断提醒' }));
    expect(screen.queryByTestId('bad-case-diagnostics-alert')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '刷新诊断指标' }));
    await waitFor(() => expect(mocks.getDiagnostics).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('bad-case-diagnostics-alert')).not.toBeInTheDocument();
  });

  it('alerts again when the actionable diagnostics summary changes', async () => {
    mocks.getDiagnostics
      .mockResolvedValueOnce(fullFixture)
      .mockResolvedValueOnce({
        ...fullFixture,
        summary: {
          ...fullFixture.summary,
          recurrence: {
            ...fullFixture.summary.recurrence,
            duplicateSampleCount: 2,
          },
        },
      });
    render(<BadCaseDiagnosticsPanel role="super_admin" />);

    await screen.findByTestId('bad-case-diagnostics-alert');
    fireEvent.click(screen.getByRole('button', { name: '关闭诊断提醒' }));
    fireEvent.click(screen.getByRole('button', { name: '刷新诊断指标' }));

    expect(await screen.findByTestId('bad-case-diagnostics-alert')).toHaveTextContent('2 个重复样本');
  });

  it('opens the collapsed diagnostics from the alert action', async () => {
    render(<BadCaseDiagnosticsPanel role="super_admin" />);

    const alert = await screen.findByTestId('bad-case-diagnostics-alert');
    fireEvent.click(within(alert).getByRole('button', { name: '展开查看' }));

    expect(screen.getByRole('button', { name: /收起 Bad Case 诊断指标/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByTestId('bad-case-diagnostics-category')).toBeInTheDocument();
  });

  it('shows 暂无样本 for null rates and 0% for legal zero coverage', async () => {
    mocks.getDiagnostics.mockResolvedValue(emptyRatesFixture);
    render(<BadCaseDiagnosticsPanel role="super_admin" />);

    await screen.findByTestId('bad-case-diagnostics-alert');
    fireEvent.click(screen.getByRole('button', { name: /展开 Bad Case 诊断指标/ }));

    expect(screen.getByTestId('bad-case-diagnostics-metric-sample-recurrence').textContent).toBe(
      '暂无样本',
    );
    expect(screen.getByTestId('bad-case-diagnostics-metric-confirmation-rate').textContent).toBe(
      '暂无样本',
    );
    expect(screen.getByTestId('bad-case-diagnostics-metric-review-coverage').textContent).toBe(
      '0%',
    );
    expect(screen.getByTestId('bad-case-diagnostics-metric-p50').textContent).toBe('暂无样本');
    expect(screen.getByTestId('bad-case-diagnostics-metric-sum-cny').textContent).toBe(
      '暂不可估算',
    );
    expect(screen.getByTestId('bad-case-diagnostics-metric-sum-cny').textContent).not.toMatch(
      /¥|￥\s*0|￥0/,
    );
    expect(screen.getByTestId('bad-case-diagnostics-metric-duplicate-count').textContent).toMatch(
      /0/,
    );
  });

  it('shows loading then error without leaking raw failure body', async () => {
    let resolveFn: ((value: unknown) => void) | undefined;
    mocks.getDiagnostics.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
    );

    const { rerender } = render(<BadCaseDiagnosticsPanel role="super_admin" />);
    expect(await screen.findByTestId('bad-case-diagnostics-loading')).toBeInTheDocument();

    resolveFn?.(fullFixture);
    await waitFor(() => {
      expect(screen.queryByTestId('bad-case-diagnostics-loading')).not.toBeInTheDocument();
    });

    mocks.getDiagnostics.mockRejectedValue(new Error('ECONNRESET secret stack at line 99'));
    rerender(<BadCaseDiagnosticsPanel role="super_admin" />);
    // force refresh path
    fireEvent.click(screen.getByRole('button', { name: '刷新诊断指标' }));

    await waitFor(() => {
      expect(screen.getByTestId('bad-case-diagnostics-error')).toBeInTheDocument();
    });
    const errorText = screen.getByTestId('bad-case-diagnostics-error').textContent ?? '';
    expect(errorText).toMatch(/加载失败|请重试/);
    expect(errorText).not.toMatch(/ECONNRESET|secret stack/);
  });

  it('keeps category list scrollable inside the component', async () => {
    render(<BadCaseDiagnosticsPanel role="super_admin" />);
    await screen.findByTestId('bad-case-diagnostics-alert');
    fireEvent.click(screen.getByRole('button', { name: /展开 Bad Case 诊断指标/ }));
    await screen.findByTestId('bad-case-diagnostics-category-list');
    const list = screen.getByTestId('bad-case-diagnostics-category-list');
    expect(list.className).toMatch(/overflow-y-auto|overflow-auto/);
  });

  it('shows 暂不可估算 when tokenCost is null and never paints fake ￥0', async () => {
    mocks.getDiagnostics.mockResolvedValue({
      ...fullFixture,
      summary: { ...fullFixture.summary, tokenCost: null },
    });
    render(<BadCaseDiagnosticsPanel role="super_admin" />);
    await screen.findByTestId('bad-case-diagnostics-alert');
    fireEvent.click(screen.getByRole('button', { name: /展开 Bad Case 诊断指标/ }));
    await screen.findByTestId('bad-case-diagnostics-token-cost');
    const costNode = screen.getByTestId('bad-case-diagnostics-metric-sum-cny');
    expect(costNode.textContent).toBe('暂不可估算');
    expect(costNode.textContent).not.toMatch(/¥|￥/);
  });
});
