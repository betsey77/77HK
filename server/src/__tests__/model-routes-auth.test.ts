import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  translateToMandarin: vi.fn(),
  parsePersonasFromText: vi.fn(),
}));

vi.mock('../services/supabase.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/supabase.js')>();
  return { ...actual, verifyToken: mocks.verifyToken };
});

vi.mock('../services/deepseekService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/deepseekService.js')>();
  return {
    ...actual,
    translateToMandarin: mocks.translateToMandarin,
    parsePersonasFromText: mocks.parsePersonasFromText,
  };
});

import app from '../app.js';

describe('model-backed auxiliary route auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyToken.mockResolvedValue({ sub: 'user-1', email: 'user@example.com' });
    mocks.translateToMandarin.mockResolvedValue('translated');
    mocks.parsePersonasFromText.mockResolvedValue([
      { id: 'persona-1', name: 'Test persona', ageRange: '25-35', occupation: '', habits: '', apps: '', notes: '' },
      { id: 'persona-2', name: 'Must be dropped', ageRange: '35-45', occupation: '', habits: '', apps: '', notes: '' },
    ]);
  });

  it.each([
    ['/api/translate', { text: '需要翻译的测试文本' }],
    ['/api/apply-suggestion', { variantText: 'text', suggestion: 'suggestion' }],
    ['/api/re-evaluate', { variants: {} }],
    ['/api/parse-personas', { text: '这是一个足够长的目标消费者描述' }],
  ])('returns 401 for anonymous POST %s', async (path, body) => {
    const response = await request(app).post(path).send(body);

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/Authorization/i);
  });

  it('allows an authenticated translation request', async () => {
    const response = await request(app)
      .post('/api/translate')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: '需要翻译的测试文本' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ translated: 'translated' });
    expect(mocks.verifyToken).toHaveBeenCalledWith('valid-token');
  });

  it('allows an authenticated persona parse request', async () => {
    const response = await request(app)
      .post('/api/parse-personas')
      .set('Authorization', 'Bearer valid-token')
      .send({ text: '这是一个足够长的目标消费者描述' });

    expect(response.status).toBe(200);
    expect(response.body.personas).toHaveLength(1);
    expect(response.body.personas[0].name).toBe('Test persona');
    expect(mocks.verifyToken).toHaveBeenCalledWith('valid-token');
  });
});
