/**
 * Slice G1: Read-only Admin Dashboard (/admin).
 *
 * Only accessible to users with admin/super_admin roles (server-verified).
 * Displays operational overview and lists; no mutative actions.
 *
 * Uses existing shared primitives, Lucide icons, and the design system
 * (dark=emerald, light=orange). No new dependencies.
 */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Shield, Users, Zap, MessageSquare, CreditCard, ClipboardList,
  Loader2, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw,
  Bookmark, Eye, Copy, X, Check, MessageSquarePlus, Trash2, Bell,
} from 'lucide-react';
import {
  getAdminStats,
  getAdminUsers,
  getAdminGenerations,
  getAdminFeedback,
  getAdminSubscriptions,
  getAdminAuditLog,
  getAdminFavorites,
  getAdminFavoriteDetail,
  putAdminFavoriteReview,
  getAdminPendingReviewSummary,
  getAdminCaseLibraryDetail,
  checkAdminAccess,
  type AdminStats,
  type AdminUserOverview,
  type AdminGenerationMeta,
  type AdminFeedbackSummary,
  type AdminSubscriptionOverview,
  type AdminAuditEntry,
  type AdminFavoriteMeta,
  type AdminFavoriteDetail,
  type AdminCaseLibraryDetail,
  type AdminFavoriteReviewStatus,
  type AdminReviewAnnotation,
  type AdminPendingReviewSummary,
} from '../services/api';
import { recordAdminPendingReviewSummary } from '../services/adminReviewReminder';
import { utf16OffsetToCodePoint } from '../utils/reviewAnnotations';
import {
  formatAdminCopyType,
  formatAdminPlatform,
  formatAdminReasonTag,
  formatAdminReasonTags,
  resolveFavoritePublishPlatform,
} from '../utils/adminDisplayLabels';

// ── Types ──────────────────────────────────────────────────────

type Tab = 'users' | 'generations' | 'feedback' | 'subscriptions' | 'favorites' | 'audit' | 'case-review';

const BASE_TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'users', label: '用户', icon: <Users className="h-3.5 w-3.5" /> },
  { key: 'generations', label: '生成任务', icon: <Zap className="h-3.5 w-3.5" /> },
  { key: 'feedback', label: '反馈', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { key: 'subscriptions', label: '订阅', icon: <CreditCard className="h-3.5 w-3.5" /> },
  { key: 'favorites', label: '用户收藏', icon: <Bookmark className="h-3.5 w-3.5" /> },
  { key: 'audit', label: '审计日志', icon: <ClipboardList className="h-3.5 w-3.5" /> },
];

/** Empty / missing review fields — never invent values. */
function displayField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '未填写';
  if (typeof value === 'number') return String(value);
  const t = value.trim();
  return t.length > 0 ? t : '未填写';
}

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

