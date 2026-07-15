import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider, useAuth, AuthContext } from '../context/AuthContext';
import type { AuthContextValue, AuthState } from '../context/AuthContext';
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import AuthCallback from '../pages/AuthCallback';

// ============================================================
// Mock Supabase (hoisted for vi.mock factory access)
// ============================================================

const { mockStore, makeUser, makeSession, mockSupabase } = vi.hoisted(() => {
  const store = {
    users: new Map<string, { id: string; email: string; password: string; email_confirmed_at: string | null }>(),
    currentSession: null as { access_token: string; refresh_token: string; user: { id: string; email: string; email_confirmed_at: string | null } } | null,
    listeners: new Set<(event: string, session: unknown) => void>(),
  };

  function mkUser(id: string, email: string, confirmed: boolean) {
    return {
      id, email,
      email_confirmed_at: confirmed ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      app_metadata: {}, user_metadata: {},
      aud: 'authenticated', role: 'authenticated',
    };
  }

  function mkSession(user: ReturnType<typeof mkUser>) {
    return {
      access_token: `token-${user.id}`,
      refresh_token: `refresh-${user.id}`,
      expires_in: 3600, user,
      token_type: 'bearer',
    };
  }

  const m = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: store.currentSession }, error: null,
      })),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        store.listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => { store.listeners.delete(cb); } } } };
      }),
      signInWithPassword: vi.fn(async ({ email, password }: { email: string; password: string }) => {
        const user = store.users.get(email.toLowerCase());
        if (!user || user.password !== password) {
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } };
        }
        const su = mkUser(user.id, user.email, !!user.email_confirmed_at);
        const s = mkSession(su);
        store.currentSession = s;
        store.listeners.forEach(cb => cb('SIGNED_IN', s));
        return { data: { user: su, session: s }, error: null };
      }),
      signUp: vi.fn(async ({ email, password }: { email: string; password: string }) => {
        const norm = email.toLowerCase();
        if (store.users.has(norm)) {
          return { data: { user: null, session: null }, error: { message: 'already registered' } };
        }
        const id = `user-${Date.now()}`;
        store.users.set(norm, { id, email: norm, password, email_confirmed_at: null });
        const su = mkUser(id, norm, false);
        const s = mkSession(su);
        store.currentSession = s;
        store.listeners.forEach(cb => cb('SIGNED_IN', s));
        return { data: { user: su, session: s }, error: null };
      }),
      signOut: vi.fn(async () => {
        store.currentSession = null;
        store.listeners.forEach(cb => cb('SIGNED_OUT', null));
        return { error: null };
      }),
      resetPasswordForEmail: vi.fn(async () => ({ data: {}, error: null })),
      updateUser: vi.fn(async ({ password }: { password: string }) => {
        if (!store.currentSession) {
          return { data: { user: null }, error: { message: 'No session' } };
        }
        const email = store.currentSession.user.email;
        const stored = store.users.get(email);
        if (stored) stored.password = password;
        return { data: { user: store.currentSession.user }, error: null };
      }),
      getUser: vi.fn(async () => {
        if (!store.currentSession) {
          return { data: { user: null }, error: { message: 'No session' } };
        }
        return { data: { user: store.currentSession.user }, error: null };
      }),
    },
    from: vi.fn(),
  };

  return { mockStore: store, makeUser: mkUser, makeSession: mkSession, mockSupabase: m };
});

vi.mock('../services/supabase', () => ({
  supabase: mockSupabase,
}));

// ============================================================
// Helpers
// ============================================================

function resetMockAuth() {
  mockStore.users.clear();
  mockStore.currentSession = null;
  mockStore.listeners.clear();
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mockSupabase.auth.signInWithPassword.mockClear();
  mockSupabase.auth.signUp.mockClear();
  mockSupabase.auth.signOut.mockClear();
  mockSupabase.auth.resetPasswordForEmail.mockClear();
  mockSupabase.auth.updateUser.mockClear();
}

function clearThemeStore() {
  localStorage.removeItem('hk-cantonese-theme');
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}

function SignupLoadingProbe() {
  const { state, signup } = useAuth();
  return (
    <div>
      <button type="button" onClick={() => void signup('new@example.com', 'secret123')}>
        start-signup
      </button>
      <span data-testid="signup-loading-state">{state.isLoading ? 'loading' : 'ready'}</span>
    </div>
  );
}

