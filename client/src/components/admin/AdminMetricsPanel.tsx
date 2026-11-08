import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertTriangle, Bot, Coins, Gauge, Loader2, RefreshCw } from 'lucide-react';
import {
  getAdminBadCases,
  getAdminMetricsOverview,
  getAdminModelMetrics,
  getAdminProviderBalance,
  type AdminBadCases,
  type AdminMetricsOverview,
  type AdminModelMetrics,
  type AdminProviderBalance,
} from '../../services/adminMetricsApi';
import BadCaseDetailDialog from './BadCaseDetailDialog';

type AdminRole = 'admin' | 'super_admin';

function number(value: number): string {
  return new Intl.NumberFormat('zh-HK').format(value);
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-700/40 bg-gray-900/40 px-3 py-3 light:border-gray-200 light:bg-gray-50">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-100 light:text-gray-900">{number(value)}</p>
    </div>
  );
}

function BalanceCard({ balance }: { balance: AdminProviderBalance | null }) {
  return (
    <section className="rounded-lg border border-gray-700/40 bg-gray-900/40 p-4 light:border-gray-200 light:bg-gray-50">
      <div className="flex items-center gap-2">
        <Coins className="h-4 w-4 text-emerald-400 light:text-orange-600" />
        <h3 className="text-xs font-semibold">DeepSeek 官方余额</h3>
      </div>
      {!balance || balance.status === 'unavailable' ? (
        <p className="mt-3 text-sm text-gray-500">暂不可用</p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className={`text-xs font-medium ${balance.isAvailable ? 'text-emerald-400 light:text-emerald-700' : 'text-amber-400 light:text-amber-700'}`}>
            {balance.isAvailable ? '账户可用于 API 调用' : '当前账户不可用于 API 调用'}
          </p>
          {balance.balances.length === 0 ? (
            <p className="text-xs text-gray-500">余额明细为空</p>
          ) : balance.balances.map((item) => (
            <div key={item.currency} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-gray-500">{item.currency}</span>
              <span className="font-medium tabular-nums">{item.totalBalance}</span>
            </div>
          ))}
          <p className="text-[10px] text-gray-600 light:text-gray-400">
            更新于 {balance.fetchedAt.slice(0, 16).replace('T', ' ')}
          </p>
        </div>
      )}
    </section>
  );
}

