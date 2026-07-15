/**
 * CORS allowlist behaviour — ALLOWED_ORIGINS exact match + no-Origin server calls.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { isOriginAllowed, resolveAllowedOrigins, DEFAULT_DEV_ORIGINS } from '../services/corsOrigins.js';

describe('corsOrigins helpers', () => {
  it('defaults to local Vite origins when ALLOWED_ORIGINS is empty', () => {
    expect(resolveAllowedOrigins({ ALLOWED_ORIGINS: '' })).toEqual([...DEFAULT_DEV_ORIGINS]);
    expect(resolveAllowedOrigins({})).toEqual([...DEFAULT_DEV_ORIGINS]);
  });

  it('parses comma-separated ALLOWED_ORIGINS exactly', () => {
    expect(
      resolveAllowedOrigins({
        ALLOWED_ORIGINS: 'https://app.example.com, https://preview.example.com',
      }),
    ).toEqual(['https://app.example.com', 'https://preview.example.com']);
  });

  it('does not treat empty segments as wildcards', () => {
    expect(resolveAllowedOrigins({ ALLOWED_ORIGINS: ' , ,https://a.com, ' })).toEqual([
      'https://a.com',
    ]);
  });

  it('allows missing Origin (webhook / server-to-server)', () => {
    expect(isOriginAllowed(undefined, { ALLOWED_ORIGINS: 'https://app.example.com' })).toBe(true);
    expect(isOriginAllowed('', { ALLOWED_ORIGINS: 'https://app.example.com' })).toBe(true);
    expect(isOriginAllowed(null, {})).toBe(true);
  });

  it('allows listed origin and rejects others (no wildcard)', () => {
    const env = { ALLOWED_ORIGINS: 'https://app.example.com' };
    expect(isOriginAllowed('https://app.example.com', env)).toBe(true);
    expect(isOriginAllowed('https://evil.example.com', env)).toBe(false);
    expect(isOriginAllowed('https://app.example.com.evil.com', env)).toBe(false);
    expect(isOriginAllowed('https://foo.vercel.app', env)).toBe(false);
  });
});

describe('HTTP CORS middleware', () => {
  const prev = process.env.ALLOWED_ORIGINS;

  beforeEach(() => {
    delete process.env.ALLOWED_ORIGINS;
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = prev;
  });

  it('allows default local origin on public health', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('allows requests with no Origin (Alipay webhook / server-to-server style)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects disallowed Origin with a CORS failure (no secret leakage)', async () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';

    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://evil.example.com');

    // Disallowed origin must be 403 with a generic error body; must not echo secrets
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Origin not allowed' });
    const bodyText = JSON.stringify(res.body) + (res.text || '');
    expect(bodyText).not.toMatch(/SUPABASE|ALIPAY|PRIVATE_KEY|SECRET|sendkey/i);
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example.com');
  });

  it('allows explicitly configured production-like frontend origin', async () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';

    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'https://app.example.com');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com');
  });
});
