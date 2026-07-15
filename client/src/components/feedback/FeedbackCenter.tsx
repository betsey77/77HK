import { useState, useEffect, useCallback, useRef } from 'react';
import { X, MessageSquare, Send, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { apiUrl } from '../../services/apiBase';

// ── Types ──────────────────────────────────────────────────────

type FeedbackType = 'feature_request' | 'bug_report' | 'user_experience' | 'other';

interface FeedbackItem {
  id: string;
  type: FeedbackType;
  title: string;
  content: string;
  notifyStatus: string;
  createdAt: string;
}

interface SubmitState {
  status: 'idle' | 'submitting' | 'success' | 'error';
  errorMessage?: string;
}

// ── Constants ──────────────────────────────────────────────────

const TYPE_OPTIONS: { value: FeedbackType; label: string; desc: string }[] = [
  { value: 'feature_request', label: '需求建议', desc: '希望新增的功能或改进' },
  { value: 'bug_report', label: 'Bug反馈', desc: '遇到的问题或错误' },
  { value: 'user_experience', label: '使用体验', desc: '操作流程、界面等方面的感受' },
  { value: 'other', label: '其他', desc: '其他类型的反馈' },
];

const TYPE_LABELS: Record<FeedbackType, string> = {
  feature_request: '需求建议',
  bug_report: 'Bug反馈',
  user_experience: '使用体验',
  other: '其他',
};

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 5000;

// ── Helpers ────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-HK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getAppVersion(): string {
  return '0.1.0';
}

// ── API ────────────────────────────────────────────────────────

async function submitFeedback(
  type: FeedbackType,
  title: string,
  content: string,
  jwt: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(apiUrl('/feedback'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        type,
        title: title.trim(),
        content: content.trim(),
        metadata: {
          page_path: window.location.pathname,
          app_version: getAppVersion(),
        },
      }),
    });

    if (response.ok) return { success: true };
    const body = await response.json().catch(() => ({}));
    const serverError = body?.error;
    if (response.status === 429) {
      return { success: false, error: '反馈次数已达上限，请稍后再试' };
    }
    if (response.status >= 500) {
      return { success: false, error: '服务暂时不可用，请稍后再试' };
    }
    return { success: false, error: serverError ?? `请求失败 (${response.status})` };
  } catch {
    return { success: false, error: '网络连接失败，请检查网络后重试' };
  }
}