function Badge({
  children,
  variant = 'default',
  testId,
}: {
  children: React.ReactNode;
  variant?: 'default' | 'green' | 'amber' | 'red' | 'sky';
  testId?: string;
}) {
  const colors: Record<string, string> = {
    default: 'bg-gray-800 text-gray-300 light:bg-gray-100 light:text-gray-600',
    green: 'bg-emerald-500/10 text-emerald-400 light:bg-emerald-50 light:text-emerald-700',
    amber: 'bg-amber-500/10 text-amber-400 light:bg-amber-50 light:text-amber-700',
    red: 'bg-red-500/10 text-red-400 light:bg-red-50 light:text-red-700',
    // 文案类型：sky 与平台 green 清晰区分；深浅主题均有可读对比
    sky: 'bg-sky-500/15 text-sky-300 light:bg-sky-50 light:text-sky-700',
  };
  return (
    <span
      data-testid={testId}
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[variant]}`}
    >
      {children}
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────

export default function AdminPage({ userEmail }: { userEmail?: string | null } = {}) {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [stats, setStats] = useState<(AdminStats & { role?: 'admin' | 'super_admin' }) | null>(null);
  const [adminRole, setAdminRole] = useState<'admin' | 'super_admin' | null>(null);
  const [tab, setTab] = useState<Tab>(initialParams.get('tab') === 'favorites' ? 'favorites' : 'users');
  const [pendingOnly, setPendingOnly] = useState(initialParams.get('pending') === '1');
  const [pendingSummary, setPendingSummary] = useState<AdminPendingReviewSummary>({ count: 0, latestRequestedAt: null });
  const [reviewToast, setReviewToast] = useState<AdminPendingReviewSummary | null>(null);

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
  const [favorites, setFavorites] = useState<AdminFavoriteMeta[]>([]);
  const [favoriteTotal, setFavoriteTotal] = useState(0);
  const [favoriteDetail, setFavoriteDetail] = useState<AdminFavoriteDetail | null>(null);
  const [favoriteDetailLoading, setFavoriteDetailLoading] = useState(false);
  const [favoriteDetailError, setFavoriteDetailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  /** R1: compact review editor state (detail dialog) */
  const [reviewDraftStatus, setReviewDraftStatus] = useState<AdminFavoriteReviewStatus | null>(null);
  const [reviewDraftNote, setReviewDraftNote] = useState('');
  const [reviewDraftAnnotations, setReviewDraftAnnotations] = useState<AdminReviewAnnotation[]>([]);
  const [pendingSelection, setPendingSelection] = useState<Omit<AdminReviewAnnotation, 'id' | 'note'> | null>(null);
  const [annotationNote, setAnnotationNote] = useState('');
  const reviewBodyRef = useRef<HTMLTextAreaElement>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  /** Favorites metadata search (list only; never loads content). */
  const [favoriteSearchInput, setFavoriteSearchInput] = useState('');
  const [favoriteSearchQ, setFavoriteSearchQ] = useState('');

  // W4: super_admin case review by manual ID (no cross-user list)
  const [caseReviewId, setCaseReviewId] = useState('');
  const [caseDetail, setCaseDetail] = useState<AdminCaseLibraryDetail | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [caseCopied, setCaseCopied] = useState(false);

  // Pagination per tab
  const [offsets, setOffsets] = useState<Record<Tab, number>>({
    users: 0, generations: 0, feedback: 0, subscriptions: 0, favorites: 0, audit: 0, 'case-review': 0,
  });
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState<string | null>(null);

  const tabs = adminRole === 'super_admin'
    ? [...BASE_TABS, { key: 'case-review' as const, label: '案例审阅', icon: <Eye className="h-3.5 w-3.5" /> }]
    : BASE_TABS;

  const refreshPendingSummary = useCallback(async () => {
    try {
      const summary = await getAdminPendingReviewSummary();
      setPendingSummary(summary);
      if (recordAdminPendingReviewSummary(summary, userEmail)) {
        setReviewToast(summary);
      }
    } catch {
      // Keep the admin dashboard usable if the non-critical badge refresh fails.
    }
  }, [userEmail]);

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
        // Server-verified role only (from requireAdmin → stats.role)
        setAdminRole(s.role === 'super_admin' ? 'super_admin' : 'admin');
        setLoadState('ready');
        void refreshPendingSummary();
      } catch {
        if (!cancelled) setLoadState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [refreshPendingSummary]);

  useEffect(() => {
    if (loadState !== 'ready') return;
    const onFocus = () => { void refreshPendingSummary(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshPendingSummary();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadState, refreshPendingSummary]);

  // ── Load tab data ────────────────────────────────────────────

  const loadTab = useCallback(async (t: Tab, offset: number, favoritesQ?: string) => {
    if (t === 'case-review') {
      setTabLoading(false);
      setTabError(null);
      return;
    }
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
        case 'favorites': {
          const query = favoritesQ ?? favoriteSearchQ;
          const r = pendingOnly
            ? await getAdminFavorites(PAGE_SIZE, offset, query, true)
            : await getAdminFavorites(PAGE_SIZE, offset, query);
          setFavorites(r.favorites); setFavoriteTotal(r.total); break;
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
  }, [favoriteSearchQ, pendingOnly]);

  useEffect(() => {
    if (loadState === 'ready') {
      loadTab(tab, offsets[tab]);
    }
  }, [tab, offsets, loadState, loadTab]);

  const openFavoriteDetail = async (id: string) => {
    setFavoriteDetailLoading(true);
    setFavoriteDetailError(null);
    setCopied(false);
    setReviewError(null);
    setReviewSuccess(null);
    try {
      const detail = await getAdminFavoriteDetail(id);
      setFavoriteDetail(detail);
      setReviewDraftStatus(detail.reviewStatus ?? null);
      setReviewDraftNote(detail.reviewNote ?? '');
      setReviewDraftAnnotations(detail.reviewAnnotations ?? []);
      setPendingSelection(null);
      setAnnotationNote('');
    } catch {
      setFavoriteDetailError('收藏详情加载失败，请重试');
    } finally {
      setFavoriteDetailLoading(false);
    }
  };

  const applyReviewToList = (id: string, status: AdminFavoriteReviewStatus | null, note: string | null, updatedAt: string | null) => {
    setFavorites((prev) =>
      prev.map((f) =>
        f.id === id
          ? { ...f, reviewStatus: status, reviewNote: note, reviewUpdatedAt: updatedAt }
          : f,
      ),
    );
  };

  const saveFavoriteReview = async (status: AdminFavoriteReviewStatus | null) => {
    if (!favoriteDetail || reviewSaving) return;
    setReviewSaving(true);
    setReviewError(null);
    setReviewSuccess(null);
    try {
      const note = reviewDraftNote.trim() || null;
      if (status === 'changes_requested' && !note) {
        setReviewError('需修改时请填写修改建议');
        return;
      }
      const result = await putAdminFavoriteReview(favoriteDetail.id, {
        status,
        note: status === null ? null : note,
        annotations: status === null ? [] : reviewDraftAnnotations,
      });
      const next: AdminFavoriteDetail = {
        ...favoriteDetail,
        reviewStatus: result.reviewStatus,
        reviewNote: result.reviewNote,
        reviewUpdatedAt: result.reviewUpdatedAt,
        reviewAnnotations: result.reviewAnnotations,
      };
      setFavoriteDetail(next);
      setReviewDraftStatus(result.reviewStatus);
      setReviewDraftNote(result.reviewNote ?? '');
      setReviewDraftAnnotations(result.reviewAnnotations ?? []);
      applyReviewToList(
        favoriteDetail.id,
        result.reviewStatus,
        result.reviewNote,
        result.reviewUpdatedAt,
      );
      if (status !== null && pendingOnly) {
        setFavorites((prev) => prev.filter((item) => item.id !== favoriteDetail.id));
        setFavoriteTotal((current) => Math.max(0, current - 1));
      }
      void refreshPendingSummary();
      setReviewSuccess(status === null ? '已清除审核' : '审核已保存');
    } catch (err) {
      if (err instanceof Error && err.message === 'NOT_FOUND') {
        setReviewError('收藏不存在或无权审核');
      } else if (err instanceof Error && err.message === 'FORBIDDEN') {
        setReviewError('无管理员权限');
      } else {
        setReviewError('保存失败，请重试');
      }
    } finally {
      setReviewSaving(false);
    }
  };

  const captureAnnotationSelection = () => {
    if (!favoriteDetail || !reviewBodyRef.current) return;
    const start16 = reviewBodyRef.current.selectionStart;
    const end16 = reviewBodyRef.current.selectionEnd;
    if (end16 <= start16) {
      setReviewError('请先在正文框中选中需要批注的文字');
      return;
    }
    const startOffset = utf16OffsetToCodePoint(favoriteDetail.content, start16);
    const endOffset = utf16OffsetToCodePoint(favoriteDetail.content, end16);
    const quotedText = favoriteDetail.content.slice(start16, end16);
    const overlaps = reviewDraftAnnotations.some((item) =>
      startOffset < item.endOffset && endOffset > item.startOffset,
    );
    if (overlaps) {
      setReviewError('所选文字与已有批注重叠，请重新选择');
      return;
    }
    setReviewError(null);
    setPendingSelection({ startOffset, endOffset, quotedText });
    setAnnotationNote('');
  };

  const addDraftAnnotation = () => {
    if (!pendingSelection) return;
    const note = annotationNote.trim();
    if (!note) {
      setReviewError('请填写这段文字的修改建议');
      return;
    }
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `annotation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setReviewDraftAnnotations((prev) => [
      ...prev,
      { id, ...pendingSelection, note },
    ].sort((a, b) => a.startOffset - b.startOffset));
    setPendingSelection(null);
    setAnnotationNote('');
    setReviewSuccess('批注已加入草稿，请保存审核');
  };

  const runFavoriteSearch = () => {
    const next = favoriteSearchInput.trim().slice(0, 80);
    setFavoriteSearchQ(next);
    setOffsets((prev) => ({ ...prev, favorites: 0 }));
    void loadTab('favorites', 0, next);
  };

  const clearFavoriteSearch = () => {
    setFavoriteSearchInput('');
    setFavoriteSearchQ('');
    setOffsets((prev) => ({ ...prev, favorites: 0 }));
    void loadTab('favorites', 0, '');
  };

  const copyFavoriteContent = async () => {
    if (!favoriteDetail) return;
    // Copy body only — never email or review metadata
    await navigator.clipboard.writeText(favoriteDetail.content);
    setCopied(true);
  };

  const lookupCase = async () => {
    const id = caseReviewId.trim();
    if (!id) {
      setCaseError('请输入案例 ID');
      return;
    }
    setCaseLoading(true);
    setCaseError(null);
    setCaseDetail(null);
    setCaseCopied(false);
    try {
      setCaseDetail(await getAdminCaseLibraryDetail(id));
    } catch (err) {
      if (err instanceof Error && err.message === 'FORBIDDEN') {
        setLoadState('forbidden');
      } else if (err instanceof Error && err.message === 'NOT_FOUND') {
        setCaseError('案例不存在或不可用');
      } else {
        setCaseError('案例详情加载失败，请重试');
      }
    } finally {
      setCaseLoading(false);
    }
  };

  const copyCaseBody = async () => {
    if (!caseDetail) return;
    await navigator.clipboard.writeText(caseDetail.body);
    setCaseCopied(true);
  };

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
          {tabs.map((t) => (
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
              {t.key === 'favorites' && pendingSummary.count > 0 && (
                <span
                  data-testid="admin-favorites-pending-badge"
                  className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white"
                >
                  {pendingSummary.count > 99 ? '99+' : pendingSummary.count}
                </span>
              )}
            </button>
          ))}
          {tab !== 'case-review' && (
            <button
              onClick={() => loadTab(tab, currentOffset)}
              disabled={tabLoading}
              className="ml-auto inline-flex items-center gap-1 rounded px-2 py-2 text-[10px] text-gray-500 transition-colors hover:text-gray-300 light:hover:text-gray-700"
              title="刷新当前视图"
            >
              <RefreshCw className={`h-3 w-3 ${tabLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Tab content */}
        {tabError && (
          <div className="mb-3 flex items-center gap-2 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {tabError}
          </div>
        )}

        {tab === 'favorites' && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-gray-700 p-0.5 light:border-gray-300" aria-label="审核队列筛选">
              <button
                type="button"
                onClick={() => { setPendingOnly(false); setOffsets((prev) => ({ ...prev, favorites: 0 })); }}
                className={`rounded px-2.5 py-1 text-xs ${!pendingOnly ? 'bg-gray-700 text-white light:bg-gray-200 light:text-gray-900' : 'text-gray-500'}`}
              >
                全部收藏
              </button>
              <button
                type="button"
                aria-label="只看待审核"
                onClick={() => { setPendingOnly(true); setOffsets((prev) => ({ ...prev, favorites: 0 })); }}
                className={`rounded px-2.5 py-1 text-xs ${pendingOnly ? 'bg-amber-500 text-gray-950' : 'text-gray-500'}`}
              >
                只看待审核（{pendingSummary.count}）
              </button>
            </div>
            <label className="sr-only" htmlFor="admin-favorite-search">
              检索用户收藏
            </label>
            <input
              id="admin-favorite-search"
              type="search"
              value={favoriteSearchInput}
              onChange={(e) => setFavoriteSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runFavoriteSearch();
                }
              }}
              placeholder="品牌 / 产品 / 类型 / 平台 / 备注 / 标签…"
              maxLength={80}
              aria-label="检索用户收藏元数据"
              data-testid="admin-favorite-search"
              className="min-w-[12rem] flex-1 rounded-md border border-gray-700 bg-gray-900/60 px-2.5 py-1.5 text-xs text-gray-200 placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none light:border-gray-300 light:bg-white light:text-gray-800 light:placeholder:text-gray-400 light:focus:border-orange-400"
            />
            <button
              type="button"
              onClick={runFavoriteSearch}
              disabled={tabLoading}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 light:border-orange-400/50 light:bg-orange-50 light:text-orange-700 light:hover:bg-orange-100"
            >
              搜索
            </button>
            <button
              type="button"
              onClick={clearFavoriteSearch}
              disabled={tabLoading && !favoriteSearchQ && !favoriteSearchInput}
              className="rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50 light:border-gray-300 light:text-gray-600 light:hover:text-gray-800"
            >
              清除
            </button>
            {favoriteSearchQ && (
              <span className="text-[10px] text-gray-500">
                筛选：{favoriteSearchQ}
              </span>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          {tab === 'users' && <UsersTable users={users} loading={tabLoading} />}
          {tab === 'generations' && <GenerationsTable jobs={jobs} loading={tabLoading} />}
          {tab === 'feedback' && <FeedbackTable feedback={feedback} loading={tabLoading} />}
          {tab === 'subscriptions' && <SubscriptionsTable subs={subs} loading={tabLoading} />}
          {tab === 'favorites' && (
            <FavoritesTable
              favorites={favorites}
              loading={tabLoading}
              pendingOnly={pendingOnly}
              onView={openFavoriteDetail}
            />
          )}
          {tab === 'audit' && <AuditTable entries={audit} loading={tabLoading} />}
          {tab === 'case-review' && adminRole === 'super_admin' && (
            <CaseReviewPanel
              caseId={caseReviewId}
              onCaseIdChange={setCaseReviewId}
              onLookup={lookupCase}
              loading={caseLoading}
              error={caseError}
              detail={caseDetail}
              copied={caseCopied}
              onCopy={copyCaseBody}
            />
          )}
        </div>

        {/* Pagination */}
        {tab !== 'case-review' && (
          <PaginationControls
            offset={currentOffset}
            total={
              tab === 'users' ? userTotal :
              tab === 'generations' ? jobTotal :
              tab === 'feedback' ? fbTotal :
              tab === 'subscriptions' ? subTotal :
              tab === 'favorites' ? favoriteTotal : auditTotal
            }
            onPrev={() => setOffsets((prev) => ({ ...prev, [tab]: Math.max(0, prev[tab] - PAGE_SIZE) }))}
            onNext={() => setOffsets((prev) => ({ ...prev, [tab]: prev[tab] + PAGE_SIZE }))}
          />
        )}
      </div>

      {reviewToast && (
        <div
          role="status"
          data-testid="admin-page-review-reminder"
          className="fixed bottom-5 right-5 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-amber-500/40 bg-gray-900 p-4 shadow-2xl light:bg-white"
        >
          <div className="flex items-start gap-2.5">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-100 light:text-gray-900">
                {reviewToast.count} 条文案待审核
              </p>
              <p className="mt-1 text-[11px] text-gray-400 light:text-gray-600">
                收到新的用户收藏或送审文案，请进入待审核队列处理。
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReviewToast(null)}
                  className="rounded border border-gray-600 px-2.5 py-1.5 text-[11px] text-gray-300 light:border-gray-300 light:text-gray-700"
                >
                  稍后审核
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReviewToast(null);
                    setTab('favorites');
                    setPendingOnly(true);
                    setOffsets((prev) => ({ ...prev, favorites: 0 }));
                  }}
                  className="rounded bg-amber-500 px-2.5 py-1.5 text-[11px] font-semibold text-gray-950"
                >
                  立刻审核
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReviewToast(null)}
              aria-label="关闭审核提醒"
              className="rounded p-1 text-gray-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {(favoriteDetailLoading || favoriteDetail || favoriteDetailError) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="收藏详情">
          <div
            data-testid="favorite-review-dialog"
            className="flex max-h-[min(90vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl light:border-gray-200 light:bg-white"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-800 px-5 py-4 light:border-gray-200">
              <div>
                <h2 className="text-sm font-semibold">收藏详情</h2>
                <p className="mt-1 text-[11px] text-gray-500">只读访问已记录到审计日志</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFavoriteDetail(null);
                  setFavoriteDetailError(null);
                  setReviewError(null);
                  setReviewSuccess(null);
                }}
                className="rounded p-1 text-gray-500 hover:text-gray-200 light:hover:text-gray-800"
                aria-label="关闭收藏详情"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {favoriteDetailLoading && <p className="py-10 text-center text-xs text-gray-500">加载中...</p>}
            {favoriteDetailError && <p className="py-8 text-center text-xs text-red-400">{favoriteDetailError}</p>}
            {favoriteDetail && !favoriteDetailLoading && (
              <>
                <div
                  data-testid="favorite-review-content-region"
                  className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-3"
                >
                  {/* Compact review summary ABOVE body */}
                  <div
                    data-testid="favorite-review-summary"
                    className="shrink-0 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 light:border-orange-400/50 light:bg-orange-50"
                  >
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400 light:text-orange-600">
                      审阅摘要
                    </p>
                    <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-2">
                      <div className="flex gap-1.5"><dt className="shrink-0 text-gray-500">用户</dt><dd className="min-w-0 truncate">{displayField(favoriteDetail.ownerDisplayName)}</dd></div>
                      <div className="flex gap-1.5"><dt className="shrink-0 text-gray-500">变体</dt><dd className="min-w-0 truncate">{formatAdminPlatform(favoriteDetail.variantKey)}</dd></div>
                      <div className="flex gap-1.5"><dt className="shrink-0 text-gray-500">品牌</dt><dd className="min-w-0 truncate">{displayField(favoriteDetail.brandName)}</dd></div>
                      <div className="flex gap-1.5"><dt className="shrink-0 text-gray-500">产品</dt><dd className="min-w-0 truncate">{displayField(favoriteDetail.productName)}</dd></div>
                      <div className="flex gap-1.5"><dt className="shrink-0 text-gray-500">文案类型</dt><dd className="min-w-0 truncate">{formatAdminCopyType(favoriteDetail.copyType)}</dd></div>
                      <div className="flex gap-1.5"><dt className="shrink-0 text-gray-500">平台</dt><dd className="min-w-0 truncate">{formatAdminPlatform(resolveFavoritePublishPlatform(favoriteDetail))}</dd></div>
                      <div className="flex gap-1.5"><dt className="shrink-0 text-gray-500">评分</dt><dd>{favoriteDetail.rating != null ? `★ ${favoriteDetail.rating}` : '未填写'}</dd></div>
                      <div className="flex gap-1.5"><dt className="shrink-0 text-gray-500">收藏时间</dt><dd className="min-w-0 truncate">{displayField(favoriteDetail.savedAt?.slice(0, 16).replace('T', ' '))}</dd></div>
                      <div className="flex gap-1.5 sm:col-span-2"><dt className="shrink-0 text-gray-500">用户备注</dt><dd className="min-w-0 break-words">{displayField(favoriteDetail.notes)}</dd></div>
                      <div className="flex gap-1.5 sm:col-span-2"><dt className="shrink-0 text-gray-500">收藏原因</dt><dd className="min-w-0 break-words">{displayField(favoriteDetail.favoriteReason)}</dd></div>
                      <div className="flex gap-1.5 sm:col-span-2">
                        <dt className="shrink-0 text-gray-500">标签</dt>
                        <dd className="min-w-0 break-words">{formatAdminReasonTags(favoriteDetail.reasonTags)}</dd>
                      </div>
                    </dl>
                  </div>
                  <textarea
                    data-testid="favorite-review-body"
                    aria-describedby="favorite-review-body-help"
                    ref={reviewBodyRef}
                    readOnly
                    value={favoriteDetail.content}
                    className="h-56 min-h-32 max-h-[55vh] shrink-0 resize-y overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-700/50 bg-gray-950/60 p-4 text-sm leading-7 light:border-gray-200 light:bg-gray-50"
                  />
                  <p id="favorite-review-body-help" className="-mt-2 text-[10px] text-gray-500">
                    可拖动正文框右下角调整高度；选中文字后可添加句子级批注
                  </p>
                  <div className="-mt-1 rounded-lg border border-red-500/25 bg-red-500/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-red-300 light:text-red-700">句子级批注</p>
                      <button
                        type="button"
                        onClick={captureAnnotationSelection}
                        className="inline-flex items-center gap-1 rounded-md border border-red-500/35 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/10 light:text-red-700"
                      >
                        <MessageSquarePlus className="h-3.5 w-3.5" /> 批注选中文字
                      </button>
                    </div>
                    {pendingSelection && (
                      <div className="mt-2 rounded-md border border-red-500/25 p-2">
                        <p className="line-clamp-2 text-[11px] text-red-200 light:text-red-800">“{pendingSelection.quotedText}”</p>
                        <label htmlFor="inline-annotation-note" className="mt-2 block text-[10px] text-gray-500">修改建议</label>
                        <textarea
                          id="inline-annotation-note"
                          value={annotationNote}
                          maxLength={1000}
                          onChange={(event) => setAnnotationNote(event.target.value)}
                          className="mt-1 w-full resize-y rounded border border-gray-700 bg-gray-900 p-2 text-xs light:border-gray-300 light:bg-white"
                        />
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={addDraftAnnotation} className="rounded bg-red-500 px-2 py-1 text-[11px] font-medium text-white">加入批注</button>
                          <button type="button" onClick={() => setPendingSelection(null)} className="rounded border border-gray-600 px-2 py-1 text-[11px] light:border-gray-300">取消</button>
                        </div>
                      </div>
                    )}
                    {reviewDraftAnnotations.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {reviewDraftAnnotations.map((item) => (
                          <li key={item.id} className="flex items-start gap-2 rounded bg-gray-950/50 p-2 text-[11px] light:bg-white">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-red-300 light:text-red-700">“{item.quotedText}”</p>
                              <p className="mt-0.5 whitespace-pre-wrap text-gray-400 light:text-gray-600">{item.note}</p>
                            </div>
                            <button type="button" aria-label="删除句子批注" onClick={() => setReviewDraftAnnotations((prev) => prev.filter((entry) => entry.id !== item.id))} className="shrink-0 rounded p-1 text-gray-500 hover:text-red-400">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-2 text-[10px] text-gray-500">暂无句子批注</p>}
                  </div>
                  {/* R1: admin review editor (after summary/body) */}
                  <div
                    data-testid="favorite-admin-review-editor"
                    className="shrink-0 rounded-lg border border-gray-700/60 bg-gray-950/40 p-3 light:border-gray-200 light:bg-gray-50"
                  >
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      管理员审核
                    </p>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        data-testid="review-status-adopted"
                        disabled={reviewSaving}
                        onClick={() => setReviewDraftStatus('adopted')}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          reviewDraftStatus === 'adopted'
                            ? 'bg-emerald-500 text-gray-950 light:bg-orange-500 light:text-white'
                            : 'border border-gray-600 text-gray-300 hover:border-emerald-500/50 light:border-gray-300 light:text-gray-700'
                        }`}
                      >
                        已采纳
                      </button>
                      <button
                        type="button"
                        data-testid="review-status-changes"
                        disabled={reviewSaving}
                        onClick={() => setReviewDraftStatus('changes_requested')}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          reviewDraftStatus === 'changes_requested'
                            ? 'bg-amber-500 text-gray-950'
                            : 'border border-gray-600 text-gray-300 hover:border-amber-500/50 light:border-gray-300 light:text-gray-700'
                        }`}
                      >
                        需修改
                      </button>
                    </div>
                    <label className="block text-[11px] text-gray-500" htmlFor="admin-review-note">
                      修改建议（最多 2000 字；需修改时必填）
                    </label>
                    <textarea
                      id="admin-review-note"
                      data-testid="review-note-input"
                      value={reviewDraftNote}
                      disabled={reviewSaving}
                      maxLength={2000}
                      rows={3}
                      onChange={(e) => setReviewDraftNote(e.target.value)}
                      className="mt-1 w-full resize-y rounded-md border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-100 outline-none focus:border-emerald-500/60 light:border-gray-300 light:bg-white light:text-gray-900"
                      placeholder="可选填写审核意见…"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        data-testid="review-save-btn"
                        disabled={reviewSaving || reviewDraftStatus == null}
                        onClick={() => void saveFavoriteReview(reviewDraftStatus)}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-gray-950 disabled:opacity-50 light:bg-orange-500 light:text-white"
                      >
                        {reviewSaving ? '保存中…' : '保存审核'}
                      </button>
                      <button
                        type="button"
                        data-testid="review-clear-btn"
                        disabled={reviewSaving}
                        onClick={() => void saveFavoriteReview(null)}
                        className="rounded-lg border border-gray-600 px-3 py-1.5 text-[11px] text-gray-300 disabled:opacity-50 light:border-gray-300 light:text-gray-700"
                      >
                        清除审核
                      </button>
                      {reviewError && (
                        <span data-testid="review-error" role="alert" className="text-[11px] text-red-400">{reviewError}</span>
                      )}
                      {reviewSuccess && (
                        <span data-testid="review-success" className="text-[11px] text-emerald-400">{reviewSuccess}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div
                  data-testid="favorite-review-footer"
                  className="flex shrink-0 justify-end border-t border-gray-800 px-5 py-3 light:border-gray-200"
                >
                  <button
                    type="button"
                    onClick={copyFavoriteContent}
                    aria-label="复制文案"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-gray-950 transition-colors hover:bg-emerald-400 light:bg-orange-500 light:text-white light:hover:bg-orange-600"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? '已复制' : '复制文案'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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

function reviewStatusLabel(
  status: AdminFavoriteMeta['reviewStatus'],
  contentEditedAt?: string | null,
  isPendingReview?: boolean,
): string {
  if (status === 'adopted') return '已采纳';
  if (status === 'changes_requested') return '需修改';
  if (isPendingReview) return '待管理员审核';
  if (contentEditedAt) return '修改后待审核';
  return '未审核';
}

function FavoritesTable({
  favorites,
  loading,
  pendingOnly,
  onView,
}: {
  favorites: AdminFavoriteMeta[];
  loading: boolean;
  pendingOnly: boolean;
  onView: (id: string) => void;
}) {
  if (favorites.length === 0 && !loading) {
    if (pendingOnly) {
      return (
        <div className="py-8 text-center text-xs text-gray-600">
          <p className="font-medium text-gray-500">当前没有待管理员审核的文案</p>
          <p className="mt-2">已通过或需用户修改的文案请在“全部收藏”查看；用户修改并重新提交后会再次进入这里。</p>
        </div>
      );
    }
    return <p className="py-8 text-center text-xs text-gray-600">暂无用户收藏</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-800 text-left text-gray-500 light:border-gray-200">
          <th className="px-4 py-2 font-medium">用户</th>
          <th className="px-4 py-2 font-medium whitespace-normal leading-snug">品牌 / 产品</th>
          <th className="px-4 py-2 font-medium whitespace-normal leading-snug">类型 / 平台</th>
          <th className="px-4 py-2 font-medium">评分</th>
          <th
            data-testid="admin-th-notes-tags"
            className="min-w-[8rem] px-4 py-2 font-medium whitespace-normal leading-snug"
          >
            备注 / 标签
          </th>
          <th className="px-4 py-2 font-medium whitespace-normal leading-snug">审核</th>
          <th className="px-4 py-2 font-medium whitespace-normal leading-snug">收藏时间</th>
          <th className="px-4 py-2 font-medium">操作</th>
        </tr>
      </thead>
      <tbody>
        {favorites.map((favorite) => {
          const noteText = (favorite.notes || favorite.favoriteReason || '').trim();
          const tags = favorite.reasonTags ?? [];
          const rs = favorite.reviewStatus ?? null;
          return (
          <tr
            key={favorite.id}
            data-testid={favorite.isPendingReview ? 'admin-pending-row' : undefined}
            className={`border-b ${favorite.isPendingReview
              ? 'border-amber-500/40 bg-amber-500/5 light:border-amber-300 light:bg-amber-50'
              : 'border-gray-800/50 light:border-gray-100'}`}
          >
            <td className="max-w-[160px] px-4 py-2.5">
              <p className="truncate">{favorite.ownerDisplayName}</p>
              <p className="truncate text-[10px] text-gray-500">{favorite.userEmail}</p>
            </td>
            <td className="max-w-[140px] px-4 py-2.5 text-gray-400">
              <p className="truncate">{displayField(favorite.brandName)}</p>
              <p className="truncate text-[10px] text-gray-500">{displayField(favorite.productName)}</p>
            </td>
            <td className="px-4 py-2.5">
              <div className="flex flex-col gap-0.5">
                <Badge variant="sky" testId="admin-copy-type-chip">
                  {formatAdminCopyType(favorite.copyType)}
                </Badge>
                <Badge variant="green" testId="admin-platform-chip">
                  {formatAdminPlatform(resolveFavoritePublishPlatform(favorite))}
                </Badge>
              </div>
            </td>
            <td className="px-4 py-2.5 text-amber-400">{favorite.rating ? `★ ${favorite.rating}` : '未填写'}</td>
            <td
              data-testid="admin-favorite-notes-tags"
              className="min-w-[10rem] max-w-[16rem] px-4 py-2.5 align-top"
            >
              {noteText ? (
                <div
                  data-testid="admin-favorite-notes"
                  className="break-words rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-[11px] leading-snug text-amber-100/90 light:border-amber-300/70 light:bg-amber-50 light:text-amber-900"
                >
                  {noteText}
                </div>
              ) : (
                <p data-testid="admin-favorite-notes" className="text-[11px] text-gray-500">
                  未填写
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {tags.length === 0 ? (
                  <span className="text-[10px] text-gray-500">未填写</span>
                ) : (
                  tags.map((tag, idx) => (
                    <span
                      key={`${favorite.id}-tag-${idx}`}
                      data-testid="admin-reason-tag-chip"
                      className="inline-flex max-w-full items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300 light:border-orange-200 light:bg-orange-50 light:text-orange-700"
                    >
                      {formatAdminReasonTag(tag)}
                    </span>
                  ))
                )}
              </div>
            </td>
            <td className="px-4 py-2.5">
              <span
                data-testid="admin-review-status-chip"
                className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  rs === 'adopted'
                    ? 'bg-emerald-500/15 text-emerald-300 light:bg-emerald-50 light:text-emerald-700'
                    : rs === 'changes_requested'
                      ? 'bg-amber-500/15 text-amber-300 light:bg-amber-50 light:text-amber-800'
                      : 'bg-gray-700/40 text-gray-400 light:bg-gray-100 light:text-gray-600'
                }`}
              >
                {reviewStatusLabel(rs, favorite.contentEditedAt, favorite.isPendingReview)}
              </span>
            </td>
            <td className="px-4 py-2.5 text-gray-500">{favorite.savedAt?.slice(0, 10) || '未填写'}</td>
            <td className="px-4 py-2.5">
              <button
                type="button"
                onClick={() => onView(favorite.id)}
                aria-label="查看收藏详情"
                className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 light:text-orange-600 light:hover:text-orange-700"
              >
                <Eye className="h-3.5 w-3.5" /> 查看
              </button>
            </td>
          </tr>
          );
        })}
        {favorites.length === 0 && <EmptyRow colSpan={8} loading={loading} />}
      </tbody>
    </table>
  );
}

