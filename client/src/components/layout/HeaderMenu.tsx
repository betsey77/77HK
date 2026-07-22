import { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Home, RotateCcw, Sun, Moon, LogOut, Menu, User, MessageSquare, CreditCard, Shield, Bell, X, ScrollText } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { checkAdminAccess, getAdminPendingReviewSummary, type AdminPendingReviewSummary } from '../../services/api';
import { recordAdminPendingReviewSummary } from '../../services/adminReviewReminder';
import { useVisiblePolling } from '../../hooks/useVisiblePolling';
import ConfirmDialog from '../shared/ConfirmDialog';
import ReleaseNotesDialog from './ReleaseNotesDialog';

interface Props {
  userEmail?: string | null;
  onLogout?: () => void | Promise<void>;
  onOpenFeedback?: () => void;
}

export default function HeaderMenu({ userEmail, onLogout, onOpenFeedback }: Props) {
  const { state, dispatch } = useContext(AppContext);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingSummary, setPendingSummary] = useState<AdminPendingReviewSummary>({ count: 0, latestRequestedAt: null });
  const [reviewToast, setReviewToast] = useState<AdminPendingReviewSummary | null>(null);
  const [confirmAction, setConfirmAction] = useState<'restore' | 'logout' | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const refreshPendingReviews = useCallback(async () => {
    try {
      const summary = await getAdminPendingReviewSummary();
      setPendingSummary(summary);
      if (recordAdminPendingReviewSummary(summary, userEmail)) {
        setReviewToast(summary);
      }
      return true;
    } catch {
      // The menu remains usable if the non-critical badge refresh fails.
      return false;
    }
  }, [userEmail]);

  useVisiblePolling(refreshPendingReviews, isAdmin);

  // Server-verified admin check (not based on browser role string)
  useEffect(() => {
    let cancelled = false;
    checkAdminAccess().then((ok) => {
      if (!cancelled) {
        setIsAdmin(ok);
        if (ok) void refreshPendingReviews();
      }
    });
    return () => { cancelled = true; };
  }, [refreshPendingReviews]);

  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        close();
      }
    }

    // Delay adding listener so the opening click doesn't close immediately
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [isOpen, close]);

  function handleThemeToggle() {
    dispatch({
      type: 'SET_THEME',
      payload: state.theme === 'dark' ? 'light' : 'dark',
    });
  }

  function handleRestore() {
    close();
    setConfirmAction('restore');
  }

  function handleLogoutClick() {
    close();
    setConfirmAction('logout');
  }

  async function handleConfirm() {
    if (confirmAction === 'restore') {
      dispatch({ type: 'RESTORE_DEFAULT_GENERATION_SETTINGS' });
      setConfirmAction(null);
      return;
    }
    if (confirmAction === 'logout') {
      setIsConfirming(true);
      try {
        await onLogout?.();
        setConfirmAction(null);
      } finally {
        setIsConfirming(false);
      }
    }
  }

  const isDark = state.theme === 'dark';

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="账户与更多选项"
        title="账户与更多选项"
        className="relative flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200 light:hover:bg-gray-200 light:hover:text-gray-800"
      >
        <Menu className="h-3.5 w-3.5" />
        {isAdmin && pendingSummary.count > 0 && (
          <span
            data-testid="admin-pending-badge"
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white"
          >
            {pendingSummary.count > 99 ? '99+' : pendingSummary.count}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-lg border border-gray-700/50 light:border-gray-300/50 bg-gray-900 light:bg-white shadow-xl"
        >
          {/* User info */}
          {userEmail && (
            <div className="flex items-center gap-2 border-b border-gray-700/30 light:border-gray-200 px-3 py-2.5">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 light:bg-orange-100">
                <User className="h-3 w-3 text-emerald-400 light:text-orange-600" />
              </div>
              <span className="truncate text-[11px] text-gray-300 light:text-gray-700">
                {userEmail}
              </span>
            </div>
          )}

          <div className="py-1">
            {/* 官网 */}
            <a
              href="/"
              role="menuitem"
              onClick={close}
              className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-gray-300 light:text-gray-700 transition-colors hover:bg-gray-800 light:hover:bg-gray-100"
            >
              <Home className="h-3.5 w-3.5 text-gray-500" />
              官网首页
            </a>

            {/* 套餐与结算 */}
            <a
              href="/app/billing"
              role="menuitem"
              onClick={close}
              className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-gray-300 light:text-gray-700 transition-colors hover:bg-gray-800 light:hover:bg-gray-100"
            >
              <CreditCard className="h-3.5 w-3.5 text-gray-500" />
              套餐与结算
            </a>

            {/* 管理后台 — only visible after server-confirmed admin role */}
            {isAdmin && (
              <a
                href="/admin"
                role="menuitem"
                onClick={close}
                className="flex items-center gap-2.5 px-3 py-2 text-[11px] text-gray-300 light:text-gray-700 transition-colors hover:bg-gray-800 light:hover:bg-gray-100"
              >
                <Shield className="h-3.5 w-3.5 text-gray-500" />
                <span className="flex-1">管理后台</span>
                {pendingSummary.count > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {pendingSummary.count > 99 ? '99+' : pendingSummary.count}
                  </span>
                )}
              </a>
            )}

            {/* 意见反馈 */}
            {onOpenFeedback && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  onOpenFeedback();
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] text-gray-300 light:text-gray-700 transition-colors hover:bg-gray-800 light:hover:bg-gray-100"
              >
                <MessageSquare className="h-3.5 w-3.5 text-gray-500" />
                意见反馈
              </button>
            )}

            {/* 更新日志 — 静态 dialog，不跳转、不重置工作台 */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                setReleaseNotesOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] text-gray-300 light:text-gray-700 transition-colors hover:bg-gray-800 light:hover:bg-gray-100"
            >
              <ScrollText className="h-3.5 w-3.5 text-gray-500" />
              更新日志
            </button>

            {/* 复原配置 */}
            <button
              type="button"
              role="menuitem"
              onClick={handleRestore}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] text-gray-300 light:text-gray-700 transition-colors hover:bg-gray-800 light:hover:bg-gray-100"
            >
              <RotateCcw className="h-3.5 w-3.5 text-gray-500" />
              复原创作配置
            </button>

            {/* 主题切换 */}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                handleThemeToggle();
                close();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] text-gray-300 light:text-gray-700 transition-colors hover:bg-gray-800 light:hover:bg-gray-100"
            >
              {isDark ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-gray-500" />
                  切换浅色模式
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-gray-500" />
                  切换深色模式
                </>
              )}
            </button>

            {/* Divider before logout */}
            {onLogout && (
              <>
                <div className="my-1 border-t border-gray-700/30 light:border-gray-200" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogoutClick}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[11px] text-gray-400 light:text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  退出登录
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {reviewToast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-[70] w-[min(22rem,calc(100vw-2rem))] border border-amber-500/40 bg-gray-900 p-3 shadow-2xl light:bg-white"
        >
          <div className="flex items-start gap-2.5">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-100 light:text-gray-900">
                {reviewToast.count} 条文案待审核
              </p>
              <p className="mt-1 text-[11px] text-gray-400 light:text-gray-600">
                已合并本次新增任务，请进入用户收藏队列处理。
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReviewToast(null)}
                  className="rounded border border-gray-600 px-2.5 py-1.5 text-[11px] text-gray-300 light:border-gray-300 light:text-gray-700"
                >
                  稍后审核
                </button>
                <a
                  href="/admin?tab=favorites&pending=1"
                  className="rounded bg-amber-500 px-2.5 py-1.5 text-[11px] font-semibold text-gray-950"
                >
                  立刻审核
                </a>
              </div>
            </div>
            <button type="button" onClick={() => setReviewToast(null)} aria-label="关闭审核提醒" className="rounded p-1 text-gray-500">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction === 'logout' ? '确认退出登录？' : '确认复原创作配置？'}
        message={
          confirmAction === 'logout'
            ? '退出后需要重新登录；已同步的数据不会被删除。'
            : '将恢复默认创作配置：结构化写作关闭、创作自由度 1、粤语程度 4、中英夹杂 1，并清空目标用户。'
        }
        confirmLabel={confirmAction === 'logout' ? '确认退出' : '确认复原'}
        confirming={isConfirming}
        confirmingLabel="退出中…"
        danger={confirmAction === 'restore'}
        onConfirm={handleConfirm}
        onCancel={() => {
          if (!isConfirming) setConfirmAction(null);
        }}
      />

      <ReleaseNotesDialog
        open={releaseNotesOpen}
        onClose={() => {
          setReleaseNotesOpen(false);
          triggerRef.current?.focus();
        }}
      />
    </div>
  );
}
