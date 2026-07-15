/**
 * Explicit CORS origin allowlist helpers.
 * No secrets. Strict exact-origin match when origins are provided.
 */

export const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
] as const;

/**
 * Parse ALLOWED_ORIGINS (comma-separated). Empty → local dev defaults only.
 * When set, use only the explicit list (exact match, no *.vercel.app wildcard).
 */
export function resolveAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.ALLOWED_ORIGINS ?? '';
  const fromEnv = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (fromEnv.length > 0) {
    return fromEnv;
  }
  return [...DEFAULT_DEV_ORIGINS];
}

/**
 * Whether a request Origin is allowed.
 * Missing/empty Origin (server-to-server, Alipay webhook, curl) is always allowed.
 */
export function isOriginAllowed(
  origin: string | undefined | null,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (origin == null || origin === '') {
    return true;
  }
  return resolveAllowedOrigins(env).includes(origin);
}
