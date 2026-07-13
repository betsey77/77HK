/**
 * Slice G1: Read-only Admin Dashboard (/admin).
 *
 * Only accessible to users with admin/super_admin roles (server-verified).
 * Displays operational overview and lists; no mutative actions.
 *
 * Uses existing shared primitives, Lucide icons, and the design system
 * (dark=emerald, light=orange). No new dependencies.
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Shield, Users, Zap, MessageSquare, CreditCard, ClipboardList,
  Loader2, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react';
import {
  getAdminStats,
  getAdminUsers,
  getAdminGenerations,
  getAdminFeedback,
  getAdminSubscriptions,
  getAdminAuditLog,
  checkAdminAccess,
  type AdminStats,
  type AdminUserOverview,
  type AdminGenerationMeta,
  type AdminFeedbackSummary,
  type AdminSubscriptionOverview,
  type AdminAuditEntry,
} from '../services/api';

// ── Types ──────────────────────────────────────────────────────

type Tab = 'users' | 'generations' | 'feedback' | 'subscriptions' | 'audit';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'users', label: '用户', icon: <Users className="h-3.5 w-3.5" /> },
  { key: 'generations', label: '生成任务', icon: <Zap className="h-3.5 w-3.5" /> },
  { key: 'feedback', label: '反馈', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { key: 'subscriptions', label: '订阅', icon: <CreditCard className="h-3.5 w-3.5" /> },
  { key: 'audit', label: '审计日志', icon: <ClipboardList className="h-3.5 w-3.5" /> },
];

type LoadState = 'loading' | 'ready' | 'error' | 'forbidden';

const PAGE_SIZE = 20;

// ── Inline Helpers ─────────────────────────────────────────────

function StatCard({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-700/30 bg-gray-900/40 p-4 light:border-gray-200 light:bg-gray-50">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 light:bg-orange-100 light:text-orange-600">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 light:text-gray-500">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function PaginationControls({
  offset, total, onPrev, onNext,
}: {
  offset: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-3 text-xs text-gray-500">
      <span>
        {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total}
      </span>
      <div className="flex gap-1">
        <button
          onClick={onPrev}
          disabled={offset === 0}
          className="rounded p-1 transition-colors hover:text-gray-300 disabled:opacity-30 light:hover:text-gray-700"
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={onNext}
          disabled={offset + PAGE_SIZE >= total}
          className="rounded p-1 transition-colors hover:text-gray-300 disabled:opacity-30 light:hover:text-gray-700"
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'green' | 'amber' | 'red' }) {
  const colors: Record<string, string> = {
    default: 'bg-gray-800 text-gray-300 light:bg-gray-100 light:text-gray-600',
    green: 'bg-emerald-500/10 text-emerald-400 light:bg-emerald-50 light:text-emerald-700',
    amber: 'bg-amber-500/10 text-amber-400 light:bg-amber-50 light:text-amber-700',
    red: 'bg-red-500/10 text-red-400 light:bg-red-50 light:text-red-700',
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[variant]}`}>
      {children}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────

export default function AdminPage() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [tab, setTab] = useState<Tab>('users');

  // Tab data
  const [users, setUsers] = useState<AdminUserOverview[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [jobs, setJobs] = useState<AdminGenerationMeta[]>([]);
  const [jobTotal, setJobTotal] = useState(0);
  const [feedback, setFeedback] = useState<AdminFeedbackSummary[]>([]);
  const [fbTotal, setFbTotal] = useState(0);
  const [subs, setSubs] = useState<AdminSubscriptionOverview[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [audit, setAudit] = useState<AdminAuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);

  // Pagination per tab
  const [offsets, setOffsets] = useState<Record<Tab, number>>({
    users: 0, generations: 0, feedback: 0, subscriptions: 0, audit: 0,
  });
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);

  // ── Initialize ───────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await checkAdminAccess();
      if (cancelled) return;
      if (!ok) {
        setLoadState('forbidden');
        return;
      }
      try {
        const s = await getAdminStats();
        if (cancelled) return;
        setStats(s);
        setLoadState('ready');
      } catch {
        if (!cancelled) setLoadState('error');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Load tab data ────────────────────────────────────────────

  const loadTab = useCallback(async (t: Tab, offset: number) => {
    setTabLoading(true);
    setTabError(null);
    try {
      switch (t) {
        case 'users': {
          const r = await getAdminUsers(PAGE_SIZE, offset);
          setUsers(r.users); setUserTotal(r.total); break;
        }
        case 'generations': {
          const r = await getAdminGenerations(PAGE_SIZE, offset);
          setJobs(r.jobs); setJobTotal(r.total); break;
        }
        case 'feedback': {
          const r = await getAdminFeedback(PAGE_SIZE, offset);
          setFeedback(r.feedback); setFbTotal(r.total); break;
        }
        case 'subscriptions': {
          const r = await getAdminSubscriptions(PAGE_SIZE, offset);
          setSubs(r.subscriptions); setSubTotal(r.total); break;
        }
        case 'audit': {
          const r = await getAdminAuditLog(PAGE_SIZE, offset);
          setAudit(r.entries); setAuditTotal(r.total); break;
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'FORBIDDEN') {
        setLoadState('forbidden');
      } else {
        setTabError('加载失败，请重试');
      }
    } finally {
      setTabLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loadState === 'ready') {
      loadTab(tab, offsets[tab]);
    }
  }, [tab, offsets, loadState, loadTab]);

  // ── Render states ────────────────────────────────────────────

  if (loadState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 light:bg-white">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在验证管理员权限...
        </div>
      </div>
    );
  }

  if (loadState === 'forbidden') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 light:bg-white">
        <div className="text-center">
          <Shield className="mx-auto h-8 w-8 text-red-400" />
          <h1 className="mt-3 text-lg font-semibold">403 — 访问被拒绝</h1>
          <p className="mt-1 text-sm text-gray-500">你没有管理员权限，无法访问此页面。</p>
          <a
            href="/app"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-400 transition-colors hover:text-emerald-300 light:text-orange-600 light:hover:text-orange-700"
          >
            ← 回到工作台
          </a>
        </div>
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 light:bg-white">
        <div className="text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-400" />
          <h1 className="mt-3 text-lg font-semibold">加载失败</h1>
          <p className="mt-1 text-sm text-gray-500">无法加载管理后台数据，请确认服务是否正常运行。</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-400 transition-colors hover:text-emerald-300 light:text-orange-600 light:hover:text-orange-700"
          >
            <RefreshCw className="h-3.5 w-3.5" /> 重新加载
          </button>
        </div>
      </div>
    );
  }

  const currentOffset = offsets[tab];

  return (
    <div className="min-h-screen bg-gray-950 light:bg-white text-gray-100 light:text-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-800 light:border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-400 light:text-orange-500" />
          <h1 className="text-sm font-semibold">管理后台</h1>
          <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500 light:bg-gray-100 light:text-gray-400">
            只读
          </span>
        </div>
        <a
          href="/app"
          className="text-xs text-gray-500 transition-colors hover:text-gray-300 light:hover:text-gray-700"
        >
          ← 回到工作台
        </a>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Stats */}
        {stats && (
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="总用户数" value={stats.totalUsers} icon={<Users className="h-5 w-5" />} />
            <StatCard label="活跃订阅" value={stats.activeSubscriptions} icon={<CreditCard className="h-5 w-5" />} />
            <StatCard label="总生成数" value={stats.totalGenerations} icon={<Zap className="h-5 w-5" />} />
            <StatCard label="反馈数" value={stats.totalFeedback} icon={<MessageSquare className="h-5 w-5" />} />
            <StatCard label="管理员" value={stats.adminUsers} icon={<Shield className="h-5 w-5" />} />
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-800 light:border-gray-200 pb-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); }}
              className={`inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-emerald-400 text-emerald-400 light:border-orange-500 light:text-orange-600'
                  : 'text-gray-500 hover:text-gray-300 light:hover:text-gray-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          <button
            onClick={() => loadTab(tab, currentOffset)}
            disabled={tabLoading}
            className="ml-auto inline-flex items-center gap-1 rounded px-2 py-2 text-[10px] text-gray-500 transition-colors hover:text-gray-300 light:hover:text-gray-700"
            title="刷新当前视图"
          >
            <RefreshCw className={`h-3 w-3 ${tabLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tab content */}
        {tabError && (
          <div className="mb-3 flex items-center gap-2 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {tabError}
          </div>
        )}

        <div className="overflow-x-auto">
          {tab === 'users' && <UsersTable users={users} loading={tabLoading} />}
          {tab === 'generations' && <GenerationsTable jobs={jobs} loading={tabLoading} />}
          {tab === 'feedback' && <FeedbackTable feedback={feedback} loading={tabLoading} />}
          {tab === 'subscriptions' && <SubscriptionsTable subs={subs} loading={tabLoading} />}
          {tab === 'audit' && <AuditTable entries={audit} loading={tabLoading} />}
        </div>

        {/* Pagination */}
        <PaginationControls
          offset={currentOffset}
          total={
            tab === 'users' ? userTotal :
            tab === 'generations' ? jobTotal :
            tab === 'feedback' ? fbTotal :
            tab === 'subscriptions' ? subTotal : auditTotal
          }
          onPrev={() => setOffsets((prev) => ({ ...prev, [tab]: Math.max(0, prev[tab] - PAGE_SIZE) }))}
          onNext={() => setOffsets((prev) => ({ ...prev, [tab]: prev[tab] + PAGE_SIZE }))}
        />
      </div>
    </div>
  );
}

