import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, Loader2, RefreshCw, Stethoscope, X } from 'lucide-react';
import {
  formatDiagnosticsRate,
  formatDurationMs,
  formatTokenCostDisplay,
  getBadCaseDiagnostics,
  userFacingDiagnosticsError,
  type BadCaseDiagnosticsResponse,
} from '../../services/badCaseDiagnosticsApi';

type AdminRole = 'admin' | 'super_admin';

/** Fixed registry order — plan §4.2 / server FINDING_CATEGORIES. */
const FINDING_CATEGORY_LABELS: Array<{ code: string; label: string }> = [
  { code: 'input_contract', label: '输入契约' },
  { code: 'context_resolution', label: '上下文解析' },
  { code: 'prompt_instruction', label: 'Prompt 指令' },
  { code: 'knowledge_retrieval', label: '知识检索' },
  { code: 'model_transport', label: '模型传输' },
  { code: 'model_output_schema', label: '输出结构' },
  { code: 'content_quality', label: '内容质量' },
  { code: 'compliance', label: '合规安全' },
  { code: 'persistence', label: '持久化' },
  { code: 'ui_presentation', label: 'UI 呈现' },
  { code: 'evaluation_gap', label: '评测缺口' },
];

const ALERT_STORAGE_KEY = '77:bad-case-diagnostics-alert:v1';

type AttentionItem = {
  key: string;
  value: number;
  message: string;
};

function buildAttentionItems(
  summary: BadCaseDiagnosticsResponse['summary'],
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const unreviewed = Math.max(0, summary.dispositionRates.total - summary.dispositionRates.reviewed);

  if (unreviewed > 0) {
    items.push({ key: 'unreviewed', value: unreviewed, message: `${number(unreviewed)} 条 Finding 未审核` });
  }
  if (summary.recurrence.duplicateSampleCount > 0) {
    const count = summary.recurrence.duplicateSampleCount;
    items.push({ key: 'duplicates', value: count, message: `${number(count)} 个重复样本` });
  }
  if ((summary.criterionCoverage.failRateAmongEvaluated ?? 0) > 0) {
    const rate = summary.criterionCoverage.failRateAmongEvaluated as number;
    items.push({
      key: 'criterion-failures',
      value: rate,
      message: `已评估失败率 ${formatDiagnosticsRate(rate)}`,
    });
  }
  if (summary.criterionCoverage.notEvaluated > 0) {
    const count = summary.criterionCoverage.notEvaluated;
    items.push({ key: 'not-evaluated', value: count, message: `${number(count)} 条标准未评估` });
  }
  if (summary.resolutionLatency.invalidCount > 0) {
    const count = summary.resolutionLatency.invalidCount;
    items.push({ key: 'invalid-latency', value: count, message: `${number(count)} 条解决时长记录无效` });
  }
  return items;
}

function number(value: number): string {
  return new Intl.NumberFormat('zh-HK').format(value);
}

function MetricCard({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-700/40 bg-gray-900/40 px-3 py-3 light:border-gray-200 light:bg-gray-50">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p
        data-testid={testId}
        className="mt-1 break-words text-sm font-semibold tabular-nums text-gray-100 light:text-gray-900"
      >
        {value}
      </p>
    </div>
  );
}

function Section({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-testid={testId}
      className="space-y-2 rounded-lg border border-gray-700/40 p-3 light:border-gray-200"
    >
      <h3 className="text-xs font-semibold text-gray-200 light:text-gray-800">{title}</h3>
      {children}
    </section>
  );
}

