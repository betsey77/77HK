import { useEffect, useRef } from 'react';
import { ScrollText, X } from 'lucide-react';
import {
  RELEASE_NOTES_EMPTY_COPY,
  getDeployedReleaseNotes,
  type ReleaseNote,
} from '../../constants/releaseNotes';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Optional override for tests; production uses getDeployedReleaseNotes(). */
  notes?: ReleaseNote[];
}

export default function ReleaseNotesDialog({ open, onClose, notes }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const deployed = notes ?? getDeployedReleaseNotes();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (controls.length === 0) return;
      const first = controls[0]!;
      const last = controls[controls.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[115] flex items-end justify-center p-3 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[1px]" aria-hidden="true" />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="更新日志"
        aria-labelledby="release-notes-title"
        className="relative z-10 flex max-h-[min(90dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-950 text-gray-100 shadow-2xl light:border-gray-200 light:bg-white light:text-gray-900"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-800 px-4 py-3 light:border-gray-200">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-emerald-400 light:text-orange-600" />
              <h2 id="release-notes-title" className="text-sm font-semibold">
                更新日志
              </h2>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              仅展示已正式上线的用户可见更新
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-200 light:hover:bg-gray-100"
            aria-label="关闭更新日志"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div
          data-testid="release-notes-scroll"
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        >
          {deployed.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-700/60 px-3 py-8 text-center text-xs text-gray-500 light:border-gray-300">
              {RELEASE_NOTES_EMPTY_COPY}
            </p>
          ) : (
            <ul className="space-y-4">
              {deployed.map((note) => (
                <li
                  key={`${note.version}-${note.releasedAt ?? 'na'}`}
                  className="rounded-lg border border-gray-800 p-3 light:border-gray-200"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold">
                      {note.title ?? `版本 ${note.version}`}
                    </h3>
                    <span className="text-[11px] text-gray-500">
                      {note.releasedAt ?? '日期待定'} · v{note.version}
                    </span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {note.sections.map((section) => (
                      <div key={section.title} className="min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 light:text-gray-600">
                          {section.title}
                        </p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-gray-300 light:text-gray-700">
                          {section.items.map((item) => (
                            <li key={item} className="break-words">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

