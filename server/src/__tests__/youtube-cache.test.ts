import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  proxyFetch: vi.fn(),
}));

vi.mock('../services/proxyFetch.js', () => ({
  proxyFetch: mocks.proxyFetch,
}));

import {
  clearYoutubeCacheForTests,
  getYoutubeTrending,
} from '../services/youtubeSearchService.js';

function youtubeResponse(items: unknown[]): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items }),
    text: async () => '',
  } as Response;
}

describe('YouTube result cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearYoutubeCacheForTests();
    process.env.YOUTUBE_API_KEY = 'test-youtube-key';
  });

  afterEach(() => {
    delete process.env.YOUTUBE_API_KEY;
    clearYoutubeCacheForTests();
  });

  it('coalesces concurrent calls and reuses a non-empty result', async () => {
    mocks.proxyFetch.mockResolvedValue(youtubeResponse([
      {
        id: 'video-1',
        snippet: { title: 'Trend', description: 'Description', channelTitle: 'Channel' },
        statistics: { viewCount: '10' },
      },
    ]));

    const [first, concurrent] = await Promise.all([
      getYoutubeTrending(undefined, 6),
      getYoutubeTrending(undefined, 6),
    ]);
    const cached = await getYoutubeTrending(undefined, 6);

    expect(first).toHaveLength(1);
    expect(concurrent).toEqual(first);
    expect(cached).toEqual(first);
    expect(mocks.proxyFetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache an empty upstream result', async () => {
    mocks.proxyFetch.mockResolvedValue(youtubeResponse([]));

    await getYoutubeTrending(undefined, 6);
    await getYoutubeTrending(undefined, 6);

    expect(mocks.proxyFetch).toHaveBeenCalledTimes(2);
  });

  it('classifies an invalid API key and does not cache the failure', async () => {
    mocks.proxyFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({}),
      text: async () => JSON.stringify({ error: { message: 'API key not valid. Please pass a valid API key.' } }),
    } as Response);

    await expect(getYoutubeTrending(undefined, 6)).rejects.toMatchObject({
      code: 'youtube_api_key_invalid',
      upstreamStatus: 400,
    });
    await expect(getYoutubeTrending(undefined, 6)).rejects.toMatchObject({
      code: 'youtube_api_key_invalid',
    });
    expect(mocks.proxyFetch).toHaveBeenCalledTimes(2);
  });
});
