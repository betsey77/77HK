/**
 * E2E-only AuthContext fixture — authenticated local user, no network.
 * Loaded only via client/vite.e2e.config.ts resolve alias.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lastAuthEvent: AuthChangeEvent | null;
}

export interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<{ success: boolean }>;
  signup: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  clearError: () => void;
}

const FIXTURE_USER = {
  id: 'e2e-local-user',
  email: 'e2e@example.invalid',
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  app_metadata: { provider: 'e2e-local', providers: ['e2e-local'] },
  user_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
  phone: '',
  identities: [],
} as unknown as User;

const FIXTURE_SESSION = {
  access_token: 'e2e-local-not-a-jwt',
  refresh_token: 'e2e-local-not-a-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: FIXTURE_USER,
} as unknown as Session;

export const AuthContext = createContext<AuthContextValue>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const isSignupFixture = window.location.pathname === '/signup';
  const [state, setState] = useState<AuthState>(() => isSignupFixture
    ? {
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        lastAuthEvent: null,
      }
    : {
        user: FIXTURE_USER,
        session: FIXTURE_SESSION,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        lastAuthEvent: null,
      });

  const login = useCallback(async () => {
    throw new Error('E2E local fixture: login() is disabled (mock shell only)');
  }, []);

  const signup = useCallback(async () => {
    if (!isSignupFixture) {
      throw new Error('E2E local fixture: signup() is disabled outside /signup');
    }
    setState((current) => ({ ...current, isLoading: true, error: null }));
    await Promise.resolve();
    setState((current) => ({ ...current, isLoading: false }));
    return { needsConfirmation: true };
  }, [isSignupFixture]);

  const logout = useCallback(async () => {
    setState({
      user: null,
      session: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      lastAuthEvent: null,
    });
  }, []);

  const resetPassword = useCallback(async () => {
    throw new Error('E2E local fixture: resetPassword() is disabled');
  }, []);

  const updatePassword = useCallback(async () => {
    throw new Error('E2E local fixture: updatePassword() is disabled');
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const value = useMemo(
    () => ({
      state,
      login,
      signup,
      logout,
      resetPassword,
      updatePassword,
      clearError,
    }),
    [state, login, signup, logout, resetPassword, updatePassword, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
