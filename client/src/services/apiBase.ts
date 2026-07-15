/**
 * Resolve browser API paths against optional VITE_API_BASE_URL.
 *
 * Local / same-origin (default): relative `/api/...` (Vite proxy).
 * Split hosting: set VITE_API_BASE_URL to the API origin only (no secrets).
 *
 * Rules:
 * - Unset / empty → `/api` + path
 * - `https://api.example.com` + `/generate` → `https://api.example.com/api/generate`
 * - Base already ending in `/api` does not double-append `/api`
 * - Trailing slashes on base are stripped; path leading `/` is normalized
 * - Never put secrets in VITE_* variables
 */

function readViteApiBase(): string {
  try {
    const raw = import.meta.env?.VITE_API_BASE_URL;
    if (raw == null || raw === '') return '';
    return String(raw).trim();
  } catch {
    return '';
  }
}

/** Normalize caller path to always start with a single `/`. */
function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Ensure path is under `/api` (accepts `/api/x`, `api/x`, `/x`, `x`).
 */
function withApiPrefix(path: string): string {
  const p = normalizePath(path);
  if (p === '/api' || p.startsWith('/api/')) return p;
  return `/api${p === '/' ? '' : p}`;
}

/**
 * Build a full request URL for backend API routes.
 *
 * @param path Route path, e.g. `/generate`, `generate`, `/api/generate`
 */
export function apiUrl(path: string): string {
  const withApi = withApiPrefix(path);
  const base = readViteApiBase().replace(/\/+$/, '');

  if (!base) {
    return withApi;
  }

  if (base.endsWith('/api')) {
    const suffix = withApi === '/api' ? '' : withApi.slice('/api'.length);
    return `${base}${suffix}`;
  }

  return `${base}${withApi}`;
}
