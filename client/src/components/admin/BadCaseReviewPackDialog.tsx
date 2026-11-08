import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import {
  assignBadCaseReviewPack,
  getBadCaseReviewPack,
  requestBadCaseAnalysis,
  requestBadCaseFindingProposal,
  reviewBadCaseFinding,
  updateBadCaseReviewPackStatus,
  userFacingMutationError,
  userFacingReviewPackError,
  type BadCaseAnalysisResponse,
  type BadCaseFinding,
  type BadCaseReviewPackDetail,
  type FindingDisposition,
  type FindingProposalBody,
  type OwnerTeam,
  type ProposalArtifactType,
  type ReviewPackStatus,
} from '../../services/badCaseReviewPackApi';

const OWNER_TEAMS: OwnerTeam[] = [
  'content_prompt',
  'knowledge_rules',
  'model_provider',
  'backend_platform',
  'frontend_experience',
  'unassigned',
];

const STATUS_OPTIONS = ['open', 'triaging', 'in_progress', 'resolved', 'wont_fix', 'duplicate'] as const;

const DISPOSITIONS = [
  'confirmed',
  'false_positive',
  'accepted_risk',
  'needs_data',
  'resolved',
] as const;

const DEFAULT_PROPOSAL_PATCH: Record<ProposalArtifactType, string> = {
  prompt: '{"ops":[{"op":"replace","path":"/templates/0/version","value":"2.1"}]}',
  rules: '{"ops":[{"op":"replace","path":"/version","value":"2.1"}]}',
  knowledge: '{"ops":[{"op":"replace","path":"/calendar/datasetVersion","value":"2.1"}]}',
  model_policy: '{"ops":[{"op":"replace","path":"/policyVersion","value":"2.1"}]}',
};

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <details className="rounded-lg border border-gray-700/50 p-3 light:border-gray-200">
      <summary className="cursor-pointer text-xs font-semibold">{title}</summary>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-gray-400 light:text-gray-600">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function readAiSuggestion(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.diagnosis !== 'string' || typeof row.remediation !== 'string') return null;
  return {
    provider: typeof row.provider === 'string' ? row.provider : 'AI',
    model: typeof row.model === 'string' ? row.model : '',
    diagnosis: row.diagnosis,
    remediation: row.remediation,
    confidence: typeof row.confidence === 'number' ? row.confidence : null,
    ownerTeam: typeof row.ownerTeam === 'string' ? row.ownerTeam : 'unassigned',
  };
}

function Section({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="rounded-lg border border-gray-700/50 light:border-gray-200"
    >
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold">{title}</summary>
      <div className="space-y-3 border-t border-gray-800 px-3 py-3 light:border-gray-200">
        {children}
      </div>
    </details>
  );
}

