import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

/**
 * Server-side trusted Supabase adapter.
 *
 * Uses SUPABASE_SECRET_KEY (service_role) to bypass RLS for
 * privileged operations (quota ledger writes, job completion, etc.).
 *
 * NEVER uses VITE_ prefixed env vars or publishable keys.
 * NEVER logs or returns the key in errors, logs, or responses.
 */

const TRUSTED_SERVICE_ERROR = 'Trusted service unavailable';

function readSecretFromFile(filePath: string): string {
  try {
    const contents = readFileSync(filePath, 'utf8').trim();
    if (!contents) throw new Error(TRUSTED_SERVICE_ERROR);

    const lines = contents.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length !== 1) throw new Error(TRUSTED_SERVICE_ERROR);

    const assignment = lines[0].match(/^SUPABASE_SECRET_KEY\s*=\s*(.+)$/);
    const key = (assignment?.[1] ?? lines[0]).trim();
    if (!key || (!assignment && key.includes('='))) {
      throw new Error(TRUSTED_SERVICE_ERROR);
    }

    return key;
  } catch {
    // Fail closed without exposing the configured path or file contents.
    throw new Error(TRUSTED_SERVICE_ERROR);
  }
}

function getTrustedConfig(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL;
  const directKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const keyFile = process.env.SUPABASE_SECRET_KEY_FILE?.trim();
  const key = directKey || (keyFile ? readSecretFromFile(keyFile) : undefined);

  if (!url || !key) {
    throw new Error(TRUSTED_SERVICE_ERROR);
  }

  return { url, key };
}

let _trustedSupabase: SupabaseClient | undefined;

/**
 * Returns a Supabase client initialised with the service_role key.
 *
 * - Lazy-initialised so dotenv can load before the first call.
 * - Auth persistence is disabled (server-side only).
 * - Fails closed: throws 'Trusted service unavailable' if the key is not set.
 */
export function getTrustedSupabase(): SupabaseClient {
  if (!_trustedSupabase) {
    const { url, key } = getTrustedConfig();
    _trustedSupabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _trustedSupabase;
}
