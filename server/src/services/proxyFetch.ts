/**
 * HTTP fetch wrapper with optional proxy support.
 *
 * Node.js native fetch() does NOT automatically respect HTTP_PROXY / HTTPS_PROXY
 * environment variables. This wrapper adds proxy support via undici's ProxyAgent
 * (built into Node.js 18+).
 *
 * Usage:
 *   Set HTTPS_PROXY or HTTP_PROXY in .env:
 *     HTTPS_PROXY=http://127.0.0.1:7890
 *
 * The proxy is typically your VPN/clash/V2Ray HTTP/SOCKS5 proxy address.
 */

let _ProxyAgent: typeof import('undici').ProxyAgent | null = null;
let _proxyAgentLoaded = false;

function getProxyAgent(): typeof import('undici').ProxyAgent | null {
  if (_proxyAgentLoaded) return _ProxyAgent;
  _proxyAgentLoaded = true;
  try {
    // undici is built into Node 18+
    const undici = require('undici');
    _ProxyAgent = undici.ProxyAgent;
    return _ProxyAgent;
  } catch {
    return null;
  }
}

export interface ProxyFetchOptions {
  /** Timeout in milliseconds (applied via AbortSignal.timeout) */
  timeout?: number;
  /** HTTP method (default GET) */
  method?: string;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Request body (for POST/PUT) */
  body?: string;
}

/**
 * Fetch a URL with optional proxy support.
 * If HTTPS_PROXY or HTTP_PROXY env var is set and undici ProxyAgent is available,
 * requests will be routed through the proxy.
 */
export async function proxyFetch(
  url: string,
  options: ProxyFetchOptions = {},
): Promise<Response> {
  const { timeout = 15000, method, headers = {}, body } = options;

  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy;
  const fetchOptions: RequestInit & { dispatcher?: unknown } = {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(timeout),
  };

  if (proxy) {
    const ProxyAgent = getProxyAgent();
    if (ProxyAgent) {
      try {
        fetchOptions.dispatcher = new ProxyAgent(proxy);
        console.log(`[proxyFetch] Using proxy: ${proxy}`);
      } catch (err) {
        console.warn(`[proxyFetch] Failed to create ProxyAgent: ${(err as Error).message}`);
      }
    } else {
      console.warn('[proxyFetch] HTTPS_PROXY is set but undici ProxyAgent is unavailable (Node 18+ required)');
    }
  }

  return fetch(url, fetchOptions);
}

/**
 * Quick connectivity test — tries to fetch a URL and reports success/failure.
 * Useful for diagnosing network issues.
 */
export async function testConnectivity(url: string, timeout = 8000): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await proxyFetch(url, { timeout });
    return { ok: res.ok, error: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
