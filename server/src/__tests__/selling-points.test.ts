import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  localizeSellingPoint: vi.fn(),
}));

vi.mock('../services/supabase.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/supabase.js')>();
  return { ...actual, verifyToken: mocks.verifyToken };
});

vi.mock('../services/deepseekService.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/deepseekService.js')>()),
  localizeSellingPoint: mocks.localizeSellingPoint,
}));

import app from '../app.js';

describe('POST /api/localize-selling-point', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockResolvedValue({ sub: 'user-1', email: 'user@example.com' });
    mocks.localizeSellingPoint.mockResolvedValue('夠輕身，拎出街都方便');
  });

  it('匿名请求返回 401 且不调用模型', async () => {
    const response = await request(app)
      .post('/api/localize-selling-point')
      .send({ sourceText: '轻便易携带' });

    expect(response.status).toBe(401);
    expect(mocks.localizeSellingPoint).not.toHaveBeenCalled();
  });

  it('校验空文本与 200 字上限', async () => {
    const empty = await request(app)
      .post('/api/localize-selling-point')
      .set('Authorization', 'Bearer valid-token')
      .send({ sourceText: '   ' });
    const tooLong = await request(app)
      .post('/api/localize-selling-point')
      .set('Authorization', 'Bearer valid-token')
      .send({ sourceText: '卖'.repeat(201) });

    expect(empty.status).toBe(400);
    expect(tooLong.status).toBe(400);
    expect(mocks.localizeSellingPoint).not.toHaveBeenCalled();
  });

  it('已鉴权请求返回港话表达', async () => {
    const response = await request(app)
      .post('/api/localize-selling-point')
      .set('Authorization', 'Bearer valid-token')
      .send({ sourceText: '轻便易携带' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ cantoneseText: '夠輕身，拎出街都方便' });
    expect(mocks.localizeSellingPoint).toHaveBeenCalledWith(
      '轻便易携带',
      expect.objectContaining({ jobId: null, requestId: expect.any(String) }),
    );
  });

  it('模型失败返回可重试的 502', async () => {
    mocks.localizeSellingPoint.mockRejectedValue(new Error('upstream unavailable'));
    const response = await request(app)
      .post('/api/localize-selling-point')
      .set('Authorization', 'Bearer valid-token')
      .send({ sourceText: '轻便易携带' });

    expect(response.status).toBe(502);
    expect(response.body.error).toBe('selling_point_localization_failed');
  });
});