export default function BadCaseReviewPackDialog({
  packId,
  onClose,
}: {
  packId: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [detail, setDetail] = useState<BadCaseReviewPackDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [ownerTeam, setOwnerTeam] = useState<string>('unassigned');
  const [assigneeId, setAssigneeId] = useState('');
  const [assignReason, setAssignReason] = useState('');
  const [statusValue, setStatusValue] = useState<ReviewPackStatus>('open');
  const [statusReason, setStatusReason] = useState('');
  const [activeFindingId, setActiveFindingId] = useState<string>('');
  const [disposition, setDisposition] = useState<FindingDisposition>('confirmed');
  const [dispositionNote, setDispositionNote] = useState('');
  const [proposalArtifactType, setProposalArtifactType] = useState<ProposalArtifactType>('rules');
  const [proposalPatchText, setProposalPatchText] = useState(DEFAULT_PROPOSAL_PATCH.rules);
  const [proposalRationale, setProposalRationale] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getBadCaseReviewPack(packId);
      setDetail(next);
      setOwnerTeam(next.ownerTeam || 'unassigned');
      setAssigneeId(next.assigneeId ?? '');
      setStatusValue(next.status || 'open');
      setActiveFindingId(next.findings[0]?.id ?? '');
    } catch (err) {
      setDetail(null);
      setError(userFacingReviewPackError(err));
    } finally {
      setLoading(false);
    }
  }, [packId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [busy, onClose]);

  async function runAction(
    action: () => Promise<unknown>,
    successMessage?: string | ((result: unknown) => string | null),
  ) {
    setBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await action();
      await load();
      const message = typeof successMessage === 'function'
        ? successMessage(result)
        : successMessage;
      if (message) setActionNotice(message);
    } catch (err) {
      setActionError(userFacingMutationError(err));
    } finally {
      setBusy(false);
    }
  }

  function analysisMessage(result: unknown): string {
    const response = result as BadCaseAnalysisResponse;
    if (response.analysisStatus === 'analysis_unavailable') {
      return `DeepSeek 分析暂不可用（${response.failureClass ?? 'unknown'}），规则 Findings 已保留，可稍后重试。`;
    }
    if (response.analysisStatus === 'pending') {
      return '分析请求已在处理中，请稍后刷新。';
    }
    if (response.idempotent) {
      return '当前 DeepSeek 分析版本已经完成，无需重复运行。';
    }
    return `DeepSeek 分析完成：已生成 ${response.suggestionCount ?? 0} 条可审阅建议，共 ${response.findingCount ?? 0} 条 Findings。`;
  }

  async function createProposal(findingId: string) {
    if (!detail || detail.artifacts.status !== 'available') {
      setActionError('当前任务没有可追溯工件，无法创建提案');
      return;
    }
    const manifestByType: Record<ProposalArtifactType, unknown> = {
      prompt: detail.artifacts.prompt,
      rules: detail.artifacts.rules,
      knowledge: detail.artifacts.knowledge,
      model_policy: detail.artifacts.modelPolicy,
    };
    const contentHash = detail.artifacts.contentHashes?.[proposalArtifactType];
    const manifest = manifestByType[proposalArtifactType];
    if (!contentHash || manifest == null) {
      setActionError('所选工件快照不完整，请刷新后重试');
      return;
    }
    let afterPatch: FindingProposalBody['afterPatch'];
    try {
      const parsed = JSON.parse(proposalPatchText) as FindingProposalBody['afterPatch'];
      if (!parsed || !Array.isArray(parsed.ops) || parsed.ops.length === 0) throw new Error('empty');
      afterPatch = parsed;
    } catch {
      setActionError('JSON Patch 格式无效，必须包含非空 ops 数组');
      return;
    }
    await runAction(() => requestBadCaseFindingProposal(findingId, {
      artifactType: proposalArtifactType,
      before: {
        contentHash,
        generationJobId: detail.generationJobId,
        snapshot: { artifactType: proposalArtifactType, manifest },
      },
      afterPatch,
      rationale: proposalRationale || dispositionNote || null,
    }));
  }

  const finding: BadCaseFinding | undefined = detail?.findings.find((f) => f.id === activeFindingId)
    ?? detail?.findings[0];
  const suggestion = finding ? readAiSuggestion(finding.suggestion) : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-3"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Bad Case 审阅包"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-950 text-gray-100 shadow-2xl light:border-gray-200 light:bg-white light:text-gray-900"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-800 px-4 py-3 light:border-gray-200">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Bad Case 审阅包</h2>
            <p className="mt-1 break-all font-mono text-[10px] text-gray-500">{packId}</p>
            <p className="mt-1 text-[10px] text-gray-600">
              详情访问由服务端审计；前端隐藏入口不是权限边界
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-200 disabled:opacity-50 light:hover:bg-gray-100"
            aria-label="关闭审阅包"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> 加载审阅包…
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-3 text-xs text-red-400">
              <AlertTriangle className="h-4 w-4" /> {error}
            </div>
          )}

          {detail && !loading && (
            <div className="space-y-3">
              {actionError && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
                  <AlertTriangle className="h-4 w-4" /> {actionError}
                </div>
              )}
              {actionNotice && (
                <div role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 light:text-emerald-700">
                  {actionNotice}
                </div>
              )}

              <Section id="overview" title="概览" defaultOpen>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-gray-800 px-2 py-1 light:bg-gray-100">{detail.status}</span>
                  <span className="rounded bg-gray-800 px-2 py-1 light:bg-gray-100">{detail.triggerKind}</span>
                  {detail.score != null && (
                    <span className="rounded bg-red-500/10 px-2 py-1 text-red-400">{detail.score} 分</span>
                  )}
                  {detail.severity && (
                    <span className="rounded bg-amber-500/10 px-2 py-1 text-amber-400">{detail.severity}</span>
                  )}
                  <span className="text-gray-500">分析：{detail.analysisStatus}</span>
                </div>
                {detail.summary && <p className="text-sm text-gray-300 light:text-gray-700">{detail.summary}</p>}
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-md bg-gray-900/50 p-2 light:bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">数据 Owner</p>
                    <p className="mt-1 break-all font-mono text-[11px]">{detail.subjectOwner.ownerId}</p>
                    <p className="mt-1">{detail.subjectOwner.displayName ?? '未命名'} · {detail.subjectOwner.reviewGroup ?? '未分组'}</p>
                  </div>
                  <div className="rounded-md bg-gray-900/50 p-2 light:bg-gray-50">
                    <p className="text-[10px] uppercase tracking-wide text-gray-500">Case Owner</p>
                    <p className="mt-1">{detail.ownerTeam}</p>
                    <p className="mt-1 break-all font-mono text-[11px]">{detail.assigneeId ?? '未指派人员'}</p>
                  </div>
                </div>

                <div className="grid gap-3 border-t border-gray-800 pt-3 light:border-gray-200 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-[11px] text-gray-500" htmlFor="pack-owner-team">责任团队</label>
                    <select
                      id="pack-owner-team"
                      aria-label="责任团队"
                      value={ownerTeam}
                      onChange={(e) => setOwnerTeam(e.target.value)}
                      className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs light:border-gray-300 light:bg-white"
                    >
                      {OWNER_TEAMS.map((team) => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                    <label className="block text-[11px] text-gray-500" htmlFor="pack-assignee">人员 ID（可选）</label>
                    <input
                      id="pack-assignee"
                      aria-label="人员 ID"
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs light:border-gray-300 light:bg-white"
                    />
                    <label className="block text-[11px] text-gray-500" htmlFor="pack-assign-reason">指派原因</label>
                    <input
                      id="pack-assign-reason"
                      aria-label="指派原因"
                      value={assignReason}
                      onChange={(e) => setAssignReason(e.target.value)}
                      className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs light:border-gray-300 light:bg-white"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(() => assignBadCaseReviewPack(packId, {
                        ownerTeam,
                        assigneeId: assigneeId.trim() || null,
                        reason: assignReason,
                      }))}
                      className="min-h-9 rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 disabled:opacity-50 light:bg-orange-100 light:text-orange-700"
                    >
                      保存指派
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] text-gray-500" htmlFor="pack-status">审阅状态</label>
                    <select
                      id="pack-status"
                      aria-label="审阅状态"
                      value={statusValue}
                      onChange={(e) => setStatusValue(e.target.value as ReviewPackStatus)}
                      className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs light:border-gray-300 light:bg-white"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <label className="block text-[11px] text-gray-500" htmlFor="pack-status-reason">状态原因</label>
                    <input
                      id="pack-status-reason"
                      aria-label="状态原因"
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs light:border-gray-300 light:bg-white"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runAction(() => updateBadCaseReviewPackStatus(packId, {
                        status: statusValue,
                        reason: statusReason,
                      }))}
                      className="min-h-9 rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 disabled:opacity-50 light:bg-orange-100 light:text-orange-700"
                    >
                      更新状态
                    </button>
                    <button
                      type="button"
                      disabled={busy || detail.analysisStatus === 'pending'}
                      onClick={() => void runAction(
                        () => requestBadCaseAnalysis(packId),
                        analysisMessage,
                      )}
                      className="ml-2 min-h-9 rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 disabled:opacity-50 light:border-gray-300 light:text-gray-700"
                    >
                      {busy
                        ? '分析中…'
                        : detail.analysisStatus === 'pending'
                          ? '分析处理中'
                          : detail.analysisStatus === 'completed'
                            ? '检查 DeepSeek 分析'
                            : '运行 DeepSeek 分析'}
                    </button>
                    <p data-testid="review-pack-analysis-help" className="mt-2 text-[10px] text-gray-600">
                      先保留确定性规则证据，再由 DeepSeek 生成诊断与修复建议；建议必须人工审阅，不会直接修改或发布 Prompt、规则、知识库。
                    </p>
                  </div>
                </div>
              </Section>

              <Section id="sample" title="样本">
                <div className="text-xs text-gray-500">
                  {[detail.sample.brandName, detail.sample.productName].filter(Boolean).join(' · ') || '未记录品牌/产品'}
                </div>
                {detail.sample.errorMessage && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
                    {detail.sample.errorMessage}
                    {detail.sample.errorCode ? ` · ${detail.sample.errorCode}` : ''}
                  </div>
                )}
                <div>
                  <h4 className="mb-1 text-xs font-semibold">原始需求</h4>
                  <p
                    data-testid="review-pack-sample-body"
                    className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-gray-900/60 p-3 text-sm leading-relaxed light:bg-gray-50"
                  >
                    {detail.sample.source || '未记录'}
                  </p>
                </div>
                <div>
                  <h4 className="mb-2 text-xs font-semibold">生成文案</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.entries(detail.sample.variants ?? {}).map(([key, value]) => (
                      <div key={key} className="rounded-lg border border-gray-700/50 p-3 light:border-gray-200">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{key}</p>
                        <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed">
                          {String(value)}
                        </p>
                      </div>
                    ))}
                    {Object.keys(detail.sample.variants ?? {}).length === 0 && (
                      <p className="text-xs text-gray-500">未记录生成文案</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <JsonBlock title="诊断" value={detail.sample.diagnosis} />
                  <JsonBlock title="审核" value={detail.sample.audit} />
                  <JsonBlock title="评分" value={detail.sample.scores} />
                </div>
              </Section>

              <Section id="trace" title="Trace">
                {detail.trace.status === 'unavailable' && (
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-xs text-amber-400">
                    运行轨迹暂不可用；无法判断是否已采集，请勿当作“零错误成功”。
                  </p>
                )}
                {detail.trace.status === 'legacy_unavailable' && (
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-xs text-amber-400">
                    旧任务未采集快照，运行轨迹不可追溯。
                  </p>
                )}
                {detail.trace.status === 'available' && detail.trace.events.length === 0 && (
                  <p className="text-center text-xs text-gray-500">此任务暂无轨迹事件</p>
                )}
                {detail.trace.status === 'available' && detail.trace.events.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-gray-700/50 light:border-gray-200">
                    <table className="min-w-[720px] w-full text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-3 py-2">阶段</th>
                          <th className="px-3 py-2">状态</th>
                          <th className="px-3 py-2">模型</th>
                          <th className="px-3 py-2">耗时</th>
                          <th className="px-3 py-2">错误类</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 light:divide-gray-200">
                        {detail.trace.events.map((event, index) => (
                          <tr key={index}>
                            <td className="px-3 py-2">{String(event.stage ?? event.operation ?? '—')}</td>
                            <td className="px-3 py-2">{String(event.status ?? '—')}</td>
                            <td className="px-3 py-2">{String(event.provider ?? '')} / {String(event.model ?? '')}</td>
                            <td className="px-3 py-2 tabular-nums">{String(event.latencyMs ?? '—')}</td>
                            <td className="px-3 py-2">{String(event.errorClass ?? '—')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section id="criteria" title="验收">
                {detail.criteria.length === 0 ? (
                  <p className="text-xs text-gray-500">暂无验收标准结果</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.criteria.map((item) => (
                      <li
                        key={item.criterionId}
                        className="rounded-md border border-gray-700/40 px-3 py-2 text-xs light:border-gray-200"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{item.name}</span>
                          <span className="rounded bg-gray-800 px-1.5 py-0.5 light:bg-gray-100">{item.result}</span>
                          <span className="text-gray-500">v{item.version}</span>
                        </div>
                        {(item.actual !== undefined || item.expected !== undefined) && (
                          <p className="mt-1 text-gray-500">
                            实际 {String(item.actual ?? '—')} / 期望 {String(item.expected ?? '—')}
                          </p>
                        )}
                        {item.result === 'not_evaluated' && (
                          <p className="mt-1 text-amber-400">无法从现有字段可靠计算</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section id="artifacts" title="工件">
                {detail.artifacts.status === 'legacy_unavailable' ? (
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-xs text-amber-400">
                    旧任务无生成时快照，工件不可追溯；不会用当前文件内容冒充历史事实。
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <JsonBlock title="Prompt" value={detail.artifacts.prompt} />
                    <JsonBlock title="规则" value={detail.artifacts.rules} />
                    <JsonBlock title="知识" value={detail.artifacts.knowledge} />
                    <JsonBlock title="模型策略" value={detail.artifacts.modelPolicy} />
                  </div>
                )}
              </Section>

              <Section id="findings" title="Findings" defaultOpen>
                {detail.findings.length === 0 ? (
                  <p className="text-xs text-gray-500">暂无 findings</p>
                ) : (
                  <div className="space-y-3">
                    <ul className="space-y-2">
                      {detail.findings.map((item) => (
                        <li
                          key={item.id}
                          className={`rounded-md border px-3 py-2 text-xs ${
                            item.id === (finding?.id ?? '')
                              ? 'border-emerald-500/40 light:border-orange-400'
                              : 'border-gray-700/40 light:border-gray-200'
                          }`}
                        >
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => setActiveFindingId(item.id)}
                          >
                            <div className="flex flex-wrap gap-2">
                              <span className="font-semibold">{item.category}</span>
                              <span className="text-red-400">{item.severity}</span>
                              <span className="text-gray-500">{item.disposition ?? '未处置'}</span>
                            </div>
                            <p className="mt-1 text-gray-300 light:text-gray-700">{item.description}</p>
                          </button>
                        </li>
                      ))}
                    </ul>

                    {finding && (
                      <div className="space-y-2 rounded-lg border border-gray-700/50 p-3 light:border-gray-200">
                        <p className="text-[11px] text-gray-500">处置 finding · {finding.id}</p>
                        {suggestion && (
                          <div className="rounded-md border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs light:bg-cyan-50">
                            <div className="flex flex-wrap gap-2 text-[10px] text-cyan-300 light:text-cyan-700">
                              <span>{suggestion.provider}{suggestion.model ? ` · ${suggestion.model}` : ''}</span>
                              {suggestion.confidence != null && <span>置信度 {Math.round(suggestion.confidence * 100)}%</span>}
                              <span>建议 Owner：{suggestion.ownerTeam}</span>
                            </div>
                            <p className="mt-2"><span className="font-semibold">AI 诊断：</span>{suggestion.diagnosis}</p>
                            <p className="mt-2"><span className="font-semibold">修复建议：</span>{suggestion.remediation}</p>
                            <p className="mt-2 text-[10px] text-gray-500">仅供审阅；保存处置或创建提案后才进入人工流程。</p>
                          </div>
                        )}
                        <label className="block text-[11px] text-gray-500" htmlFor="finding-disposition">Finding 处置</label>
                        <select
                          id="finding-disposition"
                          aria-label="Finding 处置"
                          value={disposition}
                          onChange={(e) => setDisposition(e.target.value as FindingDisposition)}
                          className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs light:border-gray-300 light:bg-white"
                        >
                          {DISPOSITIONS.map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <label className="block text-[11px] text-gray-500" htmlFor="finding-note">处置备注</label>
                        <textarea
                          id="finding-note"
                          aria-label="处置备注"
                          value={dispositionNote}
                          onChange={(e) => setDispositionNote(e.target.value)}
                          rows={2}
                          className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs light:border-gray-300 light:bg-white"
                        />
                        <div className="space-y-2 rounded-md border border-gray-700/50 p-2 light:border-gray-200">
                          <p className="text-[11px] font-medium text-gray-300 light:text-gray-700">
                            待审工件提案
                          </p>
                          <label className="block text-[11px] text-gray-500" htmlFor="proposal-artifact-type">
                            工件类型
                          </label>
                          <select
                            id="proposal-artifact-type"
                            aria-label="提案工件类型"
                            value={proposalArtifactType}
                            onChange={(event) => {
                              const next = event.target.value as ProposalArtifactType;
                              setProposalArtifactType(next);
                              setProposalPatchText(DEFAULT_PROPOSAL_PATCH[next]);
                            }}
                            disabled={detail.artifacts.status !== 'available'}
                            className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs light:border-gray-300 light:bg-white"
                          >
                            <option value="prompt">Prompt</option>
                            <option value="rules">规则</option>
                            <option value="knowledge">知识</option>
                            <option value="model_policy">模型策略</option>
                          </select>
                          <label className="block text-[11px] text-gray-500" htmlFor="proposal-patch">
                            JSON Patch（仅允许白名单路径）
                          </label>
                          <textarea
                            id="proposal-patch"
                            aria-label="提案 JSON Patch"
                            value={proposalPatchText}
                            onChange={(event) => setProposalPatchText(event.target.value)}
                            rows={4}
                            spellCheck={false}
                            disabled={detail.artifacts.status !== 'available'}
                            className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 font-mono text-[11px] light:border-gray-300 light:bg-white"
                          />
                          <label className="block text-[11px] text-gray-500" htmlFor="proposal-rationale">
                            提案理由
                          </label>
                          <textarea
                            id="proposal-rationale"
                            aria-label="提案理由"
                            value={proposalRationale}
                            onChange={(event) => setProposalRationale(event.target.value)}
                            rows={2}
                            disabled={detail.artifacts.status !== 'available'}
                            className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs light:border-gray-300 light:bg-white"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void runAction(() => reviewBadCaseFinding(finding.id, {
                              disposition,
                              reviewerComment: dispositionNote,
                            }))}
                            className="min-h-9 rounded-md bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-300 disabled:opacity-50 light:bg-orange-100 light:text-orange-700"
                          >
                            保存处置
                          </button>
                          <button
                            type="button"
                            disabled={busy || detail.artifacts.status !== 'available'}
                            onClick={() => void createProposal(finding.id)}
                            className="min-h-9 rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-300 disabled:opacity-50 light:border-gray-300 light:text-gray-700"
                          >
                            创建待审提案
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-600">
                          提案会绑定生成时快照并校验哈希，仅进入待审状态，不会直接发布到 Prompt、规则、知识库或模型策略。
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </Section>

              <Section id="audit" title="审计">
                {detail.auditEvents.length === 0 ? (
                  <p className="text-xs text-gray-500">暂无业务审计事件</p>
                ) : (
                  <ul className="space-y-2">
                    {detail.auditEvents.map((event) => (
                      <li
                        key={event.id}
                        className="rounded-md border border-gray-700/40 px-3 py-2 text-xs light:border-gray-200"
                      >
                        <div className="flex flex-wrap gap-2">
                          <span className="font-semibold">{event.eventType}</span>
                          <span className="text-gray-500">{event.createdAt}</span>
                          {event.actorId && <span className="font-mono text-[10px]">{event.actorId}</span>}
                        </div>
                        {event.reason && <p className="mt-1 text-gray-400">原因：{event.reason}</p>}
                        {(event.before != null || event.after != null) && (
                          <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words text-[10px] text-gray-500">
                            {JSON.stringify({ before: event.before, after: event.after }, null, 2)}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
