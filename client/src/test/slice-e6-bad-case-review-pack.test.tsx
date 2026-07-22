import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  assign: vi.fn(),
  status: vi.fn(),
  review: vi.fn(),
  analyze: vi.fn(),
  proposal: vi.fn(),
}));

vi.mock('../services/badCaseReviewPackApi', () => {
  return {
    listBadCaseReviewPacks: mocks.list,
    getBadCaseReviewPack: mocks.detail,
    assignBadCaseReviewPack: mocks.assign,
    updateBadCaseReviewPackStatus: mocks.status,
    reviewBadCaseFinding: mocks.review,
    requestBadCaseAnalysis: mocks.analyze,
    requestBadCaseFindingProposal: mocks.proposal,
    userFacingReviewPackError: () => '审阅包加载失败，请重试',
    userFacingMutationError: () => '操作失败，请重试',
  };
});

import BadCaseReviewPackPanel from '../components/admin/BadCaseReviewPackPanel';

const PACK_ID = 'a1b2c3d4-0000-4000-8000-000000000001';
const JOB_ID = '7f177000-0000-4000-8000-000000000001';
const FINDING_ID = 'f1f1f1f1-0000-4000-8000-000000000002';

const listItem = {
  id: PACK_ID,
  generationJobId: JOB_ID,
  status: 'open',
  triggerKind: 'score_below_threshold',
  ownerTeam: 'content_prompt',
  assigneeId: null,
  subjectOwner: { ownerId: 'user-uuid-1', displayName: '测试用户', reviewGroup: 'g1' },
  score: 42,
  severity: 'high',
  analysisStatus: 'pending',
  summary: '港味偏低',
  createdAt: '2026-07-18T03:00:00Z',
  updatedAt: '2026-07-18T03:00:00Z',
  resolvedAt: null,
};

const detail = {
  ...listItem,
  sample: {
    source: '超长样本正文'.repeat(40),
    brandName: '测试品牌',
    productName: '测试产品',
    variants: { ig: '变体文案 A', fb: '变体文案 B' },
    scores: { generated: { total: 42 } },
    errorMessage: null,
    errorCode: null,
  },
  trace: { status: 'unavailable' as const, events: [] as [] },
  criteria: [
    {
      criterionId: 'cantonese_naturalness',
      name: '粤语自然度',
      version: '1',
      result: 'fail' as const,
      actual: 2,
      expected: 4,
    },
    {
      criterionId: 'usage_available',
      name: 'usage 可用性',
      version: '1',
      result: 'not_evaluated' as const,
    },
  ],
  artifacts: { status: 'legacy_unavailable' as const },
  findings: [
    {
      id: FINDING_ID,
      category: 'content_quality',
      severity: 'high',
      confidence: 0.8,
      stage: 'diagnose_generate',
      variantKey: 'ig',
      description: '粤语自然度不足',
      evidenceRefs: [],
      criterionRefs: ['cantonese_naturalness'],
      artifactRefs: [],
      suggestion: { type: 'prompt_tweak', summary: '加强港式口语 few-shot' },
      recommendedOwnerTeam: 'content_prompt' as const,
      disposition: null,
      reviewerComment: null,
      reviewedBy: null,
      reviewedAt: null,
    },
  ],
  auditEvents: [
    {
      id: 'evt-1',
      eventType: 'pack_created',
      actorId: 'system',
      before: null,
      after: { status: 'open' },
      reason: 'low_score',
      requestId: 'req-1',
      createdAt: '2026-07-18T03:00:00Z',
    },
  ],
};

