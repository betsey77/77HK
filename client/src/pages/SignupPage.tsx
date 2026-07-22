import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { resolveNextPath } from '../services/nextPath';
import AuthLayout from '../components/auth/AuthLayout';
import AuthNoticeDialog from '../components/auth/AuthNoticeDialog';

/**
 * Signup page — real Supabase Auth.
 * Validates: email format, password ≥ 6 chars, confirm match.
 * Shows email confirmation prompt when Supabase email verification is enabled.
 * Validates ?next= parameter via allowlist before passing to login.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupPage() {
  const { state, signup, clearError } = useAuth();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);

  // Validate ?next= via allowlist before passing to login
  const rawNext = new URLSearchParams(window.location.search).get('next');
  const safeNext = resolveNextPath(rawNext);
  const loginHref = safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : '/login';

  function clearAllErrors() {
    setLocalError(null);
    if (state.error) clearError();
  }

  function validate(): string | null {
    if (!EMAIL_RE.test(email.trim())) return '请输入有效的邮箱地址';
    if (password.length < 6) return '密码至少需要 6 位字符';
    if (password !== confirmPassword) return '两次输入的密码不一致';
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
    const result = await signup(email.trim(), password);
    if (result.needsConfirmation) {
      setNeedsConfirmation(true);
      setConfirmationDialogOpen(true);
    }
  }

  const error = localError || state.error;
  const canSubmit = email.trim().length > 0 && password.length > 0 && confirmPassword.length > 0 && !state.isLoading;

  const inputClass = isDark
    ? 'w-full bg-transparent outline-none text-base font-medium mt-2 pb-2 border-b transition-colors text-white placeholder:text-white/30 border-white/15 focus:border-emerald-400'
    : 'w-full bg-transparent outline-none text-base font-medium mt-2 pb-2 border-b transition-colors text-gray-900 placeholder:text-gray-400 border-gray-300 focus:border-orange-500';

  const labelClass = isDark
    ? 'text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60'
    : 'text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500';

  return (
    <AuthLayout>
      {needsConfirmation ? (
        <div className="space-y-6">
          <div>
            <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              请检查邮箱
            </h2>
            <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              请前往相应邮箱，并点击 Supabase 发送的验证链接完成注册。
              <span className="mt-1 block">验证邮件已发送至 <strong>{email}</strong></span>
            </p>
            <p className={`mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              如未看到邮件，请检查垃圾邮件。点击链接后会返回本站登录页。
            </p>
          </div>
          <a
            href={loginHref}
            className={`inline-block text-sm font-semibold transition-colors ${
              isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-orange-600 hover:text-orange-700'
            }`}
          >
            → 前往登录
          </a>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-7">
            {/* Email */}
            <div>
              <label htmlFor="signup-email" className={labelClass}>邮箱 Email</label>
              <input
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={e => { setEmail(e.target.value); clearAllErrors(); }}
                className={inputClass}
                placeholder="you@company.com"
                autoComplete="email"
                aria-describedby={error ? 'signup-error' : undefined}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" className={labelClass}>密码 Password</label>
              <input
                id="signup-password"
                type="password"
                required
                value={password}
                onChange={e => { setPassword(e.target.value); clearAllErrors(); }}
                className={inputClass}
                placeholder="至少 6 位字符"
                autoComplete="new-password"
                aria-describedby={error ? 'signup-error' : undefined}
              />
              <p className={`mt-1 text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                最少 6 位字符
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="signup-confirm-password" className={labelClass}>确认密码 Confirm Password</label>
              <input
                id="signup-confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); clearAllErrors(); }}
                className={inputClass}
                placeholder="再次输入密码"
                autoComplete="new-password"
                aria-describedby={error ? 'signup-error' : undefined}
              />
            </div>

            {/* Error */}
            {error && (
              <p id="signup-error" className="text-xs text-red-400 light:text-red-600 -mt-2" role="alert">
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
                {state.isLoading ? '创建中…' : '创建账户 Sign Up'}
              </span>
            </button>
          </form>

          {/* Divider */}
          <div className={`my-6 flex items-center gap-3 text-xs ${isDark ? 'text-white/50' : 'text-gray-400'}`}>
            <div className={`h-px flex-1 ${isDark ? 'bg-white/15' : 'bg-gray-300'}`} />
            <span>或</span>
            <div className={`h-px flex-1 ${isDark ? 'bg-white/15' : 'bg-gray-300'}`} />
          </div>

          {/* Login link */}
          <p className={`text-center text-xs leading-relaxed ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
            已有账户？{' '}
            <a
              href={loginHref}
              className={`font-semibold transition-colors ${
                isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-orange-600 hover:text-orange-700'
              }`}
            >
              登录
            </a>
          </p>
        </>
      )}
      <AuthNoticeDialog
        open={confirmationDialogOpen}
        variant="email"
        title="请验证注册邮箱"
        description={`请前往 ${email}，点击 Supabase 邮件链接完成验证并登录。\n如未看到邮件，请检查垃圾邮件。`}
        actionLabel="我知道了"
        onClose={() => setConfirmationDialogOpen(false)}
      />
    </AuthLayout>
  );
}
