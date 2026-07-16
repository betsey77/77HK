/**
 * E2E-only Supabase fixture (local mock shell).
 * Loaded only via client/vite.e2e.config.ts resolve alias.
 * Must never perform network I/O or reference production project identifiers.
 */

const FIXTURE_USER_ID = 'e2e-local-user';
const FIXTURE_EMAIL = 'e2e@example.invalid';

function e2eLocalError(method: string): Error {
  return new Error(
    `E2E local fixture: unexpected supabase.${method}() — remote Supabase is disabled in workbench shell smoke`,
  );
}

const fixtureUser = {
  id: FIXTURE_USER_ID,
  email: FIXTURE_EMAIL,
  email_confirmed_at: '2026-01-01T00:00:00.000Z',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  app_metadata: { provider: 'e2e-local', providers: ['e2e-local'] },
  user_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
  phone: '',
  identities: [],
};

/** Not a JWT — clearly invalid for any real server. */
const fixtureSession = {
  access_token: 'e2e-local-not-a-jwt',
  refresh_token: 'e2e-local-not-a-refresh',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: fixtureUser,
};

type AuthListener = (event: string, session: typeof fixtureSession | null) => void;
const listeners = new Set<AuthListener>();
let currentSession: typeof fixtureSession | null = fixtureSession;

export const supabase = {
  auth: {
    getSession: async () => ({
      data: { session: currentSession },
      error: null,
    }),
    getUser: async () => ({
      data: { user: currentSession?.user ?? null },
      error: currentSession ? null : { message: 'E2E local fixture: no session' },
    }),
    onAuthStateChange: (cb: AuthListener) => {
      listeners.add(cb);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              listeners.delete(cb);
            },
          },
        },
      };
    },
    signOut: async () => {
      currentSession = null;
      listeners.forEach((cb) => cb('SIGNED_OUT', null));
      return { error: null };
    },
    signInWithPassword: async () => {
      throw e2eLocalError('auth.signInWithPassword');
    },
    signUp: async () => {
      throw e2eLocalError('auth.signUp');
    },
    resetPasswordForEmail: async () => {
      throw e2eLocalError('auth.resetPasswordForEmail');
    },
    updateUser: async () => {
      throw e2eLocalError('auth.updateUser');
    },
  },
  from: () => {
    throw e2eLocalError('from');
  },
  channel: () => {
    throw e2eLocalError('channel');
  },
  rpc: () => {
    throw e2eLocalError('rpc');
  },
};

/** Test/helpers: restore signed-in fixture (memory only). */
export function __e2eResetSession() {
  currentSession = fixtureSession;
}

export const __E2E_FIXTURE_META = {
  userId: FIXTURE_USER_ID,
  email: FIXTURE_EMAIL,
  kind: 'local-mock-shell',
} as const;
