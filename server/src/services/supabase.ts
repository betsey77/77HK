import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized so dotenv can load before first access.
// Module-level code must not throw — callers may import this module
// before dotenv.config() runs (e.g. during build or tooling).
function getConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in server .env'
    );
  }
  return { url, key };
}

let _supabase: SupabaseClient | undefined;

/**
 * Base Supabase client — uses publishable key (anon role).
 * Unauthenticated: only usable for public operations.
 * NEVER uses service_role or secret key.
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const { url, key } = getConfig();
    _supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _supabase;
}

/**
 * Create a user-scoped Supabase client.
 *
 * Sets the user's JWT as the Authorization header so all subsequent
 * database queries are scoped to that user and enforced by RLS.
 *
 * Security: uses publishable key ONLY; RLS prevents cross-user access.
 */
export function createUserClient(jwt: string): SupabaseClient {
  const { url, key } = getConfig();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

/**
 * Verify a user's Supabase JWT and return the user identity.
 * Returns null if the token is invalid, expired, or revoked.
 */
export async function verifyToken(jwt: string): Promise<{
  sub: string;
  email: string;
} | null> {
  try {
    const client = createUserClient(jwt);
    const { data, error } = await client.auth.getUser();
    if (error || !data.user || !data.user.email) return null;
    return { sub: data.user.id, email: data.user.email };
  } catch {
    return null;
  }
}