export default function BadCaseDiagnosticsPanel({ role }: { role: AdminRole }) {
  const requestVersion = useRef(0);
  const lastAlertSignature = useRef<string | null>(null);
  const [data, setData] = useState<BadCaseDiagnosticsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState<AttentionItem[] | null>(null);

  const load = useCallback(async () => {
    if (role !== 'super_admin') return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getBadCaseDiagnostics();
      if (version !== requestVersion.current) return;
      setData(result);
    } catch (err) {
      if (version !== requestVersion.current) return;
      setData(null);
      setError(userFacingDiagnosticsError(err));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  const attentionItems = data ? buildAttentionItems(data.summary) : [];
  const attentionSignature = data && attentionItems.length > 0
    ? JSON.stringify({
      from: data.from,
      to: data.to,
      items: attentionItems.map(({ key, value }) => [key, value]),
    })
    : null;

  useEffect(() => {
    if (role !== 'super_admin' || !attentionSignature || !data) {
      if (data && attentionItems.length === 0) setNotice(null);
      return;
    }
    if (lastAlertSignature.current === attentionSignature) return;
    lastAlertSignature.current = attentionSignature;

    let alreadySeen = false;
    try {
      alreadySeen = window.sessionStorage.getItem(ALERT_STORAGE_KEY) === attentionSignature;
      if (!alreadySeen) window.sessionStorage.setItem(ALERT_STORAGE_KEY, attentionSignature);
    } catch {
      // In-memory signature above still prevents repeat alerts when storage is unavailable.
    }
    if (!alreadySeen) setNotice(buildAttentionItems(data.summary));
  }, [attentionSignature, data, role]);

  if (role !== 'super_admin') return null;

  const summary = data?.summary;
  const costDisplay = formatTokenCostDisplay(summary?.tokenCost ?? null);

  return (
    <section
      data-testid="bad-case-diagnostics-panel"
      className="mb-6 space-y-4 rounded-xl border border-gray-800 bg-gray-900/20 p-4 light:border-gray-200 light:bg-white"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          data-testid="bad-case-diagnostics-toggle"
          aria-expanded={expanded}
          aria-controls="bad-case-diagnostics-content"
          aria-label={`${expanded ? '收起' : '展开'} Bad Case 诊断指标`}
          onClick={() => setExpanded((current) => !current)}
          className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-gray-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 light:hover:bg-gray-50 light:focus-visible:ring-orange-500/50"
        >
          <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <Stethoscope className="h-4 w-4 shrink-0 text-emerald-400 light:text-orange-600" />
            <span className="text-sm font-semibold">Bad Case 诊断指标</span>
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400 light:text-amber-700">
              仅超级管理员
            </span>
            <span
              data-testid="bad-case-diagnostics-attention"
              className={`rounded px-1.5 py-0.5 text-[10px] ${
                attentionItems.length > 0
                  ? 'bg-red-500/10 text-red-300 light:text-red-700'
                  : 'bg-emerald-500/10 text-emerald-300 light:text-emerald-700'
              }`}
            >
              {loading && !data
                ? '诊断中'
                : error
                  ? '加载失败'
                  : attentionItems.length > 0
                    ? `${attentionItems.length} 类指标需关注`
                    : data
                      ? '暂无需关注'
                      : '等待诊断'}
            </span>
          </span>
          <span
            data-testid="bad-case-diagnostics-window"
            className="mt-1 block text-[11px] text-gray-500"
          >
            {data ? `${data.from} 至 ${data.to}` : '按服务端默认时间窗聚合'}
          </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
        <button
          type="button"
          data-testid="bad-case-diagnostics-refresh"
          onClick={() => {
            void load();
          }}
          disabled={loading}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:text-gray-200 disabled:opacity-50 light:border-gray-300 light:text-gray-600 light:hover:text-gray-900"
          aria-label="刷新诊断指标"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {loading && !data && (
        <div
          data-testid="bad-case-diagnostics-loading"
          className="flex items-center gap-2 py-5 text-xs text-gray-500"
        >
          <Loader2 className="h-4 w-4 animate-spin" /> 加载诊断指标…
        </div>
      )}

      {error && (
        <div
          data-testid="bad-case-diagnostics-error"
          className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {expanded && summary && (
        <div id="bad-case-diagnostics-content" className="space-y-3">
          <p
            data-testid="bad-case-diagnostics-help"
            className="max-w-3xl text-[11px] leading-relaxed text-gray-500"
          >
            综合成功/错误率只能说明链路是否「跑得通」。本面板用问题分类、同类复发、人工确认/误报、验收标准覆盖与解决时长，定位质量失败与评测缺口发生在哪一类、是否复发、是否被审过；结合阶段/类别/Trace 定位错误发生位置。
          </p>
          <Section title="问题分类分布" testId="bad-case-diagnostics-category">
            <p className="text-[10px] text-gray-500">
              Findings 总数 {number(summary.categoryDistribution.total)}
            </p>
            <div
              data-testid="bad-case-diagnostics-category-list"
              className="max-h-60 space-y-1 overflow-y-auto overscroll-contain pr-1"
            >
              {FINDING_CATEGORY_LABELS.map(({ code, label }) => {
                const bucket = summary.categoryDistribution.byCategory[code];
                const count = bucket?.count ?? 0;
                const shareText = formatDiagnosticsRate(bucket?.share ?? null);
                return (
                  <div
                    key={code}
                    data-testid={`bad-case-diagnostics-category-row-${code}`}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-gray-900/40 px-2 py-1.5 text-xs light:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-gray-200 light:text-gray-800">{label}</span>
                      <span
                        className="ml-1.5 font-mono text-[10px] text-gray-500"
                        title={code}
                      >
                        {code}
                      </span>
                    </div>
                    <div className="shrink-0 tabular-nums text-gray-400">
                      <span>{number(count)}</span>
                      <span className="mx-1 text-gray-600">·</span>
                      <span>{shareText}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="同类复发" testId="bad-case-diagnostics-recurrence">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricCard
                label="Findings 总数"
                value={number(summary.recurrence.totalFindings)}
              />
              <MetricCard
                label="样本复发率"
                value={formatDiagnosticsRate(summary.recurrence.sampleRecurrenceRate)}
                testId="bad-case-diagnostics-metric-sample-recurrence"
              />
              <MetricCard
                label="类别复发率"
                value={formatDiagnosticsRate(summary.recurrence.categoryRecurrenceRate)}
                testId="bad-case-diagnostics-metric-category-recurrence"
              />
              <MetricCard
                label="重复样本数"
                value={number(summary.recurrence.duplicateSampleCount)}
                testId="bad-case-diagnostics-metric-duplicate-count"
              />
            </div>
          </Section>

          <Section title="Finding 人工处置" testId="bad-case-diagnostics-disposition">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <MetricCard label="Findings 总数" value={number(summary.dispositionRates.total)} />
              <MetricCard label="已审核" value={number(summary.dispositionRates.reviewed)} />
              <MetricCard
                label="审核覆盖率"
                value={formatDiagnosticsRate(summary.dispositionRates.reviewCoverage)}
                testId="bad-case-diagnostics-metric-review-coverage"
              />
              <MetricCard
                label="确认率"
                value={formatDiagnosticsRate(summary.dispositionRates.confirmationRate)}
                testId="bad-case-diagnostics-metric-confirmation-rate"
              />
              <MetricCard
                label="误报率"
                value={formatDiagnosticsRate(summary.dispositionRates.falsePositiveRate)}
                testId="bad-case-diagnostics-metric-false-positive-rate"
              />
            </div>
          </Section>

          <Section title="验收标准覆盖" testId="bad-case-diagnostics-criteria">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <MetricCard label="标准总数" value={number(summary.criterionCoverage.total)} />
              <MetricCard label="已评估" value={number(summary.criterionCoverage.evaluated)} />
              <MetricCard label="未评估" value={number(summary.criterionCoverage.notEvaluated)} />
              <MetricCard
                label="已评估率"
                value={formatDiagnosticsRate(summary.criterionCoverage.evaluatedRate)}
                testId="bad-case-diagnostics-metric-evaluated-rate"
              />
              <MetricCard
                label="未评估率"
                value={formatDiagnosticsRate(summary.criterionCoverage.notEvaluatedRate)}
                testId="bad-case-diagnostics-metric-not-evaluated-rate"
              />
              <MetricCard
                label="已评估失败率"
                value={formatDiagnosticsRate(summary.criterionCoverage.failRateAmongEvaluated)}
                testId="bad-case-diagnostics-metric-fail-among-evaluated"
              />
            </div>
          </Section>

          <Section title="解决时长" testId="bad-case-diagnostics-latency">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricCard
                label="有效样本"
                value={number(summary.resolutionLatency.sampleSize)}
              />
              <MetricCard
                label="P50"
                value={formatDurationMs(summary.resolutionLatency.p50Ms)}
                testId="bad-case-diagnostics-metric-p50"
              />
              <MetricCard
                label="P95"
                value={formatDurationMs(summary.resolutionLatency.p95Ms)}
                testId="bad-case-diagnostics-metric-p95"
              />
              <MetricCard
                label="无效记录"
                value={number(summary.resolutionLatency.invalidCount)}
              />
            </div>
          </Section>

          <Section title="Token 成本（CNY）" testId="bad-case-diagnostics-token-cost">
            <div className="flex flex-wrap items-center gap-2">
              <p
                data-testid="bad-case-diagnostics-metric-sum-cny"
                className="text-sm font-semibold tabular-nums text-gray-100 light:text-gray-900"
              >
                {costDisplay.label}
              </p>
              {costDisplay.kind === 'money' && costDisplay.partial && (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400 light:text-amber-700">
                  部分可估算
                </span>
              )}
            </div>
            {summary.tokenCost && (
              <p className="mt-1 text-[10px] text-gray-500">
                可估算 {summary.tokenCost.okCount}/{summary.tokenCost.sampleSize}
                {summary.tokenCost.unavailableCount > 0
                  ? ` · 不可估算 ${summary.tokenCost.unavailableCount}`
                  : ''}
              </p>
            )}
            <p className="mt-1 text-[10px] leading-relaxed text-gray-600 light:text-gray-400">
              人民币成本仅在官方 usage + 版本化价格表可算时显示；价格或 usage 缺失时显示「暂不可估算」，不会用余额差额或 ￥0 充数。
            </p>
          </Section>
        </div>
      )}

      {notice && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="bad-case-diagnostics-alert"
          className="fixed bottom-4 left-4 right-4 z-50 rounded-xl border border-amber-400/30 bg-gray-950/95 p-4 shadow-2xl backdrop-blur sm:left-auto sm:max-w-md light:border-amber-300 light:bg-white/95"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400 light:text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-100 light:text-gray-900">
                Bad Case 诊断发现 {notice.length} 类指标需关注
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-400 light:text-gray-600">
                {notice.map((item) => item.message).join('；')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setExpanded(true);
                  setNotice(null);
                }}
                className="mt-3 min-h-11 rounded-lg bg-amber-400/15 px-3 py-2 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-400/25 light:text-amber-700"
              >
                展开查看
              </button>
            </div>
            <button
              type="button"
              aria-label="关闭诊断提醒"
              onClick={() => setNotice(null)}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200 light:hover:bg-gray-100 light:hover:text-gray-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
