/**
 * Next-path allowlist for post-login redirect.
 *
 * Only explicit in-app paths are allowed — open redirects to external sites,
 * protocol-relative URLs, and double-slashes are rejected.
 */
const ALLOWED_NEXT_PATHS = new Set([
  '/app',
  '/app/billing',
  '/app/history',
  '/app/favorites',
  '/app/settings/profile',
  '/app/settings/brand',
]);

/**
 * Validate a `next` parameter value. Returns the sanitised path if
 * it is in the allowlist, otherwise returns null.
 *
 * Rejects:
 *  - External URLs (http://, https://, //)
 *  - Path traversal (..)
 *  - Paths not in the explicit allowlist
 */
export function resolveNextPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Reject protocol-prefixed URLs (absolute redirects)
  if (/^https?:\/\//i.test(trimmed)) return null;

  // Reject protocol-relative URLs (//evil.com)
  if (/^\/\//.test(trimmed)) return null;

  // Reject path traversal
  if (trimmed.includes('..')) return null;

  // Reject paths with query params or hashes that could smuggle URLs
  if (/[?#]/.test(trimmed)) return null;

  // Must start with /
  if (!trimmed.startsWith('/')) return null;

  // Must be in the explicit allowlist
  if (!ALLOWED_NEXT_PATHS.has(trimmed)) return null;

  return trimmed;
}
