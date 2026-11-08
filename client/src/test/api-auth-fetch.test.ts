import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  supabase: { auth: { getSession: mockGetSession } },
}));

import { authApiFetch } from '../services/api';

describe('authApiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'session-jwt' } },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
  });

  it('adds the current Supabase bearer token to auxiliary API calls', async () => {
    await authApiFetch('/translate', {
      method: 'POST',
      body: JSON.stringify({ text: 'test' }),
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    const headers = new Headers(init?.headers);

    expect(String(url)).toContain('/api/translate');
    expect(headers.get('Authorization')).toBe('Bearer session-jwt');
    expect(headers.get('Content-Type')).toBe('application/json');
  });
});
