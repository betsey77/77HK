/**
 * Slice H1 — ServerChan notifier unit tests
 *
 * Covers:
 * - Injectable fetch (mock)
 * - Timeout handling
 * - Success response errno/code validation
 * - Failure modes
 * - Key never leaked in error messages
 * - sendKey loading (direct env, file pointer, fallback)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockReadFileSync } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
}));

import {
  ServerChanNotifier,
  NoopNotifier,
  resetNotifier,
  getNotifier,
  type NotifyPayload,
} from '../services/serverchanNotifier.js';

// ── Helpers ────────────────────────────────────────────────────

const VALID_PAYLOAD: NotifyPayload = {
  title: 'Test notification',
  content: 'Test content for notification',
};

function makeMockFetch(response: { ok: boolean; status: number; body: unknown }) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: () => Promise.resolve(response.body),
  });
}

// ── Tests ──────────────────────────────────────────────────────

describe('ServerChanNotifier', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetNotifier();
  });

  describe('with direct env key', () => {
    it('succeeds when ServerChan returns errno 0 (new format with data wrapper)', async () => {
      const mockFetch = makeMockFetch({
        ok: true,
        status: 200,
        body: { code: 0, message: 'success', data: { errno: 0, errmsg: 'success' } },
      });

      vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUtestkey12345678901234567890');
      const notifier = new ServerChanNotifier(mockFetch);

      const result = await notifier.send(VALID_PAYLOAD);

      expect(result.success).toBe(true);
      expect(result.serverchanErrno).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify URL contains key but we don't validate the full URL in error messages
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('SCUtestkey12345678901234567890.send');
    });

    it('succeeds when ServerChan returns errno 0 (old flat format)', async () => {
      const mockFetch = makeMockFetch({
        ok: true,
        status: 200,
        body: { errno: 0, errmsg: 'success' },
      });

      vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUtestkey12345678901234567890');
      const notifier = new ServerChanNotifier(mockFetch);

      const result = await notifier.send(VALID_PAYLOAD);
      expect(result.success).toBe(true);
    });

    it('fails when ServerChan returns non-zero errno', async () => {
      const mockFetch = makeMockFetch({
        ok: true,
        status: 200,
        body: { code: -1, message: 'fail', data: { errno: 102, errmsg: 'key not found' } },
      });

      vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUtestkey12345678901234567890');
      const notifier = new ServerChanNotifier(mockFetch);

      const result = await notifier.send(VALID_PAYLOAD);
      expect(result.success).toBe(false);
      expect(result.serverchanErrno).toBe(102);
    });

    it('fails when HTTP response is not ok', async () => {
      const mockFetch = makeMockFetch({
        ok: false,
        status: 500,
        body: {},
      });

      vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUtestkey12345678901234567890');
      const notifier = new ServerChanNotifier(mockFetch);

      const result = await notifier.send(VALID_PAYLOAD);
      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500');
    });

    it('fails on timeout', async () => {
      const mockFetch = vi.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const err = new DOMException('The operation was aborted', 'AbortError');
          reject(err);
        });
      });

      vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUtestkey12345678901234567890');
      const notifier = new ServerChanNotifier(mockFetch);

      const result = await notifier.send(VALID_PAYLOAD);
      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
    });

    it('fails gracefully on network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('fetch failed'));

      vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUtestkey12345678901234567890');
      const notifier = new ServerChanNotifier(mockFetch);

      const result = await notifier.send(VALID_PAYLOAD);
      expect(result.success).toBe(false);
      // 脱敏：不输出原始 message
      expect(result.error).not.toContain('SCU');
      expect(result.error).not.toContain('fetch failed');
    });

    it('rejects empty title', async () => {
      vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUtestkey12345678901234567890');
      const notifier = new ServerChanNotifier();

      const result = await notifier.send({ title: '   ', content: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('must not be empty');
    });

    it('rejects empty content', async () => {
      vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUtestkey12345678901234567890');
      const notifier = new ServerChanNotifier();

      const result = await notifier.send({ title: 'test', content: '  ' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('must not be empty');
    });

    it('truncates long title and content', async () => {
      const mockFetch = makeMockFetch({
        ok: true,
        status: 200,
        body: { errno: 0, errmsg: 'success' },
      });

      vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUtestkey12345678901234567890');
      const notifier = new ServerChanNotifier(mockFetch);

      const longTitle = 'x'.repeat(200);
      const longContent = 'y'.repeat(5000);

      const result = await notifier.send({ title: longTitle, content: longContent });
      expect(result.success).toBe(true);

      // Verify truncation was applied
      const body = mockFetch.mock.calls[0][1]?.body as URLSearchParams;
      const titleParam = body?.get?.('title') ?? '';
      expect(titleParam.length).toBeLessThanOrEqual(128);
    });

    it('isConfigured returns true when key is set', () => {
      vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUtestkey12345678901234567890');
      const notifier = new ServerChanNotifier();
      expect(notifier.isConfigured()).toBe(true);
    });

    it('isConfigured returns false when key is not set', () => {
      const notifier = new ServerChanNotifier();
      expect(notifier.isConfigured()).toBe(false);
    });
  });

  describe('error message never leaks key', () => {
    it('network error message does not contain SCU prefix', async () => {
      const mockFetch = vi.fn().mockRejectedValue(
        new Error('Failed to fetch https://sctapi.ftqq.com/SCUsecretkey123456.send')
      );

      vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUsecretkey123456');
      const notifier = new ServerChanNotifier(mockFetch);

      const result = await notifier.send(VALID_PAYLOAD);
      expect(result.success).toBe(false);
      expect(result.error).not.toContain('SCU');
    });

    it('HTTP error message does not contain key', async () => {
      const mockFetch = makeMockFetch({
        ok: false,
        status: 403,
        body: { error: 'SCUkey not valid' },
      });

      vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUmykey12345678901234567890');
      const notifier = new ServerChanNotifier(mockFetch);

      const result = await notifier.send(VALID_PAYLOAD);
      expect(result.error).not.toContain('SCUmykey');
    });
  });

  describe('non-JSON response', () => {
    it('handles malformed JSON gracefully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUtestkey12345678901234567890');
      const notifier = new ServerChanNotifier(mockFetch);

      const result = await notifier.send(VALID_PAYLOAD);
      expect(result.success).toBe(false);
      expect(result.error).toContain('non-JSON');
    });
  });

  describe('not configured', () => {
    it('returns error when sendKey is null', async () => {
      const notifier = new ServerChanNotifier();
      const result = await notifier.send(VALID_PAYLOAD);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });
});

describe('NoopNotifier', () => {
  it('always returns failure', async () => {
    const notifier = new NoopNotifier();
    const result = await notifier.send(VALID_PAYLOAD);
    expect(result.success).toBe(false);
  });
});

describe('getNotifier factory', () => {
  afterEach(() => {
    resetNotifier();
    vi.unstubAllEnvs();
  });

  it('returns ServerChanNotifier when key is set', () => {
    vi.stubEnv('SERVERCHAN_SENDKEY', 'SCUtestkey12345678901234567890');
    const notifier = getNotifier();
    expect(notifier).toBeInstanceOf(ServerChanNotifier);
  });

  it('returns NoopNotifier when key is not set', () => {
    const notifier = getNotifier();
    expect(notifier).toBeInstanceOf(NoopNotifier);
  });
});

// ── SendKey file parsing tests ────────────────────────────────

describe('SendKey file parsing (SERVERCHAN_SENDKEY_FILE)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockReadFileSync.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetNotifier();
  });

  const fakeKey = 'SCUtestkey12345678901234567890';

  it('parses SendKey=value format (case-insensitive)', () => {
    mockReadFileSync.mockReturnValue(`SendKey=${fakeKey}`);

    vi.stubEnv('SERVERCHAN_SENDKEY_FILE', 'C:\\fake\\sendkey.txt');
    const notifier = getNotifier();
    expect(notifier.isConfigured?.()).toBe(true);
  });

  it('parses SERVERCHAN_SENDKEY=value format', () => {
    mockReadFileSync.mockReturnValue(`SERVERCHAN_SENDKEY=${fakeKey}`);

    vi.stubEnv('SERVERCHAN_SENDKEY_FILE', 'C:\\fake\\sendkey.txt');
    const notifier = getNotifier();
    expect(notifier.isConfigured?.()).toBe(true);
  });

  it('parses mixed-case assignment', () => {
    mockReadFileSync.mockReturnValue(`Sendkey=${fakeKey}`);

    vi.stubEnv('SERVERCHAN_SENDKEY_FILE', 'C:\\fake\\sendkey.txt');
    const notifier = getNotifier();
    expect(notifier.isConfigured?.()).toBe(true);
  });

  it('parses raw key (no assignment prefix)', () => {
    mockReadFileSync.mockReturnValue(fakeKey);

    vi.stubEnv('SERVERCHAN_SENDKEY_FILE', 'C:\\fake\\sendkey.txt');
    const notifier = getNotifier();
    expect(notifier.isConfigured?.()).toBe(true);
  });

  it('strips paired double quotes', () => {
    mockReadFileSync.mockReturnValue(`"${fakeKey}"`);

    vi.stubEnv('SERVERCHAN_SENDKEY_FILE', 'C:\\fake\\sendkey.txt');
    const notifier = getNotifier();
    expect(notifier.isConfigured?.()).toBe(true);
  });

  it('strips paired single quotes', () => {
    mockReadFileSync.mockReturnValue(`'${fakeKey}'`);

    vi.stubEnv('SERVERCHAN_SENDKEY_FILE', 'C:\\fake\\sendkey.txt');
    const notifier = getNotifier();
    expect(notifier.isConfigured?.()).toBe(true);
  });

  it('fails closed on multi-line content', () => {
    mockReadFileSync.mockReturnValue(`SendKey=${fakeKey}\nExtraLine=value`);

    vi.stubEnv('SERVERCHAN_SENDKEY_FILE', 'C:\\fake\\sendkey.txt');
    const notifier = getNotifier();
    expect(notifier.isConfigured?.()).toBe(false);
  });

  it('fails closed on unknown assignment name', () => {
    mockReadFileSync.mockReturnValue(`UNKNOWN_KEY=${fakeKey}`);

    vi.stubEnv('SERVERCHAN_SENDKEY_FILE', 'C:\\fake\\sendkey.txt');
    const notifier = getNotifier();
    expect(notifier.isConfigured?.()).toBe(false);
  });

  it('fails closed on empty file', () => {
    mockReadFileSync.mockReturnValue('   ');

    vi.stubEnv('SERVERCHAN_SENDKEY_FILE', 'C:\\fake\\sendkey.txt');
    const notifier = getNotifier();
    expect(notifier.isConfigured?.()).toBe(false);
  });

  it('key too short (< 10 chars) returns NoopNotifier', () => {
    mockReadFileSync.mockReturnValue('short');

    vi.stubEnv('SERVERCHAN_SENDKEY_FILE', 'C:\\fake\\sendkey.txt');
    const notifier = getNotifier();
    expect(notifier.isConfigured?.()).toBe(false);
  });
});
