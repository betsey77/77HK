import { useEffect, useRef, useState } from 'react';
import { Check, Copy, MessageCircle, X } from 'lucide-react';

const WECHAT_ID = '18595680518';

interface TeamContactDialogProps {
  open: boolean;
  onClose: () => void;
}

type CopyState = 'idle' | 'success' | 'error';

export default function TeamContactDialog({ open, onClose }: TeamContactDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setCopyState('idle');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => closeRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  async function copyWechatId() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(WECHAT_ID);
      setCopyState('success');
    } catch {
      setCopyState('error');
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    if (focusable.length === 0) return;

    const [first] = focusable;
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-contact-title"
        aria-describedby="team-contact-description"
        onKeyDown={handleKeyDown}
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-lg border border-gray-700 bg-gray-950 shadow-2xl light:border-gray-300 light:bg-white"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-800 px-5 py-4 light:border-gray-200">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400 light:bg-orange-100 light:text-orange-600">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="team-contact-title" className="text-base font-semibold text-gray-100 light:text-gray-900">
                联系开通团队协作版
              </h2>
              <p id="team-contact-description" className="mt-1 text-xs leading-5 text-gray-400 light:text-gray-600">
                ￥99/月，人工确认审核分组与管理员权限后开通。
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="关闭联系弹窗"
            title="关闭"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-800 hover:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 light:hover:bg-gray-100 light:hover:text-gray-900 light:focus-visible:ring-orange-500"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-100 light:text-gray-900">微信联系</p>
            <p className="mt-1 text-sm text-gray-300 light:text-gray-700">vx：{WECHAT_ID}</p>
            <button
              type="button"
              onClick={copyWechatId}
              aria-label="复制微信号"
              className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-400 px-4 text-sm font-semibold text-gray-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 light:bg-orange-500 light:text-white light:hover:bg-orange-600 light:focus-visible:ring-orange-500"
            >
              {copyState === 'success' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              复制微信号
            </button>
            <p className="mt-3 min-h-5 text-xs text-gray-400 light:text-gray-600" aria-live="polite" role="status">
              {copyState === 'success' && '已复制微信号'}
              {copyState === 'error' && '复制失败，请手动选择微信号'}
            </p>
            <p className="mt-3 border-t border-gray-800 pt-3 text-xs leading-5 text-gray-500 light:border-gray-200 light:text-gray-500">
              此入口仅用于联系人工开通，不会发起支付宝付款。
            </p>
          </div>

          <div className="mx-auto w-full max-w-[220px]">
            <img
              src="/brand/wechat-team-contact-qr.png"
              alt="团队协作版微信联系二维码"
              className="aspect-square w-full rounded-md border border-gray-700 bg-white object-contain p-1 light:border-gray-300"
            />
            <p className="mt-2 text-center text-xs text-gray-500">微信扫码联系</p>
          </div>
        </div>
      </div>
    </div>
  );
}
