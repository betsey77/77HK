import { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  /** Optional preview text for the item being deleted (e.g., copy snippet) */
  preview?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Disables both actions while an async confirmation is running. */
  confirming?: boolean;
  confirmingLabel?: string;
  /** When true, uses red danger styling instead of the default accent */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Accessible confirmation dialog following shadcn-like patterns.
 *
 * - Focus trapping: focus cycles between confirm/cancel buttons.
 * - Escape key closes (calls onCancel).
 * - Click outside does NOT close (intentional — prevents accidental dismissal).
 * - aria attributes: role="alertdialog", aria-modal, aria-labelledby, aria-describedby.
 * - Danger mode: red confirm button; default: accent (orange light / green dark).
 * - Preview text is truncated and shown in a semi-transparent block.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  preview,
  confirmLabel = '确认删除',
  cancelLabel = '取消',
  confirming = false,
  confirmingLabel = '处理中…',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the least-destructive button on open (cancel)
  useEffect(() => {
    if (open) {
      // Small delay so the DOM is painted
      const timer = setTimeout(() => {
        cancelRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Keyboard: Escape → cancel, Tab → cycle between buttons
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (!confirming) onCancel();
        return;
      }
      if (e.key === 'Tab') {
        // Simple focus cycle between cancel and confirm
        if (document.activeElement === confirmRef.current) {
          e.preventDefault();
          cancelRef.current?.focus();
        } else if (document.activeElement === cancelRef.current) {
          e.preventDefault();
          confirmRef.current?.focus();
        }
      }
    },
    [confirming, onCancel],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        onKeyDown={handleKeyDown}
        className={`
          relative z-10 w-full max-w-sm rounded-xl border shadow-2xl
          bg-gray-900 light:bg-white
          border-gray-700/50 light:border-gray-300/50
          p-5
        `}
      >
        {/* Icon + Title */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`
              flex h-8 w-8 shrink-0 items-center justify-center rounded-full
              ${danger
                ? 'bg-red-500/15 text-red-400'
                : 'bg-orange-500/15 text-orange-400 light:bg-orange-100 light:text-orange-600 dark:bg-emerald-500/15 dark:text-emerald-400'
              }
            `}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2
              id="confirm-dialog-title"
              className="text-sm font-semibold text-gray-100 light:text-gray-900"
            >
              {title}
            </h2>
            <p
              id="confirm-dialog-desc"
              className="mt-1 text-xs text-gray-400 light:text-gray-600 leading-relaxed"
            >
              {message}
            </p>
          </div>
        </div>

        {/* Preview (optional) */}
        {preview && (
          <div className="mb-3 rounded-md border border-gray-700/30 light:border-gray-300/40 bg-gray-800/40 light:bg-gray-100 px-3 py-2">
            <p className="text-[10px] text-gray-500 mb-0.5">文案摘要</p>
            <p className="text-xs text-gray-300 light:text-gray-700 line-clamp-2 whitespace-pre-wrap leading-relaxed">
              {preview}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-400 light:text-gray-600 hover:text-gray-200 light:hover:text-gray-900 hover:bg-gray-800 light:hover:bg-gray-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            aria-busy={confirming}
            className={`
              px-3 py-1.5 rounded-md text-xs font-medium transition-colors
              focus:outline-none focus-visible:ring-2
              disabled:cursor-not-allowed disabled:opacity-60
              ${danger
                ? 'bg-red-600 hover:bg-red-500 text-white focus-visible:ring-red-400'
                : 'bg-orange-600 hover:bg-orange-500 light:bg-orange-600 light:hover:bg-orange-500 text-white focus-visible:ring-orange-400 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:focus-visible:ring-emerald-400'
              }
            `}
          >
            {confirming ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