// ── Table Components ───────────────────────────────────────────

function EmptyRow({ colSpan, loading }: { colSpan: number; loading: boolean }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-xs text-gray-600">
        {loading ? '加载中...' : '暂无数据'}
      </td>
    </tr>
  );
}

function UsersTable({ users, loading }: { users: AdminUserOverview[]; loading: boolean }) {
  if (users.length === 0 && !loading) {
    return <p className="py-8 text-center text-xs text-gray-600">暂无用户数据</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-800 light:border-gray-200 text-left text-gray-500">
          <th className="px-4 py-2 font-medium">用户</th>
          <th className="px-4 py-2 font-medium">角色</th>
          <th className="px-4 py-2 font-medium">状态</th>
          <th className="px-4 py-2 font-medium">订阅</th>
          <th className="px-4 py-2 font-medium">生成数</th>
          <th className="px-4 py-2 font-medium">注册时间</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-b border-gray-800/50 light:border-gray-100">
            <td className="max-w-[200px] truncate px-4 py-2.5" title={u.userIdPrefix}>{u.displayName}</td>
            <td className="px-4 py-2.5">
              <div className="flex gap-1">
                {u.roles.map((r) => (
                  <Badge key={r} variant={r === 'admin' || r === 'super_admin' ? 'amber' : 'default'}>{r}</Badge>
                ))}
              </div>
            </td>
            <td className="px-4 py-2.5">
              <Badge variant={u.status === 'active' ? 'green' : u.status === 'deleted' ? 'red' : 'default'}>{u.status}</Badge>
            </td>
            <td className="px-4 py-2.5 text-gray-400">{u.subscriptionPlan ?? '—'}</td>
            <td className="px-4 py-2.5 tabular-nums">{u.generationCount}</td>
            <td className="px-4 py-2.5 text-gray-500">{u.createdAt.slice(0, 10)}</td>
          </tr>
        ))}
        {users.length === 0 && <EmptyRow colSpan={6} loading={loading} />}
      </tbody>
    </table>
  );
}

