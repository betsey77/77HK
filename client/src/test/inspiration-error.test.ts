import { describe, expect, it } from 'vitest';
import { getInspirationErrorMessage } from '../services/api';

describe('inspiration upstream errors', () => {
  it('explains an invalid YouTube API key without exposing upstream details', async () => {
    const response = new Response(JSON.stringify({
      error: 'youtube_unavailable',
      reason: 'youtube_api_key_invalid',
    }), { status: 502, headers: { 'Content-Type': 'application/json' } });

    await expect(getInspirationErrorMessage(response)).resolves.toBe(
      'YouTube API Key 无效，请联系管理员更新配置',
    );
  });

  it('uses a generic message for malformed failures', async () => {
    const response = new Response('not-json', { status: 502 });

    await expect(getInspirationErrorMessage(response)).resolves.toBe('热点数据获取失败');
  });
});
