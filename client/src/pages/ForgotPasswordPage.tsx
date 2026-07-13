import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import AuthLayout from '../components/auth/AuthLayout';

/**
 * Forgot password page — real Supabase Auth.
 * Sends a password reset email via Supabase.
 * Shows success message after submission (avoids email enumeration).
 */

export default function ForgotPasswordPage() {
  const { state, resetPassword } = useAuth();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    const ok = await resetPassword(email.trim());
    if (ok) setSubmitted(true);
    // On failure, state.error is already set — form stays visible
  }

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
            忘记密码
          </h2>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            输入注册邮箱，我们将发送重置链接
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-7">
            <div>
              <label htmlFor="forgot-email" className={labelClass}>邮箱 Email</label>
              <input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>

            {/* Error */}
            {state.error && (
              <p className="text-xs text-red-400 light:text-red-600 -mt-2" role="alert">
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={!email.trim() || state.isLoading}
              className={`relative w-full rounded-2xl py-4 text-sm font-semibold overflow-hidden transition-all duration-200 ${
                isDark
                  ? 'bg-emerald-500 text-gray-950 ring-1 ring-white/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_12px_30px_-8px_rgba(16,185,129,0.55)] hover:bg-emerald-400 active:scale-[0.98]'
                  : 'bg-orange-500 text-white ring-1 ring-orange-400/30 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.35),0_12px_30px_-8px_rgba(249,115,22,0.45)] hover:bg-orange-600 active:scale-[0.98]'
              } disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100`}
            >
              <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/25 via-transparent to-black/20" />
              <span className="relative">
                {state.isLoading ? '发送中…' : '发送重置链接'}
              </span>
            </button>
          </form>
        ) : (
          <div className={`rounded-lg border px-4 py-3 ${
            isDark
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-green-300 bg-green-50'
          }`}>
            <p className={`text-sm font-medium ${isDark ? 'text-emerald-400' : 'text-green-700'}`}>
              重置链接已发送
            </p>
            <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              如果该邮箱已注册，一封包含密码重置链接的邮件将发送到你的邮箱。请检查收件箱。
            </p>
            {state.error && (
              <p className={`mt-2 text-xs ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                {state.error}
              </p>
            )}
          </div>
        )}

        {/* Back to login */}
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
      </div>
    </AuthLayout>
  );
}