function GenerationsTable({ jobs, loading }: { jobs: AdminGenerationMeta[]; loading: boolean }) {
  if (jobs.length === 0 && !loading) {
    return <p className="py-8 text-center text-xs text-gray-600">暂无生成任务数据</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-800 light:border-gray-200 text-left text-gray-500">
          <th className="px-4 py-2 font-medium">用户</th>
          <th className="px-4 py-2 font-medium">平台</th>
          <th className="px-4 py-2 font-medium">语气</th>
          <th className="px-4 py-2 font-medium">引擎</th>
          <th className="px-4 py-2 font-medium">状态</th>
          <th className="px-4 py-2 font-medium">时间</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map((j) => (
          <tr key={j.id} className="border-b border-gray-800/50 light:border-gray-100">
            <td className="max-w-[160px] truncate px-4 py-2.5">{j.ownerDisplayName}</td>
            <td className="px-4 py-2.5 text-gray-400">{j.platform}</td>
            <td className="px-4 py-2.5 text-gray-400">{j.tone}</td>
            <td className="px-4 py-2.5 text-gray-500">{j.generationEngine ?? '—'}</td>
            <td className="px-4 py-2.5">
              <Badge variant={j.status === 'completed' ? 'green' : j.status === 'failed' ? 'red' : 'amber'}>{j.status}</Badge>
            </td>
            <td className="px-4 py-2.5 text-gray-500">{j.createdAt.slice(0, 10)}</td>
          </tr>
        ))}
        {jobs.length === 0 && <EmptyRow colSpan={6} loading={loading} />}
      </tbody>
    </table>
  );
}

