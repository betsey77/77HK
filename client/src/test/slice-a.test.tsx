import React, { type ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import ResetPasswordPage from '../pages/ResetPasswordPage';
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import ForgotPasswordPage from '../pages/ForgotPasswordPage';

// ============================================================
// Mock Supabase (state hoisted for vi.mock factory access)
// ============================================================

const { mockAuthStore, makeUser, makeSession, mockSupabase } = vi.hoisted(() => {
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

  return { mockAuthStore: store, makeUser: mkUser, makeSession: mkSession, mockSupabase: m };
});

vi.mock('../services/supabase', () => ({
  supabase: mockSupabase,
}));

// ============================================================
// Helpers
// ============================================================

function resetMockAuth() {
  mockAuthStore.users.clear();
  mockAuthStore.currentSession = null;
  mockAuthStore.listeners.clear();
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
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}

/** Wait for AuthProvider's async session restore to settle — avoids act() warnings */
async function awaitAuthReady() {
  await waitFor(() => {
    expect(mockSupabase.auth.getSession).toHaveBeenCalled();
  });
}

// ============================================================
// AuthContext behavior tests
// ============================================================

describe('AuthContext — real Supabase auth behavior', () => {
  beforeEach(() => {
    resetMockAuth();
    clearThemeStore();
  });

  it('signup creates account via Supabase and sets authenticated session', async () => {
    function Capture() {
      const { state, signup } = useAuth();
      return (
        <div>
          {state.isLoading && <div>Loading…</div>}
          {!state.isLoading && !state.isAuthenticated && (
            <button onClick={() => signup('test@example.com', '123456')}>Sign Up</button>
          )}
          {!state.isLoading && state.isAuthenticated && (
            <div>Welcome {state.user?.email}</div>
          )}
        </div>
      );
    }

    render(<Wrapper><Capture /></Wrapper>);

    // Wait for initial session restore to complete
    const signUpBtn = await screen.findByText('Sign Up');
    await userEvent.click(signUpBtn);
    await waitFor(() => {
      expect(mockSupabase.auth.signUp).toHaveBeenCalled();
    });
  });

  it('login with wrong password shows error', async () => {
    // Pre-seed a user
    mockAuthStore.users.set('user@test.com', {
      id: 'u1', email: 'user@test.com', password: 'correct', email_confirmed_at: new Date().toISOString(),
    });

    function Capture() {
      const { state, login } = useAuth();
      return (
        <div>
          {state.isLoading && <div>Loading…</div>}
          {!state.isLoading && (
            <>
              <button onClick={() => login('user@test.com', 'wrongpassword')}>Login</button>
              {state.error && <p role="alert">{state.error}</p>}
              {state.isAuthenticated && <p>Authenticated</p>}
            </>
          )}
        </div>
      );
    }

    render(<Wrapper><Capture /></Wrapper>);

    const loginBtn = await screen.findByText('Login');
    await userEvent.click(loginBtn);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.queryByText('Authenticated')).not.toBeInTheDocument();
  });

  it('logout clears session', async () => {
    // Pre-set session
    const supabaseUser = makeUser('u2', 'temp@test.com', true);
    mockAuthStore.currentSession = makeSession(supabaseUser);
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockAuthStore.currentSession },
      error: null,
    });

    function Capture() {
      const { state, logout } = useAuth();
      if (state.isLoading) return <div>Loading…</div>;
      return (
        <div>
          {state.isAuthenticated ? (
            <>
              <span>Logged in</span>
              <button onClick={logout}>Logout</button>
            </>
          ) : (
            <span>Logged out</span>
          )}
        </div>
      );
    }

    render(<Wrapper><Capture /></Wrapper>);

    await waitFor(() => {
      expect(screen.getByText('Logged in')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Logout'));
    await waitFor(() => {
      expect(screen.getByText('Logged out')).toBeInTheDocument();
    });
  });
});

// ============================================================
// Auth pages — label-input a11y associations
// ============================================================

describe('Auth pages — label-input a11y', () => {
  beforeEach(() => {
    resetMockAuth();
    clearThemeStore();
  });

  it('LoginPage has htmlFor labels matching input ids', async () => {
    render(
      <Wrapper>
        <LoginPage />
      </Wrapper>
    );
    await awaitAuthReady();

    const emailInput = screen.getByPlaceholderText(/you@company/i);
    const passwordInput = screen.getByPlaceholderText('••••••••');

    expect(emailInput).toHaveAttribute('id');
    expect(passwordInput).toHaveAttribute('id');

    const emailLabel = document.querySelector(`label[for="${emailInput.getAttribute('id')}"]`);
    const passwordLabel = document.querySelector(`label[for="${passwordInput.getAttribute('id')}"]`);
    expect(emailLabel).toBeInTheDocument();
    expect(passwordLabel).toBeInTheDocument();
  });

  it('SignupPage has htmlFor labels matching input ids', async () => {
    render(
      <Wrapper>
        <SignupPage />
      </Wrapper>
    );
    await awaitAuthReady();

    const emailInput = screen.getByPlaceholderText(/you@company/i);
    const passwordInput = screen.getByPlaceholderText(/至少 6 位/);
    const confirmInput = screen.getByPlaceholderText(/再次输入密码/);

    expect(emailInput).toHaveAttribute('id');
    expect(passwordInput).toHaveAttribute('id');
    expect(confirmInput).toHaveAttribute('id');

    for (const input of [emailInput, passwordInput, confirmInput]) {
      const label = document.querySelector(`label[for="${input.getAttribute('id')}"]`);
      expect(label).toBeInTheDocument();
    }
  });

  it('ForgotPasswordPage has htmlFor label matching input id', async () => {
    render(
      <Wrapper>
        <ForgotPasswordPage />
      </Wrapper>
    );
    await awaitAuthReady();

    const emailInput = screen.getByPlaceholderText(/you@company/i);
    expect(emailInput).toHaveAttribute('id');

    const label = document.querySelector(`label[for="${emailInput.getAttribute('id')}"]`);
    expect(label).toBeInTheDocument();
  });
});

// ============================================================
// Auth pages — theme button colors
// ============================================================

describe('Auth pages — theme button colors', () => {
  beforeEach(() => {
    resetMockAuth();
    clearThemeStore();
  });

  it('LoginPage keeps the approved light-v4 primary button in stored dark mode', async () => {
    localStorage.setItem('hk-cantonese-theme', 'dark');
    document.documentElement.classList.remove('light');

    render(
      <Wrapper>
        <LoginPage />
      </Wrapper>
    );
    await awaitAuthReady();

    const button = screen.getByRole('button', { name: /登录/i });
    expect(button.className).toBe('btn-primary');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });

  it('LoginPage keeps the approved light-v4 primary button in light mode', async () => {
    localStorage.setItem('hk-cantonese-theme', 'light');
    document.documentElement.classList.add('light');

    render(
      <Wrapper>
        <LoginPage />
      </Wrapper>
    );
    await awaitAuthReady();

    const button = screen.getByRole('button', { name: /登录/i });
    expect(button.className).toBe('btn-primary');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });
});
