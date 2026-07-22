import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarCheck2,
  Check,
  Gift,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  CheckInApiError,
  claimCheckInGrant,
  getCheckInStatus,
  performDailyCheckIn,
  type CheckInStatus,
} from '../../services/checkInApi';
import {
  isReviewResultDialogOpen,
  REVIEW_RESULT_DIALOG_VISIBILITY_EVENT,
  type ReviewResultDialogVisibilityDetail,
} from '../../services/reviewResultNotifications';

export function hongKongDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function checkInDismissalKey(ownerId: string, dateHk: string): string {
  return `hk-cantonese-checkin-dismissed:${ownerId}:${dateHk}`;
}

function wasDismissed(ownerId: string, dateHk: string): boolean {
  try {
    return localStorage.getItem(checkInDismissalKey(ownerId, dateHk)) === '1';
  } catch {
    return false;
  }
}

function formatHongKongExpiry(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

interface CheckInDialogProps {
  ownerId: string;
  getNow?: () => Date;
}

export default function CheckInDialog({
  ownerId,
  getNow = () => new Date(),
}: CheckInDialogProps) {
  const dateHkRef = useRef(hongKongDateKey(getNow()));
  const [open, setOpen] = useState(
    () => !wasDismissed(ownerId, dateHkRef.current),
  );
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [action, setAction] = useState<'checkin' | 'claim' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deferredByReviewResult, setDeferredByReviewResult] = useState(
    () => isReviewResultDialogOpen(ownerId),
  );
  const requestSequenceRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const loadStatus = useCallback(async () => {
    const requestSequence = ++requestSequenceRef.current;
    setLoadState('loading');
    setActionError(null);
    try {
      const nextStatus = await getCheckInStatus();
      if (requestSequence !== requestSequenceRef.current) return;
      setStatus(nextStatus);
      setLoadState('ready');
    } catch {
      if (requestSequence !== requestSequenceRef.current) return;
      setLoadState('error');
    }
  }, []);

  const close = useCallback(() => {
    requestSequenceRef.current += 1;
    try {
      localStorage.setItem(checkInDismissalKey(ownerId, dateHkRef.current), '1');
    } catch {
      // Storage denial must not trap the user in the dialog.
    }
    setOpen(false);
  }, [ownerId]);

  useEffect(() => {
    setDeferredByReviewResult(isReviewResultDialogOpen(ownerId));
    const handleReviewResultVisibility = (event: Event) => {
      const detail = (event as CustomEvent<ReviewResultDialogVisibilityDetail>).detail;
      if (!detail || detail.ownerId !== ownerId) return;
      setDeferredByReviewResult(detail.open);
    };
    window.addEventListener(REVIEW_RESULT_DIALOG_VISIBILITY_EVENT, handleReviewResultVisibility);
    return () => {
      window.removeEventListener(REVIEW_RESULT_DIALOG_VISIBILITY_EVENT, handleReviewResultVisibility);
    };
  }, [ownerId]);

  const visible = open && !deferredByReviewResult;

  useEffect(() => {
    if (!visible) return;
    void loadStatus();
  }, [loadStatus, visible]);

  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && action === null) {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled])'),
      );
      if (controls.length < 2) return;
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
  }, [action, close, visible]);

  if (!visible) return null;

  const progress = Math.min(status?.streakCount ?? 0, 7);
  const expiryLabel = formatHongKongExpiry(status?.subscriptionExpiresAt ?? null);
  const progressWidth = progress === 0 ? 0 : ((progress - 1) / 6) * 100;

  async function handleCheckIn() {
    if (action) return;
    const requestSequence = ++requestSequenceRef.current;
    setAction('checkin');
    setActionError(null);
    try {
      const nextStatus = await performDailyCheckIn();
      if (requestSequence !== requestSequenceRef.current) return;
      setStatus(nextStatus);
    } catch {
      if (requestSequence === requestSequenceRef.current) {
        setActionError('签到失败，请稍后重试');
      }
    } finally {
      if (requestSequence === requestSequenceRef.current) setAction(null);
    }
  }

  async function handleClaim() {
    if (action || !status?.grantId || !status.canClaim) return;
    const requestSequence = ++requestSequenceRef.current;
    setAction('claim');
    setActionError(null);
    try {
      const result = await claimCheckInGrant(status.grantId);
      if (requestSequence !== requestSequenceRef.current) return;
      setStatus((current) => current ? {
        ...current,
        rewardStatus: result.grantStatus,
        canClaim: false,
        grantId: result.grantId,
        grantAppliedAt: result.grantAppliedAt,
        subscriptionExpiresAt: result.subscriptionExpiresAt,
      } : current);
    } catch (error) {
      if (requestSequence !== requestSequenceRef.current) return;
      if (error instanceof CheckInApiError && error.code === 'ACTIVE_PRO') {
        setStatus((current) => current ? {
          ...current,
          canClaim: false,
          subscriptionExpiresAt: error.subscriptionExpiresAt ?? current.subscriptionExpiresAt,
        } : current);
        setActionError('当前 Pro 仍有效，奖励会保留至到期后领取');
      } else if (error instanceof CheckInApiError && error.code === 'REWARD_NOT_FOUND') {
        setActionError('奖励状态已更新，正在重新读取');
        setAction(null);
        await loadStatus();
      } else {
        setActionError('奖励领取失败，请稍后重试');
      }
    } finally {
      if (requestSequence === requestSequenceRef.current) setAction(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md light:bg-slate-900/55" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="check-in-dialog-title"
        aria-describedby="check-in-dialog-description"
        className="relative z-10 max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-white/10 bg-[#07100f] p-5 text-gray-100 shadow-[0_32px_90px_-28px_rgba(0,0,0,0.9),0_0_0_1px_rgba(16,185,129,0.04)] sm:p-7 light:border-orange-200/80 light:bg-[#fffdf9] light:text-gray-900 light:shadow-[0_32px_80px_-30px_rgba(124,45,18,0.32)]"
      >
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent light:via-orange-400/70" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-emerald-400/20 to-emerald-500/5 text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] light:border-orange-200 light:from-orange-100 light:to-orange-50 light:text-orange-600">
              <CalendarCheck2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-400/80 light:text-orange-600">7 日签到计划</p>
              <h2 id="check-in-dialog-title" className="mt-1 text-xl font-semibold tracking-tight">每日签到</h2>
              <p id="check-in-dialog-description" className="mt-1.5 max-w-sm text-xs leading-5 text-gray-400 light:text-gray-600">
                连续 7 个香港自然日签到，可获得一次 30 天 Pro。
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            disabled={action !== null}
            aria-label="关闭每日签到"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-white/5 hover:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none light:hover:bg-orange-100/70 light:hover:text-gray-900 light:focus-visible:ring-orange-500"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {loadState === 'loading' && (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-gray-400" role="status" aria-label="正在读取签到状态">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400 light:text-orange-600" aria-hidden="true" />
            <span>正在读取签到状态…</span>
          </div>
        )}

        {loadState === 'error' && (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 p-4" role="alert">
            <p className="text-sm font-medium text-red-300 light:text-red-700">签到状态暂时无法加载</p>
            <p className="mt-1 text-xs leading-5 text-red-200/70 light:text-red-700/80">不会影响现有会员和额度，可以稍后重试。</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void loadStatus()}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-semibold text-gray-950 transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 light:bg-orange-600 light:text-white light:hover:bg-orange-500 light:focus-visible:ring-orange-500"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                重试
              </button>
              <button
                type="button"
                onClick={close}
                className="min-h-11 flex-1 rounded-md border border-gray-700 px-4 text-sm text-gray-300 hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 light:border-gray-300 light:text-gray-700 light:hover:bg-gray-100"
              >
                今天不再提醒
              </button>
            </div>
          </div>
        )}

        {loadState === 'ready' && status && (
          <div className="mt-6 space-y-4">
            <section aria-label="连续签到进度" className="rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/[0.07] sm:p-5 light:bg-orange-50/70 light:ring-orange-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-gray-500 light:text-gray-500">连续进度</p>
                  <h3 className="mt-1 text-base font-semibold text-emerald-100 light:text-orange-900">连续签到 {progress} / 7 天</h3>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-400/15 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300 light:border-orange-200 light:bg-orange-100 light:text-orange-700">
                  {status.checkedInToday ? '今日已签到' : '今日待签到'}
                </span>
              </div>
              <div className="relative mt-5 grid grid-cols-7 gap-1">
                <span className="absolute left-[7%] right-[7%] top-[17px] h-px bg-gray-700 light:bg-orange-200" aria-hidden="true">
                  <span
                    className="block h-full bg-emerald-400 transition-[width] duration-500 motion-reduce:transition-none light:bg-orange-500"
                    style={{ width: `${progressWidth}%` }}
                  />
                </span>
                {Array.from({ length: 7 }, (_, index) => {
                  const completed = index < progress;
                  return (
                    <div key={index} className="relative flex min-w-0 flex-col items-center gap-1.5">
                      <span
                        aria-label={`第 ${index + 1} 天${completed ? '已完成' : '未完成'}`}
                        className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full border text-[11px] font-semibold shadow-[0_0_0_4px_#07100f] transition motion-reduce:transition-none light:shadow-[0_0_0_4px_#fff7ed] ${completed
                          ? 'border-emerald-300 bg-emerald-400 text-emerald-950 light:border-orange-500 light:bg-orange-500 light:text-white'
                          : 'border-gray-700 bg-[#0b1514] text-gray-500 light:border-orange-200 light:bg-white light:text-gray-500'
                        }`}
                      >
                        {completed ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                      </span>
                      <span className={`text-[10px] ${completed ? 'text-gray-300 light:text-gray-700' : 'text-gray-600 light:text-gray-400'}`}>第{index + 1}天</span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section
              aria-label="签到奖励"
              className={`rounded-2xl p-4 ring-1 sm:p-5 ${status.rewardStatus === 'applied'
                ? 'bg-emerald-500/[0.08] ring-emerald-400/20 light:bg-orange-50 light:ring-orange-200'
                : status.rewardStatus === 'pending'
                  ? 'bg-amber-500/[0.07] ring-amber-400/20 light:bg-amber-50 light:ring-amber-200'
                  : 'bg-white/[0.025] ring-white/[0.06] light:bg-white light:ring-orange-100'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${status.rewardStatus === 'applied'
                  ? 'bg-emerald-400 text-emerald-950 shadow-[0_10px_28px_-12px_rgba(52,211,153,0.75)] light:bg-orange-500 light:text-white'
                  : 'bg-amber-500/15 text-amber-300 light:bg-amber-100 light:text-amber-700'
                }`}>
                  {status.rewardStatus === 'applied'
                    ? <Check className="h-5 w-5" aria-hidden="true" />
                    : <Gift className="h-5 w-5" aria-hidden="true" />}
                </span>
                <div className="min-w-0">
                  {status.rewardStatus === 'none' && (
                    <>
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-amber-400/80 light:text-amber-700">完成奖励</p>
                      <h3 className="mt-1 text-base font-semibold">30 天 Pro 奖励</h3>
                      <p className="mt-1 text-xs leading-5 text-gray-400 light:text-gray-600">完成第 7 天后由服务端自动判断发放或保留。</p>
                    </>
                  )}
                  {status.rewardStatus === 'pending' && (
                    <>
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-amber-400/80 light:text-amber-700">待领取奖励</p>
                      <h3 className="mt-1 text-base font-semibold text-amber-300 light:text-amber-700">奖励已保留</h3>
                      <p className="mt-1 text-xs leading-5 text-gray-400 light:text-gray-600">
                        {status.canClaim
                          ? '当前没有有效 Pro，可以领取新的 30 天周期。'
                          : `当前 Pro 到期后即可领取${expiryLabel ? `（预计 ${expiryLabel}）` : ''}。`}
                      </p>
                    </>
                  )}
                  {status.rewardStatus === 'applied' && (
                    <>
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-400/80 light:text-orange-600">已解锁</p>
                      <h3 className="mt-1 text-base font-semibold text-emerald-300 light:text-orange-700">30 天 Pro 奖励已发放</h3>
                      <p className="mt-1 text-xs leading-5 text-gray-400 light:text-gray-600">
                        新周期与额度均以服务端会员状态为准{expiryLabel ? `，预计至 ${expiryLabel}` : ''}。
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>

            {actionError && (
              <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-300 light:text-red-700" role="alert">
                {actionError}
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              {!status.checkedInToday && (
                <button
                  type="button"
                  onClick={() => void handleCheckIn()}
                  disabled={action !== null}
                  aria-busy={action === 'checkin'}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-emerald-950 shadow-[0_12px_28px_-14px_rgba(52,211,153,0.75)] transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none light:bg-orange-600 light:text-white light:hover:bg-orange-500 light:focus-visible:ring-orange-500"
                >
                  {action === 'checkin' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {action === 'checkin' ? '签到中…' : '立即签到'}
                </button>
              )}
              {status.canClaim && status.grantId && (
                <button
                  type="button"
                  onClick={() => void handleClaim()}
                  disabled={action !== null}
                  aria-busy={action === 'claim'}
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-amber-950 shadow-[0_12px_28px_-14px_rgba(251,191,36,0.7)] transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                >
                  {action === 'claim' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {action === 'claim' ? '领取中…' : '领取 30 天 Pro'}
                </button>
              )}
              <button
                type="button"
                onClick={close}
                disabled={action !== null}
                className={`min-h-12 flex-1 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${status.checkedInToday && !status.canClaim
                  ? 'bg-emerald-400 text-emerald-950 hover:bg-emerald-300 focus-visible:ring-emerald-300 light:bg-orange-600 light:text-white light:hover:bg-orange-500 light:focus-visible:ring-orange-500'
                  : 'border border-white/10 text-gray-300 hover:bg-white/5 focus-visible:ring-gray-500 light:border-orange-200 light:text-gray-700 light:hover:bg-orange-50'
                }`}
              >
                {status.checkedInToday && !status.canClaim ? '知道了' : '今天先不提醒'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