async function fetchMyFeedback(
  jwt: string,
): Promise<{ items: FeedbackItem[]; total: number } | null> {
  try {
    const response = await fetch(apiUrl('/feedback'), {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ── Props ──────────────────────────────────────────────────────

// ── Props ──────────────────────────────────────────────────────

interface FeedbackCenterProps {
  isOpen: boolean;
  onClose: () => void;
  jwt: string | null;
}

// ── Focus trap helper ──────────────────────────────────────────

function useFocusTrap(containerRef: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;

      const focusable = container.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) return;

      const first = focusable[0] as HTMLElement | undefined;
      const last = focusable[focusable.length - 1] as HTMLElement | undefined;
      if (!first || !last) return;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, containerRef]);
}

// ── Component ──────────────────────────────────────────────────

export default function FeedbackCenter({ isOpen, onClose, jwt }: FeedbackCenterProps) {
  // Form state
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feature_request');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  // My feedback list
  const [myFeedback, setMyFeedback] = useState<FeedbackItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Refs for accessibility
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // Focus trap
  useFocusTrap(dialogRef, isOpen);

  // Save trigger element on open for focus restore
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
    }
  }, [isOpen]);

  // Initial focus on dialog open
  useEffect(() => {
    if (isOpen) {
      // Small delay to let the dialog render
      const timer = setTimeout(() => {
        firstFocusRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Restore focus on close
  useEffect(() => {
    if (!isOpen && triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);

  // Load my feedback on open
  useEffect(() => {
    if (!isOpen || !jwt) return;

    setListLoading(true);
    setListError(null);
    fetchMyFeedback(jwt)
      .then((data) => {
        if (data) {
          setMyFeedback(data.items ?? []);
        } else {
          setListError('无法加载反馈记录');
        }
      })
      .catch(() => setListError('无法加载反馈记录'))
      .finally(() => setListLoading(false));
  }, [isOpen, jwt]);

  // Reset form on close
  useEffect(() => {
    if (!isOpen) {
      setSubmitState({ status: 'idle' });
      setTitle('');
      setContent('');
      setFeedbackType('feature_request');
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    if (!jwt) return;
    if (!title.trim() || !content.trim()) return;
    if (title.trim().length > MAX_TITLE_LENGTH || content.trim().length > MAX_CONTENT_LENGTH) return;

    setSubmitState({ status: 'submitting' });

    const result = await submitFeedback(feedbackType, title.trim(), content.trim(), jwt);

    if (result.success) {
      setSubmitState({ status: 'success' });
      setTitle('');
      setContent('');
      setFeedbackType('feature_request');
      // Refresh list
      const data = await fetchMyFeedback(jwt);
      if (data) setMyFeedback(data.items ?? []);
    } else {
      setSubmitState({ status: 'error', errorMessage: result.error ?? '提交失败，请稍后再试' });
    }
  }, [jwt, feedbackType, title, content]);

  const canSubmit =
    submitState.status !== 'submitting' &&
    title.trim().length > 0 &&
    title.trim().length <= MAX_TITLE_LENGTH &&
    content.trim().length > 0 &&
    content.trim().length <= MAX_CONTENT_LENGTH;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop — blocks background interaction */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-dialog-title"
        className="relative w-full max-w-md h-full bg-gray-950 light:bg-white border-l border-gray-800 light:border-gray-300 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 light:border-gray-300 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-emerald-400 light:text-orange-500" aria-hidden="true" />
            <h2 id="feedback-dialog-title" className="text-sm font-semibold text-gray-200 light:text-gray-800">
              意见反馈
            </h2>
          </div>
          <button
            ref={firstFocusRef}
            onClick={onClose}
            className="p-1 rounded text-gray-500 hover:text-gray-300 light:hover:text-gray-700 transition-colors"
            aria-label="关闭反馈面板"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Submit form */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-gray-400 light:text-gray-600 uppercase tracking-wider">
              提交反馈
            </h3>

            {/* Type selector */}
            <div role="radiogroup" aria-label="反馈类型">
              <label className="block text-[11px] text-gray-500 mb-1.5">反馈类型</label>
              <div className="grid grid-cols-2 gap-1.5">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={feedbackType === opt.value}
                    onClick={() => setFeedbackType(opt.value)}
                    title={opt.desc}
                    className={`
                      text-left px-2.5 py-2 rounded-md border text-[11px] transition-colors
                      ${feedbackType === opt.value
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 light:border-orange-400 light:bg-orange-50 light:text-orange-600'
                        : 'border-gray-700/30 light:border-gray-300/40 bg-transparent text-gray-400 light:text-gray-600 hover:border-gray-500'
                      }
                    `}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="block text-[10px] opacity-60 mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="feedback-title" className="block text-[11px] text-gray-500 mb-1">
                标题 <span className="text-red-400">*</span>
              </label>
              <input
                id="feedback-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={MAX_TITLE_LENGTH}
                placeholder="简要描述你的反馈..."
                className="w-full text-xs bg-gray-900/60 light:bg-white border border-gray-600/40 light:border-gray-400 rounded px-2.5 py-2 text-gray-200 light:text-gray-800 focus:outline-none focus:border-emerald-500/50 light:focus:border-orange-500/50 placeholder:text-gray-600"
              />
              <div className="flex justify-end mt-0.5">
                <span className={`text-[10px] ${title.length > MAX_TITLE_LENGTH ? 'text-red-400' : 'text-gray-600'}`}>
                  {title.length}/{MAX_TITLE_LENGTH}
                </span>
              </div>
            </div>

            {/* Content */}
            <div>
              <label htmlFor="feedback-content" className="block text-[11px] text-gray-500 mb-1">
                详细描述 <span className="text-red-400">*</span>
              </label>
              <textarea
                id="feedback-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={MAX_CONTENT_LENGTH}
                rows={5}
                placeholder="详细描述你的需求、问题或体验..."
                className="w-full text-xs bg-gray-900/60 light:bg-white border border-gray-600/40 light:border-gray-400 rounded px-2.5 py-2 text-gray-200 light:text-gray-800 focus:outline-none focus:border-emerald-500/50 light:focus:border-orange-500/50 placeholder:text-gray-600 resize-vertical"
              />
              <div className="flex justify-end mt-0.5">
                <span className={`text-[10px] ${content.length > MAX_CONTENT_LENGTH ? 'text-red-400' : 'text-gray-600'}`}>
                  {content.length}/{MAX_CONTENT_LENGTH}
                </span>
              </div>
            </div>

            {/* Auto-attached metadata (read-only) */}
            <div className="text-[10px] text-gray-600 space-y-0.5" aria-hidden="true">
              <p>页面路径：{window.location.pathname}</p>
              <p>App版本：{getAppVersion()}</p>
            </div>

            {/* Submit button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`
                w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-medium transition-colors
                ${canSubmit
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white light:bg-orange-600 light:hover:bg-orange-500'
                  : 'bg-gray-800 light:bg-gray-200 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {submitState.status === 'submitting' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  提交中...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  提交反馈
                </>
              )}
            </button>

            {/* Submit result */}
            {submitState.status === 'success' && (
              <div role="status" className="flex items-center gap-2 text-xs text-emerald-400 light:text-emerald-600 bg-emerald-500/10 light:bg-emerald-50 rounded-md px-3 py-2">
                <CheckCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                反馈已提交，感谢你的意见！
              </div>
            )}
            {submitState.status === 'error' && (
              <div role="alert" className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {submitState.errorMessage}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800 light:border-gray-300" />

          {/* My feedback list */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 light:text-gray-600 uppercase tracking-wider">
              我的反馈记录
            </h3>

            {listLoading && (
              <div className="flex items-center justify-center py-8" role="status">
                <Loader2 className="w-4 h-4 text-gray-500 animate-spin" aria-label="加载中" />
              </div>
            )}

            {listError && (
              <div role="alert" className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                {listError}
              </div>
            )}

            {!listLoading && !listError && myFeedback.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
                <MessageSquare className="w-6 h-6 text-gray-600 opacity-30" aria-hidden="true" />
                <p className="text-xs text-gray-600">暂无反馈记录</p>
                <p className="text-[10px] text-gray-600 max-w-xs">
                  你的每一条反馈都会帮助我们改进产品。提交后可以在上方查看处理状态。
                </p>
              </div>
            )}

            {!listLoading && myFeedback.length > 0 && (
              <div className="space-y-2">
                {myFeedback.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-gray-700/30 light:border-gray-300/40 bg-gray-800/20 light:bg-gray-50 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {/* Type + Title */}
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 light:bg-orange-100 light:text-orange-600 shrink-0">
                            {TYPE_LABELS[item.type] ?? item.type}
                          </span>
                          <span className="text-xs text-gray-200 light:text-gray-800 font-medium truncate">
                            {item.title}
                          </span>
                        </div>
                        {/* Content preview */}
                        <p className="text-[11px] text-gray-400 light:text-gray-600 line-clamp-2 whitespace-pre-wrap leading-relaxed">
                          {item.content}
                        </p>
                      </div>
                      {/* Time */}
                      <div className="flex items-center gap-1 text-[10px] text-gray-600 shrink-0">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {formatDate(item.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