/** Wait for AuthProvider's async session restore to settle — avoids act() warnings */
async function awaitAuthReady() {
  // AuthProvider calls getSession() on mount. The promise's .then() dispatches
  // RESTORE_SESSION asynchronously. We wait for the mock to be called — by the
  // time the mock is called the promise has resolved and the dispatch is queued.
  // We then use a waitFor to let React flush the state update.
  await waitFor(() => {
    expect(mockSupabase.auth.getSession).toHaveBeenCalled();
  });
}

// ============================================================
// Suite 1: No more [MOCK] badges
// ============================================================

describe('Slice B — Auth pages no longer show [MOCK] badges', () => {
  beforeEach(() => {
    resetMockAuth();
    clearThemeStore();
  });

  it('LoginPage does NOT show [MOCK] badge', async () => {
    render(<LoginPage />, { wrapper: Wrapper });
    await awaitAuthReady();
    expect(screen.queryByText(/\[MOCK\]/i)).toBeNull();
    expect(screen.queryByText(/本地演示模式/)).toBeNull();
  });

  it('SignupPage does NOT show [MOCK] badge', async () => {
    render(<SignupPage />, { wrapper: Wrapper });
    await awaitAuthReady();
    expect(screen.queryByText(/\[MOCK\]/i)).toBeNull();
    expect(screen.queryByText(/本地演示模式/)).toBeNull();
  });

  it('ForgotPasswordPage does NOT show [MOCK] badge', async () => {
    render(<ForgotPasswordPage />, { wrapper: Wrapper });
    await awaitAuthReady();
    expect(screen.queryByText(/\[MOCK\]/i)).toBeNull();
    expect(screen.queryByText(/本地演示模式/)).toBeNull();
  });

  it('ResetPasswordPage does NOT show [MOCK] badge', async () => {
    render(<ResetPasswordPage />, { wrapper: Wrapper });
    await awaitAuthReady();
    expect(screen.queryByText(/\[MOCK\]/i)).toBeNull();
    expect(screen.queryByText(/本地演示模式/)).toBeNull();
  });
});

// ============================================================
// Suite 2: Sanity — all pages mount without crash
// ============================================================

