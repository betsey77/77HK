import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { resolveNextPath } from '../services/nextPath';
import AuthLayout from '../components/auth/AuthLayout';

/**
 * Login page — real Supabase Auth.
 * Visual structure ported from 总览/src/routes/login.tsx.
 * Supports ?next= parameter for post-login redirect (whitelist only).
 */

export default function LoginPage() {
  const { state, login, clearError } = useAuth();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Resolve safe post-login destination from URL params
  const nextPath = resolveNextPath(new URLSearchParams(window.location.search).get('next'));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    const result = await login(email.trim(), password);
    if (result.success) {
      window.location.href = nextPath ?? '/app';
    }
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    if (state.error) clearError();
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (state.error) clearError();
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !state.isLoading;

  return (
    <AuthLayout>
      <div className="mb-7">
        <h2 className={`text-xl font-semibold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
          欢迎回来
        </h2>
        <p className={`mt-1.5 text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          登录账户，继续你的港式文案工作流
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-7">
        {/* Email */}
        <div>
          <label htmlFor="login-email" className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
            邮箱 Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={e => handleEmailChange(e.target.value)}
            className={`w-full bg-transparent outline-none text-base font-medium mt-2 pb-2 border-b transition-colors ${
              isDark
                ? 'text-white placeholder:text-white/30 border-white/15 focus:border-emerald-400'
                : 'text-gray-900 placeholder:text-gray-400 border-gray-300 focus:border-orange-500'
            }`}
            placeholder="you@company.com"
            autoComplete="email"
            aria-describedby={state.error ? 'login-error' : undefined}
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="login-password" className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
            密码 Password
          </label>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={e => handlePasswordChange(e.target.value)}
            className={`w-full bg-transparent outline-none text-base font-medium mt-2 pb-2 border-b transition-colors ${
              isDark
                ? 'text-white placeholder:text-white/30 border-white/15 focus:border-emerald-400'
                : 'text-gray-900 placeholder:text-gray-400 border-gray-300 focus:border-orange-500'
            }`}
            placeholder="••••••••"
            autoComplete="current-password"
            aria-describedby={state.error ? 'login-error' : undefined}
          />
        </div>

        {/* Forgot password link */}
        <div className="flex justify-end -mt-3">
          <a
            href="/forgot-password"
            className={`text-xs font-medium transition-colors ${
              isDark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            忘记密码？
          </a>
        </div>

        {/* Error */}
        {state.error && (
          <p id="login-error" className="text-xs text-red-400 light:text-red-600 -mt-2" role="alert">
            {state.error}
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
            {state.isLoading ? '登录中…' : '登录 Sign in'}
          </span>
        </button>
      </form>

      {/* Divider */}
      <div className={`my-6 flex items-center gap-3 text-xs ${isDark ? 'text-white/50' : 'text-gray-400'}`}>
        <div className={`h-px flex-1 ${isDark ? 'bg-white/15' : 'bg-gray-300'}`} />
        <span>或</span>
        <div className={`h-px flex-1 ${isDark ? 'bg-white/15' : 'bg-gray-300'}`} />
      </div>

      {/* Create account link */}
      <p className={`text-center text-xs leading-relaxed ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
        还没有账户？{' '}
        <a
          href="/signup"
          className={`font-semibold transition-colors ${
            isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-orange-600 hover:text-orange-700'
          }`}
        >
          创建账户
        </a>
      </p>

    </AuthLayout>
  );
}
