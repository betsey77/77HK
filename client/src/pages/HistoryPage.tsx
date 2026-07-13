import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { listGenerationJobs, deleteGenerationJob } from '../services/api';
import type { GenerationJobSummary } from '../types';

// ============================================================
// HistoryPage — list user's generation jobs
// ============================================================

type PageState = 'loading' | 'empty' | 'error' | 'ready';

export default function HistoryPage() {
  const { state: authState } = useAuth();
  const { isDark } = useTheme();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<GenerationJobSummary[]>([]);

  const fetchJobs = useCallback(async () => {
    setPageState('loading');
    setError(null);
    try {
      const result = await listGenerationJobs({ limit: 50 });
      setJobs(result.jobs);
      setPageState(result.jobs.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      setPageState('error');
    }
  }, []);

  useEffect(() => {
    if (authState.isAuthenticated) {
      fetchJobs();
    }
  }, [authState.isAuthenticated, fetchJobs]);

  const handleDelete = async (id: string) => {
    try {
      await deleteGenerationJob(id);
      setJobs(prev => prev.filter(j => j.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

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
        </div>

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
            <p className={`text-sm ${subtextClass}`}>暂无生成记录</p>
            <a
              href="/app"
              className={`mt-4 inline-block text-sm font-semibold transition-colors ${
                isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-orange-600 hover:text-orange-700'
              }`}
            >
              → 去生成第一条文案
            </a>
          </div>
        )}

        {/* Job list */}
        {pageState === 'ready' && (
          <ul className="space-y-3">
            {jobs.map(job => (
              <li
                key={job.id}
                className={`rounded-lg p-4 ${cardBg} cursor-pointer transition-colors ${
                  isDark ? 'hover:bg-white/[0.06]' : 'hover:bg-gray-50'
                }`}
              >
                <a
                  href={`/app/history/${job.id}`}
                  className="block"
                  onClick={(e) => {
                    // Let the link navigate; stop delete button propagation
                  }}
                >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
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
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(job.id);
                    }}
                    className={`shrink-0 text-xs transition-colors ${
                      isDark
                        ? 'text-gray-600 hover:text-red-400'
                        : 'text-gray-400 hover:text-red-500'
                    }`}
                    title="删除"
                  >
                    删除
                  </button>
                </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