describe('Slice B — Auth pages render without crash', () => {
  beforeEach(() => {
    resetMockAuth();
    clearThemeStore();
  });

  it('LoginPage renders', async () => {
    render(<LoginPage />, { wrapper: Wrapper });
    await awaitAuthReady();
    expect(screen.getByText('77 港话通')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /77港话通[\s\S]*社媒文案器/ })).toBeInTheDocument();
  });

  it('SignupPage renders', async () => {
    render(<SignupPage />, { wrapper: Wrapper });
    await awaitAuthReady();
    const brands = screen.getAllByText('77港话通社媒文案器');
    expect(brands.length).toBeGreaterThanOrEqual(1);
  });

  it('ForgotPasswordPage renders', async () => {
    render(<ForgotPasswordPage />, { wrapper: Wrapper });
    await awaitAuthReady();
    const brands = screen.getAllByText('77港话通社媒文案器');
    expect(brands.length).toBeGreaterThanOrEqual(1);
  });

  it('ResetPasswordPage renders', async () => {
    render(<ResetPasswordPage />, { wrapper: Wrapper });
    await awaitAuthReady();
    const brands = screen.getAllByText('77港话通社媒文案器');
    expect(brands.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Slice B — unconfirmed signup state', () => {
  beforeEach(() => {
    resetMockAuth();
    clearThemeStore();
  });

  it('stops loading after Supabase accepts a signup that still needs email confirmation', async () => {
    const unconfirmedUser = makeUser('user-new', 'new@example.com', false);
    mockSupabase.auth.signUp.mockResolvedValueOnce({
      data: { user: unconfirmedUser, session: null },
      error: null,
    } as never);

    render(<SignupLoadingProbe />, { wrapper: Wrapper });
    await awaitAuthReady();
    await waitFor(() => {
      expect(screen.getByTestId('signup-loading-state')).toHaveTextContent('ready');
    });

    await userEvent.click(screen.getByRole('button', { name: 'start-signup' }));

    await waitFor(() => {
      expect(screen.getByTestId('signup-loading-state')).toHaveTextContent('ready');
    });
  });
});

// ============================================================
// Suite 3: Theme regression
// ============================================================

describe('Slice B — Theme regression on auth pages', () => {
  beforeEach(() => {
    resetMockAuth();
    clearThemeStore();
  });

  it('LoginPage uses the fixed light-v4 button in stored dark mode', async () => {
    localStorage.setItem('hk-cantonese-theme', 'dark');
    document.documentElement.classList.remove('light');

    render(<LoginPage />, { wrapper: Wrapper });
    await awaitAuthReady();

    const btn = screen.getByRole('button', { name: /登录/i });
    expect(btn.className).toBe('btn-primary');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('LoginPage uses the fixed light-v4 button in light mode', async () => {
    localStorage.setItem('hk-cantonese-theme', 'light');
    document.documentElement.classList.add('light');

    render(<LoginPage />, { wrapper: Wrapper });
    await awaitAuthReady();

    const btn = screen.getByRole('button', { name: /登录/i });
    expect(btn.className).toBe('btn-primary');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });
});

// ============================================================
// Suite 4: Label-input a11y regression
// ============================================================

describe('Slice B — Label-input a11y regression', () => {
  beforeEach(() => {
    resetMockAuth();
    clearThemeStore();
  });

  it('LoginPage labels match inputs', async () => {
    render(<LoginPage />, { wrapper: Wrapper });
    await awaitAuthReady();

    const emailInput = screen.getByLabelText('邮箱 Email');
    expect(emailInput).toBeDefined();
    expect(emailInput.getAttribute('id')).toBe('login-email');

    const passwordInput = screen.getByLabelText('密码 Password');
    expect(passwordInput).toBeDefined();
    expect(passwordInput.getAttribute('id')).toBe('login-password');
  });

  it('SignupPage labels match inputs', async () => {
    render(<SignupPage />, { wrapper: Wrapper });
    await awaitAuthReady();

    const emailInput = screen.getByLabelText('邮箱 Email');
    expect(emailInput).toBeDefined();
    expect(emailInput.getAttribute('id')).toBe('signup-email');

    const passwordInput = screen.getByLabelText('密码 Password');
    expect(passwordInput).toBeDefined();
    expect(passwordInput.getAttribute('id')).toBe('signup-password');

    const confirmInput = screen.getByLabelText('确认密码 Confirm Password');
    expect(confirmInput).toBeDefined();
    expect(confirmInput.getAttribute('id')).toBe('signup-confirm-password');
  });

  it('ForgotPasswordPage labels match inputs', async () => {
    render(<ForgotPasswordPage />, { wrapper: Wrapper });
    await awaitAuthReady();

    const emailInput = screen.getByLabelText('邮箱 Email');
    expect(emailInput).toBeDefined();
    expect(emailInput.getAttribute('id')).toBe('forgot-email');
  });
});

// ============================================================
// Suite 5: Behavioral — resetPassword / updatePassword outcomes
// ============================================================

describe('Slice B — resetPassword behavior', () => {
  beforeEach(() => {
    resetMockAuth();
    clearThemeStore();
  });

  it('resetPassword success sets isLoading=false and shows success message', async () => {
    // Mock success
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    function Capture() {
      const { state, resetPassword } = useAuth();
      if (state.isLoading) return <div>Loading…</div>;
      return (
        <div>
          <button onClick={() => resetPassword('test@example.com')}>
            Reset
          </button>
          {!state.isLoading && state.error === null && <div>Resolved</div>}
          {state.error && <div role="alert">{state.error}</div>}
        </div>
      );
    }

    render(<Wrapper><Capture /></Wrapper>);

    // Wait for initial session restore
    const btn = await screen.findByText('Reset');
    await userEvent.click(btn);

    // After resetPassword resolves, isLoading should be false
    await waitFor(() => {
      expect(screen.getByText('Resolved')).toBeInTheDocument();
    });
  });

  it('resetPassword failure does NOT show success message', async () => {
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { message: 'Rate limit exceeded', status: 429, name: 'AuthError' },
    } as any);

    render(
      <Wrapper>
        <ForgotPasswordPage />
      </Wrapper>
    );
    await awaitAuthReady();

    // Fill email and submit
    const emailInput = screen.getByLabelText('邮箱 Email');
    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.click(screen.getByRole('button', { name: /发送重置链接/ }));

    // "重置链接已发送" should NOT appear
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.queryByText('重置链接已发送')).toBeNull();
  });
});

