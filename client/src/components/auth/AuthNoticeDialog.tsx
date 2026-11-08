import { useEffect, useRef } from 'react';
import { CircleCheck, MailCheck } from 'lucide-react';

interface AuthNoticeDialogProps {
  open: boolean;
  title: string;
  description: string;
  actionLabel: string;
  variant: 'email' | 'success';
  onClose: () => void;
}

export default function AuthNoticeDialog({
  open,
  title,
  description,
  actionLabel,
  variant,
  onClose,
}: AuthNoticeDialogProps) {
  const actionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => actionRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const Icon = variant === 'email' ? MailCheck : CircleCheck;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-notice-title"
        aria-describedby="auth-notice-description"
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose();
        }}
        className="relative z-10 w-full max-w-md rounded-lg border border-gray-700 bg-gray-950 p-6 text-gray-100 shadow-2xl light:border-gray-300 light:bg-white light:text-gray-900"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400 light:bg-orange-100 light:text-orange-600">
          <Icon className="h-5 w-5" />
        </span>
        <h2 id="auth-notice-title" className="mt-4 text-lg font-semibold">{title}</h2>
        <p id="auth-notice-description" className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-400 light:text-gray-600">
          {description}
        </p>
        <button
          ref={actionRef}
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-md bg-emerald-400 px-4 text-sm font-semibold text-gray-950 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 light:bg-orange-500 light:text-white light:hover:bg-orange-600 light:focus-visible:ring-orange-500"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
