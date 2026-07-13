import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

// ============================================================
// Types
// ============================================================

export interface AuthState {
  user: User | null;
  session: Session | null;
  /** True when session exists AND email is confirmed */
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  /** The last auth event type, used to distinguish recovery from login */
  lastAuthEvent: AuthChangeEvent | null;
}

type AuthAction =
  | { type: 'RESTORE_SESSION'; payload: { user: User | null; session: Session | null } }
  | { type: 'AUTH_EVENT'; payload: { event: AuthChangeEvent; user: User; session: Session } }
  | { type: 'SIGNED_OUT' }
  | { type: 'AUTH_START' }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_SUCCESS' }
  | { type: 'CLEAR_ERROR' };

// ============================================================
// Reducer
// ============================================================

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'RESTORE_SESSION': {
      const { user, session } = action.payload;
      return {
        ...state,
        user,
        session,
        isAuthenticated: !!session && !!user?.email_confirmed_at,
        isLoading: false,
        lastAuthEvent: null,
      };
    }

    case 'AUTH_EVENT': {
      const { event, user, session } = action.payload;
      return {
        ...state,
        user,
        session,
        isAuthenticated: !!user.email_confirmed_at,
        isLoading: false,
        error: null,
        lastAuthEvent: event,
      };
    }

    case 'SIGNED_OUT':
      return {
        ...state,
        user: null,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        lastAuthEvent: null,
      };

    case 'AUTH_START':
      return { ...state, isLoading: true, error: null };

    case 'AUTH_FAILURE':
      return { ...state, isLoading: false, error: action.payload };

    case 'AUTH_SUCCESS':
      return { ...state, isLoading: false, error: null };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

// ============================================================
// Context
// ============================================================

export interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<{ success: boolean }>;
  signup: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  logout: () => Promise<void>;
  /** Returns true if the reset email was accepted by Supabase */
  resetPassword: (email: string) => Promise<boolean>;
  /** Returns true if the password was updated successfully */
  updatePassword: (newPassword: string) => Promise<boolean>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue>(null!);

// ============================================================
// Provider
// ============================================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    session: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    lastAuthEvent: null,
  });

  // ---- Session restore on mount + real-time auth listener ----
  useEffect(() => {
    let mounted = true;

    // Restore existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      dispatch({
        type: 'RESTORE_SESSION',
        payload: {
          user: session?.user ?? null,
          session,
        },
      });
    });

    // Listen for auth state changes — preserves event type for recovery detection
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return;
        if (session?.user) {
          dispatch({
            type: 'AUTH_EVENT',
            payload: { event, user: session.user, session },
          });
        } else {
          dispatch({ type: 'SIGNED_OUT' });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ---- Auth actions ----

  const login = async (email: string, password: string): Promise<{ success: boolean }> => {
    dispatch({ type: 'AUTH_START' });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = error.message === 'Invalid login credentials'
        ? '邮箱或密码错误'
        : error.message;
      dispatch({ type: 'AUTH_FAILURE', payload: msg });
      return { success: false };
    }

    // onAuthStateChange will fire; this is the optimistic path
    if (data.session) {
      dispatch({
        type: 'AUTH_EVENT',
        payload: { event: 'SIGNED_IN', user: data.user!, session: data.session },
      });
      return { success: true };
    }
    return { success: false };
  };

  const signup = async (email: string, password: string): Promise<{ needsConfirmation: boolean }> => {
    dispatch({ type: 'AUTH_START' });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      const msg = error.message.includes('already registered') || error.message.includes('already exists')
        ? '该邮箱已注册，请直接登录'
        : error.message;
      dispatch({ type: 'AUTH_FAILURE', payload: msg });
      return { needsConfirmation: false };
    }

    const needsConfirmation = !data.user?.email_confirmed_at;

    if (data.user && data.session) {
      dispatch({
        type: 'AUTH_EVENT',
        payload: { event: 'SIGNED_IN', user: data.user, session: data.session },
      });
    } else {
      // Email confirmation is enabled, so signUp can succeed without a session.
      // End the pending state while the user checks their inbox.
      dispatch({ type: 'AUTH_SUCCESS' });
    }

    return { needsConfirmation };
  };

  const logout = async () => {
    // onAuthStateChange will fire SIGNED_OUT
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message });
      return false;
    }

    // Success — reset email sent
    dispatch({ type: 'AUTH_SUCCESS' });
    return true;
  };

  const updatePassword = async (newPassword: string): Promise<boolean> => {
    dispatch({ type: 'AUTH_START' });
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      dispatch({ type: 'AUTH_FAILURE', payload: error.message });
      return false;
    }

    // Password updated — refresh session
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      dispatch({
        type: 'AUTH_EVENT',
        payload: { event: 'USER_UPDATED', user: session.user, session },
      });
    } else {
      dispatch({ type: 'SIGNED_OUT' });
    }
    return true;
  };

  const clearError = () => dispatch({ type: 'CLEAR_ERROR' });

  return (
    <AuthContext.Provider
      value={{ state, login, signup, logout, resetPassword, updatePassword, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