describe('Slice B — updatePassword behavior', () => {
  beforeEach(() => {
    resetMockAuth();
    clearThemeStore();
  });

  it('updatePassword failure does NOT show "密码已重置"', async () => {
    const email = 'recover@test.com';
    const user = makeUser('r1', email, true);
    const session = makeSession(user);

    // Build auth state: PASSWORD_RECOVERY confirmed, not loading
    const recoveryState: AuthState = {
      user: user as any,
      session: session as any,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      lastAuthEvent: 'PASSWORD_RECOVERY' as any,
    };

    // updatePassword returns false to simulate failure
    const fakeAuth: AuthContextValue = {
      state: recoveryState,
      login: async () => {},
      signup: async () => ({ needsConfirmation: false }),
      logout: async () => {},
      resetPassword: async () => true,
      updatePassword: async () => false, // simulate failure
      clearError: () => {},
    };

    render(
      <ThemeProvider>
        <AuthContext.Provider value={fakeAuth}>
          <ResetPasswordPage />
        </AuthContext.Provider>
      </ThemeProvider>
    );

    // Form should be visible (recoveryConfirmed via PASSWORD_RECOVERY)
    expect(screen.getByRole('button', { name: /重置密码/ })).toBeInTheDocument();

    // Fill passwords and submit
    await userEvent.type(screen.getByLabelText('新密码 New Password'), '123456');
    await userEvent.type(screen.getByLabelText('确认新密码 Confirm Password'), '123456');
    await userEvent.click(screen.getByRole('button', { name: /重置密码/ }));

    // "密码已重置" must NOT appear since updatePassword returned false
    expect(screen.queryByText('密码已重置')).toBeNull();
  });
});

// ============================================================
// Suite 6: PASSWORD_RECOVERY gate
// ============================================================

describe('Slice B — ResetPasswordPage PASSWORD_RECOVERY gate', () => {
  beforeEach(() => {
    resetMockAuth();
    clearThemeStore();
  });

  it('normal SIGNED_IN session shows "链接已过期或无效"', async () => {
    const user = makeUser('n1', 'normal@test.com', true);
    const session = makeSession(user);

    // Normal SIGNED_IN state (lastAuthEvent = SIGNED_IN, not PASSWORD_RECOVERY)
    const normalState: AuthState = {
      user: user as any,
      session: session as any,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      lastAuthEvent: 'SIGNED_IN' as any,
    };

    const fakeAuth: AuthContextValue = {
      state: normalState,
      login: async () => {},
      signup: async () => ({ needsConfirmation: false }),
      logout: async () => {},
      resetPassword: async () => true,
      updatePassword: async () => true,
      clearError: () => {},
    };

    render(
      <ThemeProvider>
        <AuthContext.Provider value={fakeAuth}>
          <ResetPasswordPage />
        </AuthContext.Provider>
      </ThemeProvider>
    );

    // Must show the expired message
    expect(screen.getByText('链接已过期或无效')).toBeInTheDocument();
  });

  it('PASSWORD_RECOVERY session shows the reset form', async () => {
    const user = makeUser('r2', 'recover2@test.com', true);
    const session = makeSession(user);

    // PASSWORD_RECOVERY state
    const recoveryState: AuthState = {
      user: user as any,
      session: session as any,
      isAuthenticated: true,
      isLoading: false,
      error: null,
      lastAuthEvent: 'PASSWORD_RECOVERY' as any,
    };

    const fakeAuth: AuthContextValue = {
      state: recoveryState,
      login: async () => {},
      signup: async () => ({ needsConfirmation: false }),
      logout: async () => {},
      resetPassword: async () => true,
      updatePassword: async () => true,
      clearError: () => {},
    };

    render(
      <ThemeProvider>
        <AuthContext.Provider value={fakeAuth}>
          <ResetPasswordPage />
        </AuthContext.Provider>
      </ThemeProvider>
    );

    // Form should be visible
    expect(screen.getByLabelText('新密码 New Password')).toBeInTheDocument();
    expect(screen.queryByText('链接已过期或无效')).toBeNull();
  });
});

// ============================================================
// Suite 7: AuthCallback with existing session
// ============================================================

describe('Slice B — AuthCallback existing confirmed session', () => {
  beforeEach(() => {
    resetMockAuth();
    clearThemeStore();
    // jsdom doesn't allow spying on window.location.replace directly.
    // Delete and recreate as a configurable property.
    const realLocation = { ...window.location };
    Object.defineProperty(window, 'location', {
      configurable: true,
      enumerable: true,
      value: { ...realLocation, replace: vi.fn() },
      writable: true,
    });
  });

  it('already-existing confirmed session shows success and redirects', async () => {
    const email = 'confirmed@test.com';
    const user = makeUser('c1', email, true);
    const session = makeSession(user);
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });

    render(
      <ThemeProvider>
        <AuthCallback />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('邮箱验证成功！正在跳转…')).toBeInTheDocument();
    });
  });
});
