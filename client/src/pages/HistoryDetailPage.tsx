import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getGenerationJob, deleteGenerationJob } from '../services/api';
import type { GenerationJob } from '../types';
import { HISTORY_RECOVERY_NOTE, buildWorkbenchSnapshotFromHistory, getHistoryJobLoadability, saveWorkbenchSnapshotFromHistory } from '../services/workbenchSnapshot';
import { ArrowLeft, Info, Trash2, Upload } from 'lucide-react';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { SHORTS_TK_LABEL } from '../constants';

// ============================================================
// HistoryDetailPage — view a single generation job in detail
// ============================================================

type PageState = 'loading' | 'error' | 'ready' | 'deleted';

export default function HistoryDetailPage() {
  const { state: authState } = useAuth();
  const { isDark } = useTheme();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Extract job ID from path: /app/history/:id
  const jobId = window.location.pathname.split('/').pop() ?? '';

  const fetchJob = useCallback(async () => {
    setPageState('loading');
    setError(null);
    try {
      const result = await getGenerationJob(jobId);
      setJob(result.job);
      setPageState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      setPageState('error');
    }
  }, [jobId]);

  useEffect(() => {
    if (authState.isAuthenticated && jobId) {
      fetchJob();
    }
  }, [authState.isAuthenticated, jobId, fetchJob]);

  const handleDeleteConfirm = async () => {
    if (!job) return;
    setIsDeleting(true);
    try {
      await deleteGenerationJob(job.id);
      setShowDeleteConfirm(false);
      setPageState('deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Load into workbench (Slice H1-R) ────────────────────────

  function handleLoadToWorkbench() {
    if (!job) return;
    const { snapshot } = buildWorkbenchSnapshotFromHistory(job);
    if (!snapshot) return;

    const ownerId = authState.user?.id ?? 'anonymous';
    saveWorkbenchSnapshotFromHistory(ownerId, snapshot);

    // Navigate to workbench
    window.location.href = '/app';
  }

  const loadability = job ? getHistoryJobLoadability(job) : { loadable: false };

  const statusLabel: Record<string, string> = {
    pending: '待处理',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
  };

  // ---- Theme tokens ----
  const headingClass = isDark ? 'text-white' : 'text-gray-900';
  const subtextClass = isDark ? 'text-gray-400' : 'text-gray-500';
  const mutedClass = isDark ? 'text-gray-500' : 'text-gray-400';
  const borderClass = isDark ? 'border-gray-800' : 'border-gray-200';
  const cardBg = isDark ? 'bg-white/[0.03] ring-1 ring-white/10' : 'bg-white ring-1 ring-gray-200';
  const accentLink = isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-orange-600 hover:text-orange-700';
  const codeBg = isDark ? 'bg-gray-900' : 'bg-gray-50';
  const codeText = isDark ? 'text-gray-300' : 'text-gray-700';
  const errorBg = isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-300 bg-red-50';
  const errorText = isDark ? 'text-red-400' : 'text-red-700';
  const successBadge = isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-green-100 text-green-700';
  const failBadge = isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700';
  const processBadge = isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700';
  const pendingBadge = isDark ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-600';

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed': return successBadge;
      case 'failed': return failBadge;
      case 'processing': return processBadge;
      default: return pendingBadge;
    }
  };

  // ---- Loading ----
  if (pageState === 'loading') {
    return (
      <div className={`h-full overflow-y-auto ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className={`h-8 w-8 animate-spin rounded-full border-2 ${
                isDark ? 'border-gray-700 border-t-emerald-400' : 'border-gray-300 border-t-orange-500'
              }`} />
              <p className={`text-sm ${subtextClass}`}>加载中…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- Error ----
  if (pageState === 'error') {
    return (
      <div className={`h-full overflow-y-auto ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <a href="/app/history" className={`inline-flex items-center gap-1.5 text-sm mb-6 ${accentLink}`}>
            <ArrowLeft className="h-4 w-4" /> 返回历史列表
          </a>
          <div className={`rounded-lg border px-4 py-3 ${errorBg}`}>
            <p className={`text-sm font-medium ${errorText}`}>加载失败</p>
            <p className={`mt-1 text-xs ${subtextClass}`}>{error}</p>
            <button onClick={fetchJob} className={`mt-3 text-sm font-semibold ${accentLink}`}>重试</button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Deleted ----
  if (pageState === 'deleted') {
    return (
      <div className={`h-full overflow-y-auto ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <p className={`text-sm ${subtextClass}`}>已删除</p>
          <a href="/app/history" className={`mt-4 inline-block text-sm font-semibold ${accentLink}`}>
            ← 返回历史列表
          </a>
        </div>
      </div>
    );
  }

  if (!job) return null;

  // ---- Ready ----
  return (
    <div className={`h-full overflow-y-auto ${isDark ? 'bg-gray-950' : 'bg-gray-50'}`}>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <ConfirmDialog
          open={showDeleteConfirm}
          title="确认删除这条历史记录？"
          message="删除后无法从历史记录恢复，此操作不可撤销。"
          confirmLabel="确认删除"
          confirming={isDeleting}
          confirmingLabel="删除中…"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            if (!isDeleting) setShowDeleteConfirm(false);
          }}
        />
        {/* Back link */}
        <a href="/app/history" className={`inline-flex items-center gap-1.5 text-sm mb-6 ${accentLink}`}>
          <ArrowLeft className="h-4 w-4" /> 返回历史列表
        </a>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0 flex-1">
            <h1 className={`text-lg font-semibold leading-relaxed break-words ${headingClass}`}>
              {job.source}
            </h1>
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(job.status)}`}>
                {statusLabel[job.status] ?? job.status}
              </span>
              <span className={mutedClass}>{job.platform}</span>
              <span className={mutedClass}>{job.tone}</span>
              {job.generationEngine && (
                <span className={mutedClass}>{job.generationEngine}</span>
              )}
            </div>
            <p className={`mt-1 text-xs ${subtextClass}`}>
              {new Date(job.createdAt).toLocaleString('zh-CN', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
              {job.completedAt && ` · 完成于 ${new Date(job.completedAt).toLocaleString('zh-CN', {
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}`}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            {/* Load to workbench button */}
            {loadability.loadable && (
              <button
                onClick={handleLoadToWorkbench}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  isDark
                    ? 'bg-emerald-600/80 hover:bg-emerald-500 text-white'
                    : 'bg-orange-600/90 hover:bg-orange-500 text-white'
                }`}
                title="将此结果载入工作台继续编辑"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>载入工作台</span>
              </button>
            )}
            {!loadability.loadable && loadability.reason && (
              <span className={`text-[10px] italic ${mutedClass}`} title={loadability.reason}>
                {loadability.reason}
              </span>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className={`shrink-0 flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
                isDark ? 'text-gray-600 hover:text-red-400 hover:bg-red-500/10' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
              }`}
              title="删除此记录"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>删除</span>
            </button>
          </div>
        </div>

        <div
          role="note"
          aria-label="历史恢复提示"
          className={`mb-6 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${
            isDark
              ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-gray-300'
              : 'border-orange-200 bg-orange-50 text-gray-700'
          }`}
        >
          <Info className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${isDark ? 'text-emerald-400' : 'text-orange-600'}`} />
          <span>{HISTORY_RECOVERY_NOTE}</span>
        </div>

        {/* Error (failed jobs) */}
        {job.status === 'failed' && job.errorMessage && (
          <div className={`rounded-lg border px-4 py-3 mb-6 ${errorBg}`}>
            <p className={`text-sm font-medium ${errorText}`}>生成失败</p>
            <p className={`mt-1 text-xs ${subtextClass}`}>{job.errorMessage}</p>
            {job.errorCode && <p className={`mt-0.5 text-xs ${mutedClass}`}>错误码: {job.errorCode}</p>}
          </div>
        )}

        {/* Original brief */}
        {job.brief && (
          <section className="mb-6">
            <h2 className={`text-sm font-semibold mb-2 ${headingClass}`}>原始写作简报</h2>
            <pre className={`rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap break-words ${codeBg} ${codeText}`}>
              {JSON.stringify(job.brief, null, 2)}
            </pre>
          </section>
        )}

        {/* Variants */}
        {job.variants && (
          <section className="mb-6">
            <h2 className={`text-sm font-semibold mb-3 ${headingClass}`}>生成文案</h2>
            <div className="space-y-3">
              {Object.entries(job.variants).map(([key, text]) => (
                <div key={key} className={`rounded-lg p-4 ${cardBg}`}>
                  <p className={`text-xs font-medium mb-1.5 ${mutedClass}`}>
                    {key === 'standardHK' ? '标准港式' :
                     key === 'lightCantonese' ? '轻粤语' :
                     key === 'ig' ? 'Instagram' :
                     key === 'facebook' ? 'Facebook' :
                     key === 'shorts' ? SHORTS_TK_LABEL : key}
                  </p>
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${headingClass}`}>
                    {text as string}
                  </p>
                </div>
              ))}
            </div>
            {job.variantMeta && (
              <details className="mt-3">
                <summary className={`text-xs cursor-pointer ${accentLink}`}>查看 Variant Meta</summary>
                <pre className={`mt-2 rounded-lg p-3 text-xs overflow-x-auto ${codeBg} ${codeText}`}>
                  {JSON.stringify(job.variantMeta, null, 2)}
                </pre>
              </details>
            )}
          </section>
        )}

        {/* Diagnosis */}
        {job.diagnosis && (
          <section className="mb-6">
            <h2 className={`text-sm font-semibold mb-2 ${headingClass}`}>诊断</h2>
            <div className={`rounded-lg p-4 ${cardBg}`}>
              {job.diagnosis.hasSimplifiedChars && (
                <p className={`text-xs ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                  ⚠️ 检测到简体字
                </p>
              )}
              {job.diagnosis.mainlandPhrases && (job.diagnosis.mainlandPhrases as unknown[]).length > 0 && (
                <div className="mt-2">
                  <p className={`text-xs font-medium ${mutedClass}`}>内地用语:</p>
                  <ul className="mt-1 space-y-1">
                    {(job.diagnosis.mainlandPhrases as Array<{ phrase: string; suggestion: string }>).map((mp, i) => (
                      <li key={i} className={`text-xs ${subtextClass}`}>
                        「{mp.phrase}」→ {mp.suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {job.diagnosis.issues && job.diagnosis.issues.length > 0 && (
                <div className="mt-2">
                  <p className={`text-xs font-medium ${mutedClass}`}>问题:</p>
                  <ul className="mt-1 space-y-1">
                    {job.diagnosis.issues.map((issue, i) => (
                      <li key={i} className={`text-xs ${subtextClass}`}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!job.diagnosis.hasSimplifiedChars &&
                (!job.diagnosis.mainlandPhrases || !(job.diagnosis.mainlandPhrases as unknown[]).length) &&
                (!job.diagnosis.issues || !job.diagnosis.issues.length) && (
                <p className={`text-xs ${subtextClass}`}>无诊断问题</p>
              )}
            </div>
          </section>
        )}

        {/* Audit */}
        {job.audit && (
          <section className="mb-6">
            <h2 className={`text-sm font-semibold mb-2 ${headingClass}`}>审核</h2>
            <div className={`rounded-lg p-4 ${cardBg}`}>
              {/* Thermometer */}
              {job.audit.thermometer && (
                <div className="mb-3">
                  <p className={`text-xs font-medium ${mutedClass}`}>
                    综合评分: <span className={isDark ? 'text-emerald-400' : 'text-orange-600'}>{job.audit.thermometer.overall}</span>
                  </p>
                </div>
              )}
              {/* Issues */}
              {job.audit.issues && job.audit.issues.length > 0 && (
                <div className="mb-3">
                  <p className={`text-xs font-medium ${mutedClass}`}>问题 ({job.audit.issues.length}):</p>
                  <ul className="mt-1 space-y-1">
                    {job.audit.issues.map((issue, i) => (
                      <li key={i} className={`text-xs ${subtextClass}`}>
                        <span className={
                          issue.severity === 'high' ? (isDark ? 'text-red-400' : 'text-red-600') :
                          issue.severity === 'medium' ? (isDark ? 'text-amber-400' : 'text-amber-600') :
                          mutedClass
                        }>
                          [{issue.severity}] {issue.tag}
                        </span>
                        : {issue.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(!job.audit.issues || job.audit.issues.length === 0) && (
                <p className={`text-xs ${subtextClass}`}>无审核问题</p>
              )}
            </div>
          </section>
        )}

        {/* Scores */}
        {job.scores && (
          <section className="mb-6">
            <h2 className={`text-sm font-semibold mb-2 ${headingClass}`}>评分</h2>
            <div className={`rounded-lg p-4 ${cardBg}`}>
              {job.scores.generated && (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(job.scores.generated).map(([key, val]) => (
                    <div key={key} className="flex justify-between">
                      <span className={`text-xs ${mutedClass}`}>{key}</span>
                      <span className={`text-xs font-mono ${headingClass}`}>{val as number}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Consumer Feedback */}
        {job.consumerFeedback && job.consumerFeedback.length > 0 && (
          <section className="mb-6">
            <h2 className={`text-sm font-semibold mb-3 ${headingClass}`}>消费者反馈</h2>
            <div className="space-y-3">
              {job.consumerFeedback.map((cf, i) => (
                <div key={i} className={`rounded-lg p-4 ${cardBg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium ${headingClass}`}>{cf.personaName}</span>
                    <span className={`text-xs ${mutedClass}`}>评分: {'★'.repeat(cf.rating)}{'☆'.repeat(5 - cf.rating)}</span>
                  </div>
                  <p className={`text-xs ${subtextClass}`}>{cf.feedback}</p>
                  {cf.suggestions && cf.suggestions.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {cf.suggestions.map((s, j) => (
                        <div key={j} className={`text-xs pl-2 border-l-2 ${borderClass}`}>
                          <span className={isDark ? 'text-emerald-400' : 'text-orange-600'}>{s.aspect}</span>
                          : {s.suggestion}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Raw JSON (collapsible) */}
        <details className="mb-8">
          <summary className={`text-xs cursor-pointer ${mutedClass} hover:${accentLink}`}>
            查看原始 JSON
          </summary>
          <pre className={`mt-2 rounded-lg p-3 text-xs overflow-x-auto max-h-96 ${codeBg} ${codeText}`}>
            {JSON.stringify(job, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}
