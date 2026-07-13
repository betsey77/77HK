import { useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Home, RotateCcw, Sun, Moon, LogOut, Menu, User, MessageSquare, CreditCard, Shield } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { checkAdminAccess } from '../../services/api';

interface Props {
  userEmail?: string | null;
  onLogout?: () => void;
  onOpenFeedback?: () => void;
}

export default function HeaderMenu({ userEmail, onLogout, onOpenFeedback }: Props) {
  const { state, dispatch } = useContext(AppContext);
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Server-verified admin check (not based on browser role string)
  useEffect(() => {
    let cancelled = false;
    checkAdminAccess().then((ok) => {
      if (!cancelled) setIsAdmin(ok);
    });
    return () => { cancelled = true; };
  }, []);

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
    dispatch({ type: 'RESTORE_DEFAULT_GENERATION_SETTINGS' });
    close();
  }

  function handleLogoutClick() {
    close();
    onLogout?.();
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
        className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-200 light:hover:bg-gray-200 light:hover:text-gray-800"
      >
        <Menu className="h-3.5 w-3.5" />
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
                管理后台
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
    </div>
  );
}
