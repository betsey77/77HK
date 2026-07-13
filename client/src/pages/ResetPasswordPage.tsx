import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AuthLayout from '../components/auth/AuthLayout';

/**
 * Reset password page — real Supabase Auth.
 *
 * This page is reached via the reset password link sent by email.
 * Supabase puts the recovery token in the URL hash; the client picks it up
 * via `detectSessionInUrl`, and `onAuthStateChange` fires `PASSWORD_RECOVERY`.
 *
 * **Security**: only accepts a session that arrived via PASSWORD_RECOVERY.
 * A normal login session navigating to /reset-password will be rejected.
 */

export default function ResetPasswordPage() {
  const { state, updatePassword, clearError } = useAuth();
  const { isDark } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);

  // Detect PASSWORD_RECOVERY event — this page only works with a recovery session.
  // `lastAuthEvent` is set by onAuthStateChange and preserved in reducer.
  // We also check on mount in case the event already fired before this component rendered.
  useEffect(() => {
    if (state.lastAuthEvent === 'PASSWORD_RECOVERY' && state.session) {
      setRecoveryConfirmed(true);
    }
    // Also handle the case where detectSessionInUrl already set the session
    // before the component mounted — lastAuthEvent would be PASSWORD_RECOVERY
    // from the initial RESTORE_SESSION path. For safety, also check if we have
    // a session but no event yet (Supabase may fire it later).
  }, [state.lastAuthEvent, state.session]);

  function clearAllErrors() {
    setLocalError(null);
    if (state.error) clearError();
  }

  function validate(): string | null {
    if (newPassword.length < 6) return '新密码至少需要 6 位字符';
    if (newPassword !== confirmPassword) return '两次输入的密码不一致';
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    clearAllErrors();
    const validationError = validate();
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    const ok = await updatePassword(newPassword);
    if (ok) {
      setSuccess(true);
    }
    // On failure, state.error is already set by the reducer; form stays visible.
  }

  const error = localError || state.error;
  const canSubmit = newPassword.length > 0 && confirmPassword.length > 0 && !state.isLoading && recoveryConfirmed;
  const showExpired = !recoveryConfirmed && !state.isLoading;
  const hasRecoverySession = recoveryConfirmed && state.session;

  const inputClass = isDark
    ? 'w-full bg-transparent outline-none text-base font-medium mt-2 pb-2 border-b transition-colors text-white placeholder:text-white/30 border-white/15 focus:border-emerald-400'
    : 'w-full bg-transparent outline-none text-base font-medium mt-2 pb-2 border-b transition-colors text-gray-900 placeholder:text-gray-400 border-gray-300 focus:border-orange-500';

  const labelClass = isDark
    ? 'text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60'
    : 'text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500';

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            重置密码
          </h2>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            输入新密码以重置
          </p>
        </div>

        {showExpired ? (
          <div className={`rounded-lg border px-4 py-3 ${
            isDark
              ? 'border-amber-500/30 bg-amber-500/10'
              : 'border-amber-300 bg-amber-50'
          }`}>
            <p className={`text-sm font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
              链接已过期或无效
            </p>
            <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              请重新申请密码重置。
            </p>
            <a
              href="/forgot-password"
              className={`mt-3 inline-block text-sm font-semibold transition-colors ${
                isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-orange-600 hover:text-orange-700'
              }`}
            >
              → 重新申请重置
            </a>
          </div>
        ) : !success ? (
          <form onSubmit={handleSubmit} className="space-y-7">
            {/* New Password */}
            <div>
              <label htmlFor="reset-new-password" className={labelClass}>新密码 New Password</label>
              <input
                id="reset-new-password"
                type="password"
                required
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); clearAllErrors(); }}
                className={inputClass}
                placeholder="至少 6 位字符"
                autoComplete="new-password"
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="reset-confirm-password" className={labelClass}>确认新密码 Confirm Password</label>
              <input
                id="reset-confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); clearAllErrors(); }}
                className={inputClass}
                placeholder="再次输入新密码"
                autoComplete="new-password"
                aria-describedby={error ? 'reset-error' : undefined}
              />
            </div>

            {/* Error */}
            {error && (
              <p id="reset-error" className="text-xs text-red-400 light:text-red-600 -mt-2" role="alert">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className={`relative w-full rounded-2xl py-4 text-sm font-semibold overflow-hidden transition-all duration-200 ${
                isDark
                  ? 'bg-emerald-500 text-gray-950 ring-1 ring-white/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_12px_30px_-8px_rgba(16,185,129,0.55)] hover:bg-emerald-400 active:scale-[0.98]'
                  : 'bg-orange-500 text-white ring-1 ring-orange-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_12px_30px_-8px_rgba(249,115,22,0.45)] hover:bg-orange-600 active:scale-[0.98]'
              } disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100`}
            >
              <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/25 via-transparent to-black/20" />
              <span className="relative">
                {state.isLoading ? '重置中…' : '重置密码'}
              </span>
            </button>
          </form>
        ) : (
          <div className={`rounded-lg border px-4 py-3 ${isDark ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-green-300 bg-green-50'}`}>
            <p className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-green-700'}`}>
              密码已重置
            </p>
            <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              你的密码已更新。请使用新密码登录。
            </p>
            <a
              href="/login"
              className={`mt-3 inline-block text-sm font-semibold transition-colors ${
                isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-orange-600 hover:text-orange-700'
              }`}
            >
              → 前往登录
            </a>
          </div>
        )}

        {/* Back to login */}
        {!success && (
          <p className={`text-center text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
            <a
              href="/login"
              className={`font-semibold transition-colors ${
                isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-orange-600 hover:text-orange-700'
              }`}
            >
              ← 返回登录
            </a>
          </p>
        )}
      </div>
    </AuthLayout>
  );
}