export default function AdminMetricsPanel({ role }: { role: AdminRole }) {
  const requestVersion = useRef(0);
  const [overview, setOverview] = useState<AdminMetricsOverview | null>(null);
  const [models, setModels] = useState<AdminModelMetrics | null>(null);
  const [badCases, setBadCases] = useState<AdminBadCases | null>(null);
  const [balance, setBalance] = useState<AdminProviderBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(false);
  const [superError, setSuperError] = useState(false);
  const [selectedBadCaseId, setSelectedBadCaseId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setOverviewError(false);
    setSuperError(false);

    const overviewPromise = getAdminMetricsOverview();
    const superPromises = role === 'super_admin'
      ? [getAdminModelMetrics(), getAdminBadCases(), getAdminProviderBalance()] as const
      : null;

    const overviewResult = await Promise.allSettled([overviewPromise]);
    if (version !== requestVersion.current) return;
    if (overviewResult[0].status === 'fulfilled') setOverview(overviewResult[0].value);
    else setOverviewError(true);

    if (superPromises) {
      const [modelResult, badCaseResult, balanceResult] = await Promise.allSettled(superPromises);
      if (version !== requestVersion.current) return;
      if (modelResult.status === 'fulfilled') setModels(modelResult.value);
      else setModels(null);
      if (badCaseResult.status === 'fulfilled') setBadCases(badCaseResult.value);
      else setBadCases(null);
      if (balanceResult.status === 'fulfilled') setBalance(balanceResult.value);
      else setBalance({ provider: 'deepseek', status: 'unavailable' });
      setSuperError([modelResult, badCaseResult, balanceResult].some((result) => result.status === 'rejected'));
    } else {
      setModels(null);
      setBadCases(null);
      setBalance(null);
    }
    setLoading(false);
  }, [role]);

  useEffect(() => {
    void load();
    return () => { requestVersion.current += 1; };
  }, [load]);

  return (
    <section data-testid="admin-metrics-panel" className="mb-6 space-y-4 rounded-xl border border-gray-800 bg-gray-900/20 p-4 light:border-gray-200 light:bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400 light:text-orange-600" />
            <h2 className="text-sm font-semibold">运营概览</h2>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            {overview
              ? `${overview.from} 至 ${overview.to} · ${overview.scope === 'global' ? '全局' : `分组 ${overview.reviewGroup ?? '未分组'}`}`
              : '最近 30 个香港自然日'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void load(); }}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:text-gray-200 disabled:opacity-50 light:border-gray-300 light:text-gray-600 light:hover:text-gray-900"
          aria-label="刷新运营指标"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {loading && !overview && (
        <div className="flex items-center gap-2 py-5 text-xs text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> 加载指标…
        </div>
      )}

      {overviewError && !overview && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4" /> 运营指标加载失败，请重试
        </div>
      )}

      {overview && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="DAU" value={overview.activity.dau} />
          <MetricCard label="WAU" value={overview.activity.wau} />
          <MetricCard label="MAU" value={overview.activity.mau} />
          <MetricCard label="会员发放" value={overview.membershipGrants.total} />
          <MetricCard label="额度消耗" value={overview.quota.consumed} />
          <MetricCard label="当前结余" value={overview.quota.remaining} />
        </div>
      )}

      {role === 'super_admin' && (
        <div className="space-y-3 border-t border-gray-800 pt-4 light:border-gray-200">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-emerald-400 light:text-orange-600" />
            <h2 className="text-sm font-semibold">模型健康</h2>
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400 light:text-amber-700">仅超级管理员</span>
          </div>

          {superError && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
              <AlertTriangle className="h-4 w-4" /> 模型指标加载失败，请重试
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(14rem,1fr)]">
            <section className="overflow-hidden rounded-lg border border-gray-700/40 light:border-gray-200">
              <div className="flex items-center gap-2 border-b border-gray-800 bg-gray-900/40 px-3 py-2 light:border-gray-200 light:bg-gray-50">
                <Gauge className="h-3.5 w-3.5 text-gray-500" />
                <h3 className="text-xs font-semibold">调用质量与 Token</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2">模型</th><th className="px-3 py-2">成功</th><th className="px-3 py-2">错误率</th>
                      <th className="px-3 py-2">平均 / P95</th><th className="px-3 py-2">Token</th><th className="px-3 py-2">缺失 usage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 light:divide-gray-200">
                    {models?.rows.map((row) => (
                      <tr key={`${row.provider}:${row.model}`}>
                        <td className="px-3 py-2.5 font-medium">{row.provider} / {row.model}</td>
                        <td className="px-3 py-2.5 tabular-nums">{row.success}/{row.total}</td>
                        <td className="px-3 py-2.5 tabular-nums">{(row.errorRate * 100).toFixed(1)}%</td>
                        <td className="px-3 py-2.5 tabular-nums">{number(row.avgLatencyMs)} / {number(row.p95LatencyMs)} ms</td>
                        <td className="px-3 py-2.5 tabular-nums">{number(row.totalTokens)}</td>
                        <td className="px-3 py-2.5 tabular-nums">{number(row.unavailableUsageCount)}</td>
                      </tr>
                    ))}
                    {models && models.rows.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">暂无模型调用数据</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            <BalanceCard balance={balance} />
          </div>

          <section className="rounded-lg border border-gray-700/40 p-3 light:border-gray-200">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold">低分任务</h3>
              <span className="text-[10px] text-gray-500">港味评分低于 {badCases?.threshold ?? 50} · 最多 20 条</span>
            </div>
            {badCases && badCases.items.length === 0 ? (
              <p className="py-5 text-center text-xs text-gray-500">暂无低分任务</p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {badCases?.items.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedBadCaseId(item.id)}
                    aria-label={`查看低分任务 ${item.id}`}
                    className="rounded-md bg-gray-900/50 p-3 text-left transition-colors hover:bg-gray-800/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 light:bg-gray-50 light:hover:bg-gray-100 light:focus:ring-orange-500/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-gray-500">{item.id.slice(0, 8)}</span>
                      <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-semibold text-red-400 light:text-red-700">{item.score} 分</span>
                    </div>
                    <p className="mt-2 text-xs">{item.platform} · {item.tone}</p>
                    <p className="mt-1 text-[10px] text-gray-500">{item.generationEngine ?? '未记录引擎'} · {item.createdAt.slice(0, 10)}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      {selectedBadCaseId && (
        <BadCaseDetailDialog jobId={selectedBadCaseId} onClose={() => setSelectedBadCaseId(null)} />
      )}
    </section>
  );
}
