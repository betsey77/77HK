import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiUrl } from '../services/apiBase';

describe('apiUrl (VITE_API_BASE_URL)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses relative /api paths when VITE_API_BASE_URL is unset', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(apiUrl('/generate')).toBe('/api/generate');
    expect(apiUrl('generate')).toBe('/api/generate');
    expect(apiUrl('/api/generate')).toBe('/api/generate');
    expect(apiUrl('/api/sync/bootstrap')).toBe('/api/sync/bootstrap');
    expect(apiUrl('/billing/plans')).toBe('/api/billing/plans');
  });

  it('prefixes absolute API origin with /api', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com');
    expect(apiUrl('/generate')).toBe('https://api.example.com/api/generate');
    expect(apiUrl('feedback')).toBe('https://api.example.com/api/feedback');
    expect(apiUrl('/api/me/entitlements')).toBe('https://api.example.com/api/me/entitlements');
  });

  it('strips trailing slashes on the base origin', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/');
    expect(apiUrl('/generate')).toBe('https://api.example.com/api/generate');
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com///');
    expect(apiUrl('/quick-check')).toBe('https://api.example.com/api/quick-check');
  });

  it('does not double /api when base already ends with /api', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/api');
    expect(apiUrl('/generate')).toBe('https://api.example.com/api/generate');
    expect(apiUrl('/api/generate')).toBe('https://api.example.com/api/generate');
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/api/');
    expect(apiUrl('sync/bootstrap')).toBe('https://api.example.com/api/sync/bootstrap');
  });

  it('handles path leading slash consistently', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    expect(apiUrl('admin/stats')).toBe('/api/admin/stats');
    expect(apiUrl('/admin/stats')).toBe('/api/admin/stats');
  });
});
