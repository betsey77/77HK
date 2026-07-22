import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  getYoutubeTrending: vi.fn(),
  searchYoutube: vi.fn(),
}));

vi.mock('../services/supabase.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/supabase.js')>();
  return { ...actual, verifyToken: mocks.verifyToken };
});

vi.mock('../services/youtubeSearchService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/youtubeSearchService.js')>()),
  getYoutubeTrending: mocks.getYoutubeTrending,
  searchYoutube: mocks.searchYoutube,
}));

import { YoutubeServiceError } from '../services/youtubeSearchService.js';

import app from '../app.js';

describe('inspiration route auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockResolvedValue({ sub: 'user-1', email: 'user@example.com' });
    mocks.getYoutubeTrending.mockResolvedValue([{ id: 'trend-1' }]);
    mocks.searchYoutube.mockResolvedValue([{ id: 'search-1' }]);
  });

  it('rejects anonymous hot-trend requests before spending upstream quota', async () => {
    const response = await request(app).post('/api/inspiration/hot-trends').send({});

    expect(response.status).toBe(401);
    expect(mocks.getYoutubeTrending).not.toHaveBeenCalled();
    expect(mocks.searchYoutube).not.toHaveBeenCalled();
  });

  it('allows an authenticated hot-trend request', async () => {
    const response = await request(app)
      .post('/api/inspiration/hot-trends')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.posts).toHaveLength(3);
    expect(mocks.verifyToken).toHaveBeenCalledWith('valid-token');
  });

  it('returns a structured 502 when every YouTube request rejects an invalid key', async () => {
    const failure = new YoutubeServiceError('youtube_api_key_invalid', 400);
    mocks.getYoutubeTrending.mockRejectedValue(failure);
    mocks.searchYoutube.mockRejectedValue(failure);

    const response = await request(app)
      .post('/api/inspiration/hot-trends')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: 'youtube_unavailable',
      reason: 'youtube_api_key_invalid',
      posts: [],
    });
  });
});