function FeedbackTable({ feedback, loading }: { feedback: AdminFeedbackSummary[]; loading: boolean }) {
  if (feedback.length === 0 && !loading) {
    return <p className="py-8 text-center text-xs text-gray-600">暂无反馈数据</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-800 light:border-gray-200 text-left text-gray-500">
          <th className="px-4 py-2 font-medium">用户</th>
          <th className="px-4 py-2 font-medium">类型</th>
          <th className="px-4 py-2 font-medium">标题</th>
          <th className="px-4 py-2 font-medium">通知状态</th>
          <th className="px-4 py-2 font-medium">时间</th>
        </tr>
      </thead>
      <tbody>
        {feedback.map((f) => (
          <tr key={f.id} className="border-b border-gray-800/50 light:border-gray-100">
            <td className="max-w-[150px] truncate px-4 py-2.5">{f.ownerDisplayName}</td>
            <td className="px-4 py-2.5">
              <Badge variant={f.type === 'bug_report' ? 'red' : f.type === 'feature_request' ? 'green' : 'default'}>{f.type}</Badge>
            </td>
            <td className="max-w-[150px] truncate px-4 py-2.5">{f.title}</td>
            <td className="px-4 py-2.5">
              <Badge variant={f.notifyStatus === 'sent' ? 'green' : f.notifyStatus === 'failed' ? 'red' : 'default'}>{f.notifyStatus}</Badge>
            </td>
            <td className="px-4 py-2.5 text-gray-500">{f.createdAt.slice(0, 10)}</td>
          </tr>
        ))}
        {feedback.length === 0 && <EmptyRow colSpan={5} loading={loading} />}
      </tbody>
    </table>
  );
}

function SubscriptionsTable({ subs, loading }: { subs: AdminSubscriptionOverview[]; loading: boolean }) {
  if (subs.length === 0 && !loading) {
    return <p className="py-8 text-center text-xs text-gray-600">暂无订阅数据</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-800 light:border-gray-200 text-left text-gray-500">
          <th className="px-4 py-2 font-medium">用户</th>
          <th className="px-4 py-2 font-medium">套餐</th>
          <th className="px-4 py-2 font-medium">状态</th>
          <th className="px-4 py-2 font-medium">用量</th>
          <th className="px-4 py-2 font-medium">周期开始</th>
          <th className="px-4 py-2 font-medium">周期结束</th>
        </tr>
      </thead>
      <tbody>
        {subs.map((s) => (
          <tr key={s.id} className="border-b border-gray-800/50 light:border-gray-100">
            <td className="max-w-[150px] truncate px-4 py-2.5">{s.userDisplayName}</td>
            <td className="px-4 py-2.5">
              <Badge variant={s.planName === 'Pro' ? 'green' : 'default'}>{s.planName}</Badge>
            </td>
            <td className="px-4 py-2.5">
              <Badge variant={s.status === 'active' ? 'green' : 'amber'}>{s.status}</Badge>
            </td>
            <td className="px-4 py-2.5 tabular-nums">{s.quotaUsed} / {s.quotaTotal}</td>
            <td className="px-4 py-2.5 text-gray-500">{s.cycleStart.slice(0, 10)}</td>
            <td className="px-4 py-2.5 text-gray-500">{s.cycleEnd.slice(0, 10)}</td>
          </tr>
        ))}
        {subs.length === 0 && <EmptyRow colSpan={6} loading={loading} />}
      </tbody>
    </table>
  );
}

function AuditTable({ entries, loading }: { entries: AdminAuditEntry[]; loading: boolean }) {
  if (entries.length === 0 && !loading) {
    return <p className="py-8 text-center text-xs text-gray-600">暂无审计日志</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-800 light:border-gray-200 text-left text-gray-500">
          <th className="px-4 py-2 font-medium">操作人</th>
          <th className="px-4 py-2 font-medium">角色</th>
          <th className="px-4 py-2 font-medium">操作</th>
          <th className="px-4 py-2 font-medium">实体</th>
          <th className="px-4 py-2 font-medium">实体ID</th>
          <th className="px-4 py-2 font-medium">时间</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr key={e.id} className="border-b border-gray-800/50 light:border-gray-100">
            <td className="max-w-[150px] truncate px-4 py-2.5 text-gray-400">{e.actor ?? '—'}</td>
            <td className="px-4 py-2.5 text-gray-400">{e.actorRole ?? '—'}</td>
            <td className="px-4 py-2.5">
              <Badge>{e.action}</Badge>
            </td>
            <td className="px-4 py-2.5 text-gray-400">{e.entity ?? '—'}</td>
            <td className="max-w-[120px] truncate px-4 py-2.5 font-mono text-[10px] text-gray-600">{e.entityId ?? '—'}</td>
            <td className="px-4 py-2.5 text-gray-500">{e.createdAt.slice(0, 16).replace('T', ' ')}</td>
          </tr>
        ))}
        {entries.length === 0 && <EmptyRow colSpan={6} loading={loading} />}
      </tbody>
    </table>
  );
}
