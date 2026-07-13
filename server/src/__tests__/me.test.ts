import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

// ============================================================
// GET /api/me — Auth tests
// ============================================================

describe('GET /api/me', () => {
  it('returns 401 when no Authorization header present', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Missing|invalid|Authorization/i);
  });

  it('returns 401 for malformed Authorization header', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'NotBearer xyz');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Missing|invalid|Authorization/i);
  });

  it('returns 401 for empty Bearer token', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('returns 401 for obviously invalid JWT', async () => {
    const res = await request(app)
      .get('/api/me')
      .set('Authorization', 'Bearer invalid.jwt.token');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid|expired/i);
  });
});

// ============================================================
// GET /api/health — Sanity
// ============================================================

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ============================================================
// Server bootstrap — app importable
// ============================================================

describe('Server bootstrap', () => {
  it('app is importable and is a function', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function'); // Express app
  });
});