describe('E6 BadCaseReviewPackPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.list.mockResolvedValue({ items: [listItem], total: 1 });
    mocks.detail.mockResolvedValue(detail);
    mocks.assign.mockResolvedValue({ ok: true });
    mocks.status.mockResolvedValue({ ok: true });
    mocks.review.mockResolvedValue({ ok: true });
    mocks.analyze.mockResolvedValue({ ok: true });
    mocks.proposal.mockResolvedValue({ ok: true });
  });

  it('hides the panel for ordinary admins and does not fetch packs', () => {
    const { container } = render(<BadCaseReviewPackPanel role="admin" />);
    expect(container).toBeEmptyDOMElement();
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it('loads list metadata for super_admin without body/email leaks and opens seven sections', async () => {
    render(<BadCaseReviewPackPanel role="super_admin" />);

    expect(await screen.findByTestId('bad-case-review-pack-panel')).toBeInTheDocument();
    expect(await screen.findByText('港味偏低')).toBeInTheDocument();
    expect(screen.getAllByText(/content_prompt/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/@/)).toBeNull();
    expect(screen.queryByText(detail.sample.source)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /打开审阅包/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Bad Case 审阅包' });
    expect(mocks.detail).toHaveBeenCalledWith(PACK_ID);

    for (const label of ['概览', '样本', 'Trace', '验收', '工件', 'Findings', '审计']) {
      expect(within(dialog).getByText(label)).toBeInTheDocument();
    }

    expect(within(dialog).getByText(/运行轨迹暂不可用|轨迹暂不可用/)).toBeInTheDocument();
    expect(within(dialog).getByText(/旧任务|不可追溯|无快照|legacy/i)).toBeInTheDocument();
    expect(within(dialog).getByText('not_evaluated')).toBeInTheDocument();
    expect(within(dialog).getByText(/超长样本正文/)).toBeInTheDocument();

    const sampleBlock = within(dialog).getByTestId('review-pack-sample-body');
    expect(sampleBlock.className).toMatch(/overflow/);
  });

  it('shows friendly empty and error states without raw server errors', async () => {
    mocks.list.mockResolvedValueOnce({ items: [], total: 0 });
    render(<BadCaseReviewPackPanel role="super_admin" />);
    expect(await screen.findByText(/暂无审阅包/)).toBeInTheDocument();

    mocks.list.mockRejectedValueOnce(new Error('ECONNRESET secret-db-host'));
    fireEvent.click(screen.getByRole('button', { name: /刷新审阅包/ }));
    expect(await screen.findByText(/加载失败，请重试/)).toBeInTheDocument();
    expect(screen.queryByText(/secret-db-host/)).toBeNull();
    expect(screen.queryByText(/ECONNRESET/)).toBeNull();
  });

  it('submits assign, status and finding disposition through the dedicated API client', async () => {
    render(<BadCaseReviewPackPanel role="super_admin" />);
    fireEvent.click(await screen.findByRole('button', { name: /打开审阅包/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Bad Case 审阅包' });

    fireEvent.change(within(dialog).getByLabelText('责任团队'), {
      target: { value: 'model_provider' },
    });
    fireEvent.change(within(dialog).getByLabelText('指派原因'), {
      target: { value: '模型超时较多' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存指派' }));
    await waitFor(() => {
      expect(mocks.assign).toHaveBeenCalledWith(PACK_ID, expect.objectContaining({
        ownerTeam: 'model_provider',
        reason: '模型超时较多',
      }));
    });

    fireEvent.change(within(dialog).getByLabelText('审阅状态'), {
      target: { value: 'in_progress' },
    });
    fireEvent.change(within(dialog).getByLabelText('状态原因'), {
      target: { value: '开始处理' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '更新状态' }));
    await waitFor(() => {
      expect(mocks.status).toHaveBeenCalledWith(PACK_ID, expect.objectContaining({
        status: 'in_progress',
        reason: '开始处理',
      }));
    });

    fireEvent.change(within(dialog).getByLabelText('Finding 处置'), {
      target: { value: 'confirmed' },
    });
    fireEvent.change(within(dialog).getByLabelText('处置备注'), {
      target: { value: '确认问题' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '保存处置' }));
    await waitFor(() => {
      expect(mocks.review).toHaveBeenCalledWith(FINDING_ID, expect.objectContaining({
        disposition: 'confirmed',
        reviewerComment: '确认问题',
      }));
    });
  });

  it('shows an explicit idempotent result when a completed DeepSeek analysis is checked', async () => {
    mocks.detail.mockResolvedValueOnce({ ...detail, analysisStatus: 'completed' });
    mocks.analyze.mockResolvedValueOnce({
      id: PACK_ID,
      analysisStatus: 'completed',
      idempotent: true,
      analysisVersion: 'deepseek-1.0.0',
      provider: 'deepseek',
    });
    render(<BadCaseReviewPackPanel role="super_admin" />);
    fireEvent.click(await screen.findByRole('button', { name: /打开审阅包/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Bad Case 审阅包' });

    const analyzeButton = within(dialog).getByRole('button', { name: '检查 DeepSeek 分析' });
    expect(analyzeButton).toBeEnabled();
    expect(within(dialog).getByTestId('review-pack-analysis-help')).toHaveTextContent(
      /DeepSeek|人工审阅|不会直接修改或发布/,
    );
    fireEvent.click(analyzeButton);
    expect(await within(dialog).findByRole('status')).toHaveTextContent(/已经完成|无需重复/);
    expect(mocks.analyze).toHaveBeenCalledWith(PACK_ID);
  });

  it('shows a visible result after requesting a new diagnostic analysis', async () => {
    mocks.detail.mockResolvedValueOnce({ ...detail, analysisStatus: 'not_requested' });
    mocks.detail.mockResolvedValueOnce({ ...detail, analysisStatus: 'completed' });
    mocks.analyze.mockResolvedValueOnce({
      id: PACK_ID,
      analysisStatus: 'completed',
      findingCount: 1,
      criteriaVersion: '2.1',
      analysisVersion: 'deepseek-1.0.0',
      provider: 'deepseek',
      suggestionCount: 1,
    });
    render(<BadCaseReviewPackPanel role="super_admin" />);
    fireEvent.click(await screen.findByRole('button', { name: /打开审阅包/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Bad Case 审阅包' });

    fireEvent.click(within(dialog).getByRole('button', { name: '运行 DeepSeek 分析' }));

    expect(await within(dialog).findByRole('status')).toHaveTextContent(/DeepSeek 分析完成|1 条可审阅建议/);
    expect(mocks.analyze).toHaveBeenCalledWith(PACK_ID);
    expect(within(dialog).getByRole('button', { name: '检查 DeepSeek 分析' })).toBeEnabled();
  });

  it('renders DeepSeek diagnosis as review-only guidance on its finding', async () => {
    mocks.detail.mockResolvedValueOnce({
      ...detail,
      analysisStatus: 'completed',
      findings: [{
        ...detail.findings[0],
        suggestion: {
          provider: 'deepseek',
          model: 'deepseek-v4-flash',
          analysisVersion: 'deepseek-1.0.0',
          diagnosis: '输出较书面，港式口语特征不足。',
          remediation: '审阅港式口语 few-shot，并用相邻样本回归。',
          confidence: 0.86,
          ownerTeam: 'content_prompt',
          reviewRequired: true,
        },
      }],
    });
    render(<BadCaseReviewPackPanel role="super_admin" />);
    fireEvent.click(await screen.findByRole('button', { name: /打开审阅包/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Bad Case 审阅包' });

    expect(within(dialog).getByText(/输出较书面，港式口语特征不足/)).toBeInTheDocument();
    expect(within(dialog).getByText(/审阅港式口语 few-shot/)).toBeInTheDocument();
    expect(within(dialog).getByText(/置信度 86%/)).toBeInTheDocument();
    expect(within(dialog).getByText(/仅供审阅/)).toBeInTheDocument();
  });

  it('creates a review-only proposal with a captured artifact snapshot and JSON patch', async () => {
    const capturedRules = {
      availability: 'captured',
      rulesetId: 'default',
      version: '1',
      ruleIds: ['rule_1'],
      w1ConstraintsVersion: '1',
      userRedLinesPresent: false,
    };
    mocks.detail.mockResolvedValueOnce({
      ...detail,
      artifacts: {
        status: 'available' as const,
        contentHashes: { rules: 'a'.repeat(64) },
        rules: capturedRules,
      },
    });

    render(<BadCaseReviewPackPanel role="super_admin" />);
    fireEvent.click(await screen.findByRole('button', { name: /打开审阅包/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Bad Case 审阅包' });
    fireEvent.change(within(dialog).getByLabelText('提案理由'), {
      target: { value: '规则版本需要修订' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: '创建待审提案' }));

    await waitFor(() => {
      expect(mocks.proposal).toHaveBeenCalledWith(FINDING_ID, expect.objectContaining({
        artifactType: 'rules',
        rationale: '规则版本需要修订',
        before: expect.objectContaining({
          contentHash: 'a'.repeat(64),
          snapshot: { artifactType: 'rules', manifest: capturedRules },
        }),
        afterPatch: {
          ops: [{ op: 'replace', path: '/version', value: '2.1' }],
        },
      }));
    });
  });

  it('does not claim authorization in visible copy', async () => {
    render(<BadCaseReviewPackPanel role="super_admin" />);
    await screen.findByTestId('bad-case-review-pack-panel');
    expect(screen.queryByText(/已授权/)).toBeNull();
    expect(screen.queryByText(/已批准上线/)).toBeNull();
  });
});
