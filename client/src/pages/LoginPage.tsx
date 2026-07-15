import { useState, type FormEvent } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import { useAuth } from '../context/AuthContext';
import { resolveNextPath } from '../services/nextPath';
import '../styles/LoginPageV4.css';

export default function LoginPage() {
  const { state, login, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const nextPath = resolveNextPath(new URLSearchParams(window.location.search).get('next'));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    const result = await login(email.trim(), password);
    if (result.success) window.location.href = nextPath ?? '/app';
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
    <AuthLayout variant="login-v4">
      <form onSubmit={handleSubmit} autoComplete="on" noValidate>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) => handleEmailChange(event.target.value)}
            required
            aria-label="邮箱 Email"
            aria-describedby={state.error ? 'login-error' : undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => handlePasswordChange(event.target.value)}
            required
            aria-label="密码 Password"
            aria-describedby={state.error ? 'login-error' : undefined}
          />
        </div>
        <div className="row-end"><a href="/forgot-password" aria-label="忘记密码 Forgot password?">Forgot password?</a></div>
        {state.error && <p id="login-error" role="alert" className="login-error">{state.error}</p>}
        <button type="submit" className="btn-primary" disabled={!canSubmit} aria-label={state.isLoading ? '登录中' : '登录'}>
          <span>{state.isLoading ? 'Signing in…' : 'Sign in'}</span>
        </button>
      </form>
      <div className="divider" aria-hidden="true">or</div>
      <a className="btn-signup" href="/signup">
        <span className="logo-mini" aria-hidden="true"><img src="/brand/77-logo.png" alt="" /></span>
        Sign up
      </a>
      <p className="foot-links">还没有账户？<a href="/signup">创建账户</a><br />登录遇到问题？<a href="/forgot-password">找回密码</a></p>
    </AuthLayout>
  );
}
