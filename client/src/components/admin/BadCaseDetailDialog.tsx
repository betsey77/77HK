import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, Loader2, X } from 'lucide-react';
import { getAdminBadCaseDetail, type AdminBadCaseDetail } from '../../services/adminMetricsApi';

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  return (
    <details className="rounded-lg border border-gray-700/50 p-3 light:border-gray-200">
      <summary className="cursor-pointer text-xs font-semibold">{title}</summary>
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-gray-400 light:text-gray-600">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export default function BadCaseDetailDialog({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<AdminBadCaseDetail | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setDetail(null);
    setError(false);
    void getAdminBadCaseDetail(jobId).then(
      (value) => { if (active) setDetail(value); },
      () => { if (active) setError(true); },
    );
    return () => { active = false; };
  }, [jobId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(jobId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="低分任务详情"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-950 text-gray-100 shadow-2xl light:border-gray-200 light:bg-white light:text-gray-900"
      >
        <header className="flex items-start justify-between gap-3 border-b border-gray-800 px-4 py-3 light:border-gray-200">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">低分任务详情</h2>
            <div className="mt-1 flex min-w-0 items-center gap-2">
              <code className="break-all text-[10px] text-gray-500">{jobId}</code>
              <button type="button" onClick={() => { void copyId(); }} className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-200 light:hover:bg-gray-100" aria-label="复制完整任务 ID">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-200 light:hover:bg-gray-100" aria-label="关闭低分任务详情">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="overflow-y-auto p-4">
          {!detail && !error && (
            <div className="flex items-center justify-center gap-2 py-16 text-xs text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> 加载任务详情…</div>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-3 text-xs text-red-400"><AlertTriangle className="h-4 w-4" /> 任务详情加载失败，请关闭后重试</div>
          )}
          {detail && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-gray-800 px-2 py-1 light:bg-gray-100">{detail.job.status}</span>
                <span>{detail.job.platform} · {detail.job.tone}</span>
                <span className="text-gray-500">{detail.job.generation_engine ?? '未记录引擎'}</span>
                <span className="text-gray-500">{new Date(detail.job.created_at).toLocaleString('zh-HK')}</span>
              </div>

              {detail.job.error_message && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
                  {detail.job.error_message}{detail.job.error_code ? ` · ${detail.job.error_code}` : ''}
                </div>
              )}

              <section>
                <h3 className="mb-2 text-xs font-semibold">原始需求</h3>
                <p className="whitespace-pre-wrap break-words rounded-lg bg-gray-900/60 p-3 text-sm leading-relaxed light:bg-gray-50">{detail.job.source || '未记录'}</p>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold">生成文案</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(detail.job.variants ?? {}).map(([key, value]) => (
                    <div key={key} className="rounded-lg border border-gray-700/50 p-3 light:border-gray-200">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{key}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{String(value)}</p>
                    </div>
                  ))}
                  {Object.keys(detail.job.variants ?? {}).length === 0 && <p className="text-xs text-gray-500">未记录生成文案</p>}
                </div>
              </section>

              <div className="grid gap-2 sm:grid-cols-3">
                <JsonBlock title="诊断" value={detail.job.diagnosis} />
                <JsonBlock title="审核" value={detail.job.audit} />
                <JsonBlock title="评分" value={detail.job.scores} />
              </div>

              <section>
                <h3 className="mb-2 text-xs font-semibold">模型调用日志</h3>
                {detail.modelAttempts.status === 'unavailable' ? (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-xs text-amber-400">
                    模型调用日志暂不可用；任务详情仍可用于定位文案问题。待 D4 遥测表迁移后会自动显示。
                  </div>
                ) : detail.modelAttempts.items.length === 0 ? (
                  <p className="rounded-lg bg-gray-900/50 px-3 py-4 text-center text-xs text-gray-500 light:bg-gray-50">此任务暂无模型调用记录</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-700/50 light:border-gray-200">
                    <table className="min-w-[760px] w-full text-left text-xs">
                      <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                        <tr><th className="px-3 py-2">时间 / 尝试</th><th className="px-3 py-2">操作</th><th className="px-3 py-2">模型</th><th className="px-3 py-2">结果</th><th className="px-3 py-2">耗时</th><th className="px-3 py-2">Token</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800 light:divide-gray-200">
                        {detail.modelAttempts.items.map((item, index) => (
                          <tr key={`${item.createdAt}:${item.attempt}:${index}`}>
                            <td className="px-3 py-2">{item.createdAt.slice(0, 19).replace('T', ' ')} · #{item.attempt}</td>
                            <td className="px-3 py-2">{item.operation}</td>
                            <td className="px-3 py-2">{item.provider} / {item.model}</td>
                            <td className={`px-3 py-2 ${item.status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{item.status}{item.errorClass ? ` · ${item.errorClass}` : ''}</td>
                            <td className="px-3 py-2 tabular-nums">{item.latencyMs} ms</td>
                            <td className="px-3 py-2 tabular-nums">{item.totalTokens ?? '缺失'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