function CaseReviewPanel({
  caseId,
  onCaseIdChange,
  onLookup,
  loading,
  error,
  detail,
  copied,
  onCopy,
}: {
  caseId: string;
  onCaseIdChange: (v: string) => void;
  onLookup: () => void;
  loading: boolean;
  error: string | null;
  detail: AdminCaseLibraryDetail | null;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <p className="text-xs text-gray-500">
        超级管理员只读：按案例 ID 查询单条正文。每次查看写入审计日志；无跨用户列表、无批量导出。
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-xs">
          <span className="text-gray-500">案例 ID</span>
          <input
            data-testid="case-review-id-input"
            value={caseId}
            onChange={(e) => onCaseIdChange(e.target.value)}
            placeholder="粘贴 UUID"
            className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm light:border-gray-300 light:bg-white"
          />
        </label>
        <button
          type="button"
          onClick={onLookup}
          disabled={loading}
          aria-label="查询案例"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-gray-950 hover:bg-emerald-400 disabled:opacity-50 light:bg-orange-500 light:text-white light:hover:bg-orange-600"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          查询
        </button>
      </div>
      {error && (
        <div className="rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">{error}</div>
      )}
      {detail && (
        <div className="space-y-4">
          <div
            data-testid="case-review-summary"
            className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/5 p-4 light:border-orange-400/50 light:bg-orange-50"
          >
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-400 light:text-orange-600">
              审阅摘要
            </p>
            <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              <div><dt className="text-gray-500">标题</dt><dd>{detail.title?.trim() ? detail.title : '未命名案例'}</dd></div>
              <div><dt className="text-gray-500">类型</dt><dd>{displayField(detail.caseType)}</dd></div>
              <div><dt className="text-gray-500">所有者</dt><dd>{displayField(detail.ownerDisplayName)}</dd></div>
              <div><dt className="text-gray-500">标签</dt><dd>{detail.tags?.length ? detail.tags.join(' · ') : '未填写'}</dd></div>
              <div className="sm:col-span-2"><dt className="text-gray-500">原因</dt><dd>{displayField(detail.reason)}</dd></div>
              <div><dt className="text-gray-500">创建时间</dt><dd>{displayField(detail.createdAt?.slice(0, 16).replace('T', ' '))}</dd></div>
              <div><dt className="text-gray-500">更新时间</dt><dd>{displayField(detail.updatedAt?.slice(0, 16).replace('T', ' '))}</dd></div>
            </dl>
          </div>
          <div
            data-testid="case-review-body"
            className="max-h-[45vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-gray-700/50 bg-gray-950/60 p-4 text-sm leading-7 light:border-gray-200 light:bg-gray-50"
          >
            {detail.body}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onCopy}
              aria-label="复制案例正文"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-gray-950 hover:bg-emerald-400 light:bg-orange-500 light:text-white light:hover:bg-orange-600"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '已复制' : '复制正文'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
