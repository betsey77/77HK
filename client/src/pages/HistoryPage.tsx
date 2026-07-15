import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { ArrowLeft, Info, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { listGenerationJobs, deleteGenerationJob } from '../services/api';
import type { GenerationJobSummary } from '../types';
import { HISTORY_RECOVERY_NOTE } from '../services/workbenchSnapshot';
import ConfirmDialog from '../components/shared/ConfirmDialog';

// ============================================================
// HistoryPage — list user's generation jobs
// ============================================================

type PageState = 'loading' | 'empty' | 'error' | 'ready';

const HISTORY_PAGE_SIZE = 10;

export default function HistoryPage() {
  const { state: authState } = useAuth();
  const { isDark } = useTheme();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<GenerationJobSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [lockedCount, setLockedCount] = useState(0);
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setPageState('loading');
    setError(null);
    try {
      const result = await listGenerationJobs({
        limit: HISTORY_PAGE_SIZE,
        offset: (page - 1) * HISTORY_PAGE_SIZE,
        ...(appliedQuery ? { query: appliedQuery } : {}),
      });
      setJobs(result.jobs);
      setTotal(result.total);
      setLockedCount(result.lockedCount ?? 0);
      setPageState(result.jobs.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      setPageState('error');
    }
  }, [appliedQuery, page]);

  useEffect(() => {
    if (authState.isAuthenticated) {
      fetchJobs();
    }
  }, [authState.isAuthenticated, fetchJobs]);

  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const currentPageIds = jobs.map(job => job.id);
  const allCurrentSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id));

  function toggleSelection(id: string) {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCurrentPage() {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (allCurrentSelected) currentPageIds.forEach(id => next.delete(id));
      else currentPageIds.forEach(id => next.add(id));
      return next;
    });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function requestDelete(ids: string[]) {
    if (ids.length > 0) setPendingDeleteIds(ids);
  }

  async function confirmDelete() {
    if (pendingDeleteIds.length === 0 || isDeleting) return;
    setIsDeleting(true);
    setActionError(null);
    const results = await Promise.allSettled(pendingDeleteIds.map(id => deleteGenerationJob(id)));
    const successfulIds = pendingDeleteIds.filter((_, index) => results[index]?.status === 'fulfilled');
    const failedIds = pendingDeleteIds.filter((_, index) => results[index]?.status === 'rejected');
    const successfulSet = new Set(successfulIds);
    const remainingJobs = jobs.filter(job => !successfulSet.has(job.id));

    setJobs(remainingJobs);
    setTotal(current => Math.max(0, current - successfulIds.length));
    setSelectedIds(new Set(failedIds));
    setPendingDeleteIds([]);
    setIsDeleting(false);

    if (failedIds.length > 0) {
      setActionError(`已删除 ${successfulIds.length} 条，${failedIds.length} 条删除失败，请重试。`);
    } else if (remainingJobs.length === 0 && total - successfulIds.length === 0) {
      setPageState('empty');
      exitSelectionMode();
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedQuery(queryInput.trim());
    exitSelectionMode();
  }

  const statusLabel: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
  };

  const statusClass = (status: string) => {
    if (isDark) {
      return status === 'completed' ? 'text-emerald-400' :
             status === 'failed' ? 'text-red-400' :
             status === 'processing' ? 'text-amber-400' :
             'text-gray-400';
    }
    return status === 'completed' ? 'text-green-600' :
           status === 'failed' ? 'text-red-600' :
           status === 'processing' ? 'text-amber-600' :
           'text-gray-500';
  };

  const cardBg = isDark
    ? 'bg-white/[0.03] ring-1 ring-white/10'
    : 'bg-white ring-1 ring-gray-200';

  const headingClass = isDark ? 'text-white' : 'text-gray-900';
  const subtextClass = isDark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className={`h-full overflow-y-auto ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <a
            href="/app"
            aria-label="回到工作台"
            className={`mb-4 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isDark
                ? 'border-white/10 text-gray-400 hover:border-emerald-500/40 hover:text-emerald-400'
                : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:text-orange-600'
            }`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            回到工作台
          </a>
          <h1 className={`text-xl font-semibold ${headingClass}`}>生成历史</h1>
          <p className={`mt-1 text-sm ${subtextClass}`}>
            查看和管理你的生成记录
          </p>
          <div
            role="note"
            aria-label="历史恢复提示"
            className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${
              isDark
                ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-gray-300'
                : 'border-orange-200 bg-orange-50 text-gray-700'
            }`}
          >
            <Info className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isDark ? 'text-emerald-400' : 'text-orange-600'}`} />
            <span>{HISTORY_RECOVERY_NOTE}</span>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mb-4 flex items-center gap-2">
          <label className={`flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-2 ${
            isDark ? 'border-white/10 bg-white/[0.03]' : 'border-gray-200 bg-white'
          }`}>
            <Search className="h-3.5 w-3.5 shrink-0 text-gray-500" />
            <input
              type="search"
              role="searchbox"
              aria-label="搜索生成历史"
              value={queryInput}
              onChange={event => setQueryInput(event.target.value)}
              placeholder="搜索品牌、产品或正文"
              className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${
                isDark ? 'text-gray-200 placeholder:text-gray-600' : 'text-gray-800 placeholder:text-gray-400'
              }`}
            />
          </label>
          <button
            type="submit"
            aria-label="搜索"
            className={`rounded-md px-3 py-2 text-xs font-medium text-white ${
              isDark ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-orange-600 hover:bg-orange-500'
            }`}
          >
            搜索
          </button>
          {appliedQuery && (
            <button
              type="button"
              onClick={() => {
                setQueryInput('');
                setAppliedQuery('');
                setPage(1);
              }}
              className={`rounded-md px-2 py-2 text-xs ${subtextClass}`}
            >
              清空
            </button>
          )}
        </form>

        {lockedCount > 0 && (
          <div className={`mb-4 rounded-lg border px-3 py-2 text-xs leading-5 ${
            isDark
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              : 'border-orange-200 bg-orange-50 text-orange-700'
          }`}>
            <p>另有 {lockedCount} 条较早历史需 Pro 解锁</p>
            <a href="/app/billing" className="font-semibold underline underline-offset-2">
              解锁全部历史
            </a>
          </div>
        )}

        {pageState === 'ready' && (
          <div className="mb-4 flex items-center gap-2">
            {selectionMode ? (
              <>
                <label className={`flex items-center gap-1.5 text-xs ${subtextClass}`}>
                  <input
                    type="checkbox"
                    aria-label="全选当前历史"
                    checked={allCurrentSelected}
                    onChange={toggleCurrentPage}
                    className="h-3.5 w-3.5 accent-emerald-500 light:accent-orange-500"
                  />
                  全选当前页
                </label>
                <span className={`text-xs ${subtextClass}`}>已选 {selectedIds.size} / {total}</span>
                <button
                  type="button"
                  disabled={selectedIds.size === 0}
                  onClick={() => requestDelete([...selectedIds])}
                  className="ml-auto rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  删除所选
                </button>
                <button type="button" onClick={exitSelectionMode} className={`px-2 py-1.5 text-xs ${subtextClass}`}>
                  完成
                </button>
              </>
            ) : (
              <button
                type="button"
                aria-label="批量管理"
                onClick={() => setSelectionMode(true)}
                className={`ml-auto rounded-md border px-2.5 py-1.5 text-xs ${
                  isDark ? 'border-white/10 text-gray-400 hover:text-white' : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900'
                }`}
              >
                批量管理
              </button>
            )}
          </div>
        )}

        {actionError && (
          <div className={`mb-4 rounded-md border px-3 py-2 text-xs ${
            isDark ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-red-200 bg-red-50 text-red-700'
          }`}>
            {actionError}
          </div>
        )}

        {/* Loading */}
        {pageState === 'loading' && (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className={`h-8 w-8 animate-spin rounded-full border-2 ${
                isDark ? 'border-gray-700 border-t-emerald-400' : 'border-gray-300 border-t-orange-500'
              }`} />
              <p className={`text-sm ${subtextClass}`}>加载中…</p>
            </div>
          </div>
        )}

        {/* Error */}
        {pageState === 'error' && (
          <div className={`rounded-lg border px-4 py-3 ${
            isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-300 bg-red-50'
          }`}>
            <p className={`text-sm font-medium ${isDark ? 'text-red-400' : 'text-red-700'}`}>
              加载失败
            </p>
            <p className={`mt-1 text-xs ${subtextClass}`}>{error}</p>
            <button
              onClick={fetchJobs}
              className={`mt-3 text-sm font-semibold transition-colors ${
                isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-orange-600 hover:text-orange-700'
              }`}
            >
              重试
            </button>
          </div>
        )}

        {/* Empty */}
        {pageState === 'empty' && (
          <div className="text-center py-16">
            <p className={`text-sm ${subtextClass}`}>
              {appliedQuery ? '没有匹配的生成记录' : '暂无生成记录'}
            </p>
            {appliedQuery ? (
              <button
                type="button"
                onClick={() => {
                  setQueryInput('');
                  setAppliedQuery('');
                  setPage(1);
                }}
                className={`mt-4 text-sm font-semibold ${isDark ? 'text-emerald-400' : 'text-orange-600'}`}
              >
                清空搜索
              </button>
            ) : (
              <a
                href="/app"
                className={`mt-4 inline-block text-sm font-semibold transition-colors ${
                  isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-orange-600 hover:text-orange-700'
                }`}
              >
                → 去生成第一条文案
              </a>
            )}
          </div>
        )}

        {/* Job list */}
        {pageState === 'ready' && (
          <ul className="space-y-3">
            {jobs.map(job => (
              <li
                key={job.id}
                className={`rounded-lg ${cardBg} transition-colors ${
                  isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3 p-4">
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(job.id)}
                      onChange={() => toggleSelection(job.id)}
                      aria-label={`选择历史：${job.source}`}
                      className="mt-1 h-3.5 w-3.5 shrink-0 accent-emerald-500 light:accent-orange-500"
                    />
                  )}
                  <a href={`/app/history/${job.id}`} className="min-w-0 flex-1">
                    {(job.brandName || job.productName) && (
                      <p className="mb-1 truncate text-[11px] font-medium text-red-400 light:text-red-600">
                        {[job.brandName, job.productName].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <p className={`text-sm leading-relaxed line-clamp-2 break-words ${headingClass}`}>
                      {job.source}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <span className={statusClass(job.status)}>
                        {statusLabel[job.status] ?? job.status}
                      </span>
                      <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                        {job.platform}
                      </span>
                      <span className={isDark ? 'text-gray-500' : 'text-gray-400'}>
                        {job.tone}
                      </span>
                    </div>
                    <p className={`mt-1 text-xs ${subtextClass}`}>
                      {new Date(job.createdAt).toLocaleString('zh-CN', {
                        month: 'numeric', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </a>
                  {!selectionMode && (
                    <button
                      type="button"
                      onClick={() => requestDelete([job.id])}
                      className={`shrink-0 rounded p-1.5 text-xs transition-colors ${
                        isDark
                          ? 'text-gray-600 hover:bg-red-500/10 hover:text-red-400'
                          : 'text-gray-400 hover:bg-red-50 hover:text-red-500'
                      }`}
                      title="删除"
                      aria-label="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="sr-only">删除</span>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {pageState === 'ready' && total > HISTORY_PAGE_SIZE && (
          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              aria-label="上一页"
              disabled={page === 1}
              onClick={() => {
                setPage(current => Math.max(1, current - 1));
              }}
              className={`rounded-md border px-3 py-1.5 text-xs disabled:opacity-30 ${
                isDark ? 'border-white/10 text-gray-400' : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              上一页
            </button>
            <span className={`text-xs ${subtextClass}`}>第 {page} / {pageCount} 页</span>
            <button
              type="button"
              aria-label="下一页"
              disabled={page === pageCount}
              onClick={() => {
                setPage(current => Math.min(pageCount, current + 1));
              }}
              className={`rounded-md border px-3 py-1.5 text-xs disabled:opacity-30 ${
                isDark ? 'border-white/10 text-gray-400' : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              下一页
            </button>
          </div>
        )}

        <ConfirmDialog
          open={pendingDeleteIds.length > 0}
          title={pendingDeleteIds.length === 1 ? '确认删除这条历史记录？' : '确认批量删除历史？'}
          message={pendingDeleteIds.length === 1
            ? '删除后无法从历史记录恢复，此操作不可撤销。'
            : `即将删除 ${pendingDeleteIds.length} 条历史记录，此操作不可撤销。`}
          confirmLabel={pendingDeleteIds.length === 1 ? '确认删除' : `确认删除 ${pendingDeleteIds.length} 条`}
          confirming={isDeleting}
          confirmingLabel="删除中…"
          danger
          onConfirm={confirmDelete}
          onCancel={() => {
            if (!isDeleting) setPendingDeleteIds([]);
          }}
        />
      </div>
    </div>
  );
}
