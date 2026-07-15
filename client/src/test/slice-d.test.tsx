/**
 * Slice D: Cloud Sync — unit tests (TDD)
 *
 * Tests the cloudSync service module:
 * - auth header generation
 * - API call correctness (bootstrap, favorites, configs, brand-profile, import)
 * - data conversion functions (local ↔ cloud)
 * - legacy key detection
 * - error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================
// Mock supabase — same pattern as slice-c1 tests
// ============================================================

const { mockSupabase } = vi.hoisted(() => {
  const m = {
    auth: {
      getSession: vi.fn(),
    },
  };
  return { mockSupabase: m };
});

vi.mock('../services/supabase', () => ({
  supabase: mockSupabase,
}));

// Import the module under test AFTER mocks are hoisted
import {
  getAuthHeaders,
  bookmarkToSyncFavorite,
  configToSyncConfig,
  favoriteRecordToBookmark,
  configRecordToSavedConfig,
  fetchBootstrap,
  syncFavoriteUp,
  syncFavoriteDelete,
  syncConfigUp,
  syncConfigDelete,
  syncBrandProfile,
  syncImport,
  hasLegacyGlobalKeys,
  getLegacyItemCounts,
  readLegacyData,
  markLegacyImported,
  isLegacyImported,
} from '../services/cloudSync';
import type {
  BookmarkedCopy, SavedConfig, FavoriteRecord, SavedConfigRecord,
  BootstrapResponse, SyncImportResponse, SyncFavoriteRequest,
  SyncConfigRequest, SyncBrandProfileRequest, SyncImportRequest,
  BrandProfileRecord,
} from '../types';

// ============================================================
// Test data factories
// ============================================================

function makeBookmarkedCopy(overrides: Partial<BookmarkedCopy> = {}): BookmarkedCopy {
  return {
    id: 'bm-001',
    savedAt: '2026-07-12T10:00:00Z',
    variantKey: 'standardHK',
    content: '測試繁體文案',
    source: '測試原始文字',
    settings: {
      platform: 'ig',
      tone: '活潑',
      cantoneseLevel: 3,
      englishMixingLevel: 2,
      creativityLevel: 2,
      inputLanguage: 'mandarin',
      brandName: 'Test Brand',
      productName: 'Test Product',
      brandRedLines: '',
      structuredBriefEnabled: false,
      consumerPersonas: [],
    },
    notes: 'test note',
    rating: 4,
    favoriteReason: 'good hook',
    reasonTags: ['hook', 'tone'],
    ...overrides,
  };
}

function makeFavoriteRecord(overrides: Partial<FavoriteRecord> = {}): FavoriteRecord {
  return {
    id: 'fr-uuid-001',
    ownerId: 'user-001',
    clientId: 'bm-001',
    variantKey: 'standardHK',
    content: '測試繁體文案',
    source: '測試原始文字',
    settings: {
      platform: 'ig',
      tone: '活潑',
      cantoneseLevel: 3,
      englishMixingLevel: 2,
      creativityLevel: 2,
      inputLanguage: 'mandarin',
      brandName: 'Test Brand',
      productName: 'Test Product',
      brandRedLines: '',
      structuredBriefEnabled: false,
      consumerPersonas: [],
    },
    savedAt: '2026-07-12T10:00:00Z',
    notes: 'test note',
    rating: 4,
    favoriteReason: 'good hook',
    reasonTags: ['hook', 'tone'],
    createdAt: '2026-07-12T10:00:00Z',
    updatedAt: '2026-07-12T10:00:00Z',
    ...overrides,
  };
}

function makeSavedConfig(overrides: Partial<SavedConfig> = {}): SavedConfig {
  return {
    id: 'sc-001',
    name: 'Test Config',
    brandName: 'Test Brand',
    productName: 'Test Product',
    brandRedLines: '',
    structuredBriefEnabled: false,
    creativityLevel: 2,
    cantoneseLevel: 3,
    englishMixingLevel: 2,
    tone: '活潑',
    platform: 'ig',
    inputLanguage: 'mandarin',
    consumerPersonas: [],
    selectedReferenceCaseIds: ['favorite-a', 'favorite-b'],
    createdAt: '2026-07-12T10:00:00Z',
    ...overrides,
  };
}

function makeSavedConfigRecord(overrides: Partial<SavedConfigRecord> = {}): SavedConfigRecord {
  return {
    id: 'scr-uuid-001',
    ownerId: 'user-001',
    clientId: 'sc-001',
    name: 'Test Config',
    config: {
      brandName: 'Test Brand',
      productName: 'Test Product',
      brandRedLines: '',
      structuredBriefEnabled: false,
      creativityLevel: 2,
      cantoneseLevel: 3,
      englishMixingLevel: 2,
      tone: '活潑',
      platform: 'ig',
      inputLanguage: 'mandarin',
      consumerPersonas: [],
      selectedReferenceCaseIds: ['favorite-a', 'favorite-b'],
      createdAt: '2026-07-12T10:00:00Z',
    },
    createdAt: '2026-07-12T10:00:00Z',
    updatedAt: '2026-07-12T10:00:00Z',
    ...overrides,
  };
}

// ============================================================
// Mock fetch helper
// ============================================================

function mockFetchResponse(body: unknown, status = 200, ok = true): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

// ============================================================
// Setup / teardown
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Default: no session
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });
});

afterEach(() => {
  localStorage.clear();
});

// ============================================================
// Tests: getAuthHeaders
// ============================================================

describe('getAuthHeaders', () => {
  it('includes Authorization header when session exists', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt-token' },
      },
      error: null,
    });

    const headers = await getAuthHeaders();

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer fake-jwt-token');
  });

  it('has no Authorization header when no session', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const headers = await getAuthHeaders();

    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('rejects when expectedOwnerId does not match session user', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'jwt', user: { id: 'user-b' } },
      },
      error: null,
    });

    await expect(getAuthHeaders('user-a')).rejects.toThrow('Session owner mismatch');
  });

  it('succeeds when expectedOwnerId matches session user', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'jwt', user: { id: 'user-a' } },
      },
      error: null,
    });

    const headers = await getAuthHeaders('user-a');
    expect(headers['Authorization']).toBe('Bearer jwt');
  });
});

// ============================================================
// Tests: fetchBootstrap
// ============================================================

describe('fetchBootstrap', () => {
  it('parses response correctly', async () => {
    const mockBootstrap: BootstrapResponse = {
      favorites: [makeFavoriteRecord()],
      savedConfigs: [makeSavedConfigRecord()],
      brandProfile: null,
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt' },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(mockBootstrap));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchBootstrap();

    expect(fetchMock).toHaveBeenCalledWith('/api/sync/bootstrap', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-jwt',
      },
    });
    expect(result.favorites).toHaveLength(1);
    expect(result.savedConfigs).toHaveLength(1);
    expect(result.brandProfile).toBeNull();
  });

  it('throws on HTTP error response', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt' },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({ error: 'Not authenticated' }, 401, false),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBootstrap()).rejects.toThrow('Not authenticated');
  });

  it('throws with generic message when error body has no error field', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt' },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({}, 500, false),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBootstrap()).rejects.toThrow('Failed to fetch bootstrap (500)');
  });
});

// ============================================================
// Tests: syncFavoriteUp
// ============================================================

describe('syncFavoriteUp', () => {
  it('sends correct POST body', async () => {
    const req: SyncFavoriteRequest = {
      clientId: 'bm-001',
      variantKey: 'standardHK',
      content: '測試文案',
      source: '原始文字',
      settings: { platform: 'ig' },
      notes: 'test',
      rating: 4,
      savedAt: '2026-07-12T10:00:00Z',
    };

    const expectedRecord: FavoriteRecord = makeFavoriteRecord();

    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt' },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(expectedRecord));
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncFavoriteUp(req);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/sync/favorites');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer fake-jwt',
    });

    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.clientId).toBe('bm-001');
    expect(sentBody.variantKey).toBe('standardHK');
    expect(sentBody.content).toBe('測試文案');
    expect(sentBody.rating).toBe(4);

    expect(result.clientId).toBe(expectedRecord.clientId);
  });

  it('throws on error response', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt' },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({ error: 'Conflict' }, 409, false),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      syncFavoriteUp({ clientId: 'x', variantKey: 'standardHK', content: '', source: '', settings: {} }),
    ).rejects.toThrow('Conflict');
  });
});

// ============================================================
// Tests: syncFavoriteDelete
// ============================================================

describe('syncFavoriteDelete', () => {
  it('sends DELETE to correct URL with encoded clientId', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt' },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await syncFavoriteDelete('bm-001');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/sync/favorites/bm-001');
    expect(init.method).toBe('DELETE');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer fake-jwt',
    });
  });

  it('throws on error response', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt' },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({ error: 'Not found' }, 404, false),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(syncFavoriteDelete('nonexistent')).rejects.toThrow('Not found');
  });
});

// ============================================================
// Tests: syncConfigUp
// ============================================================

describe('syncConfigUp', () => {
  it('sends correct POST body', async () => {
    const req: SyncConfigRequest = {
      clientId: 'sc-001',
      name: 'My Config',
      config: { brandName: 'Brand', platform: 'ig' },
    };

    const expectedRecord: SavedConfigRecord = {
      id: 'scr-uuid',
      ownerId: 'user-001',
      clientId: 'sc-001',
      name: 'My Config',
      config: { brandName: 'Brand', platform: 'ig' },
      createdAt: '2026-07-12T10:00:00Z',
      updatedAt: '2026-07-12T10:00:00Z',
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt' },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(expectedRecord));
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncConfigUp(req);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/sync/configs');
    expect(init.method).toBe('POST');

    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.clientId).toBe('sc-001');
    expect(sentBody.name).toBe('My Config');
    expect(sentBody.config.brandName).toBe('Brand');

    expect(result.clientId).toBe('sc-001');
    expect(result.name).toBe('My Config');
  });
});

// ============================================================
// Tests: syncConfigDelete
// ============================================================

describe('syncConfigDelete', () => {
  it('sends DELETE to correct config URL', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt' },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await syncConfigDelete('sc-001');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/sync/configs/sc-001');
    expect(init.method).toBe('DELETE');
  });
});

// ============================================================
// Tests: syncBrandProfile
// ============================================================

describe('syncBrandProfile', () => {
  it('sends PUT to brand-profile endpoint with correct body', async () => {
    const req: SyncBrandProfileRequest = {
      brandName: 'My Brand',
      productName: 'My Product',
      brandRedLines: 'No politics',
    };

    const expectedRecord: BrandProfileRecord = {
      id: 'bp-uuid',
      ownerId: 'user-001',
      brandName: 'My Brand',
      productName: 'My Product',
      brandRedLines: 'No politics',
      createdAt: '2026-07-12T10:00:00Z',
      updatedAt: '2026-07-12T10:00:00Z',
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt' },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(expectedRecord));
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncBrandProfile(req);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/sync/brand-profile');
    expect(init.method).toBe('PUT');

    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.brandName).toBe('My Brand');
    expect(sentBody.productName).toBe('My Product');
    expect(sentBody.brandRedLines).toBe('No politics');

    expect(result.brandName).toBe('My Brand');
  });

  it('sends null fields correctly', async () => {
    const req: SyncBrandProfileRequest = {
      brandName: null,
      productName: null,
      brandRedLines: null,
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt' },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({ id: 'bp-uuid', ownerId: 'u1', brandName: null, productName: null, brandRedLines: null, createdAt: '', updatedAt: '' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await syncBrandProfile(req);

    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sentBody.brandName).toBeNull();
    expect(sentBody.productName).toBeNull();
    expect(sentBody.brandRedLines).toBeNull();
  });
});

// ============================================================
// Tests: syncImport
// ============================================================

describe('syncImport', () => {
  it('sends correct POST body and parses response', async () => {
    const importReq: SyncImportRequest = {
      favorites: [
        { clientId: 'bm-001', variantKey: 'standardHK', content: 'c1', source: 's1', settings: {} },
      ],
      savedConfigs: [
        { clientId: 'sc-001', name: 'Config A', config: {} },
      ],
    };

    const importResp: SyncImportResponse = {
      favorites: { imported: 1, updated: 0 },
      savedConfigs: { imported: 1, updated: 0 },
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt' },
      },
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(mockFetchResponse(importResp));
    vi.stubGlobal('fetch', fetchMock);

    const result = await syncImport(importReq);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/sync/import');
    expect(init.method).toBe('POST');

    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.favorites).toHaveLength(1);
    expect(sentBody.savedConfigs).toHaveLength(1);

    expect(result.favorites.imported).toBe(1);
    expect(result.savedConfigs.imported).toBe(1);
  });
});

// ============================================================
// Tests: hasLegacyGlobalKeys
// ============================================================

describe('hasLegacyGlobalKeys', () => {
  it('returns true when old global bookmarks key exists', () => {
    localStorage.setItem('hk-cantonese-bookmarks', '[]');
    expect(hasLegacyGlobalKeys()).toBe(true);
  });

  it('returns true when old global configs key exists', () => {
    localStorage.setItem('hk-cantonese-configs', '[]');
    expect(hasLegacyGlobalKeys()).toBe(true);
  });

  it('returns true when both old global keys exist', () => {
    localStorage.setItem('hk-cantonese-bookmarks', '[]');
    localStorage.setItem('hk-cantonese-configs', '[]');
    expect(hasLegacyGlobalKeys()).toBe(true);
  });

  it('returns false when only namespaced keys exist', () => {
    localStorage.setItem('hk-cantonese-bookmarks:user-001', '[]');
    localStorage.setItem('hk-cantonese-configs:user-001', '[]');
    expect(hasLegacyGlobalKeys()).toBe(false);
  });

  it('returns false when no keys exist at all', () => {
    expect(hasLegacyGlobalKeys()).toBe(false);
  });
});

// ============================================================
// Tests: getLegacyItemCounts
// ============================================================

describe('getLegacyItemCounts', () => {
  it('returns correct counts when legacy keys contain data', () => {
    localStorage.setItem('hk-cantonese-bookmarks', JSON.stringify([{ id: '1' }, { id: '2' }]));
    localStorage.setItem('hk-cantonese-configs', JSON.stringify([{ id: 'a' }, { id: 'b' }, { id: 'c' }]));

    const counts = getLegacyItemCounts();
    expect(counts.bookmarks).toBe(2);
    expect(counts.configs).toBe(3);
  });

  it('returns zero counts when keys are empty arrays', () => {
    localStorage.setItem('hk-cantonese-bookmarks', '[]');
    localStorage.setItem('hk-cantonese-configs', '[]');

    const counts = getLegacyItemCounts();
    expect(counts.bookmarks).toBe(0);
    expect(counts.configs).toBe(0);
  });

  it('returns zero counts when keys do not exist', () => {
    const counts = getLegacyItemCounts();
    expect(counts.bookmarks).toBe(0);
    expect(counts.configs).toBe(0);
  });

  it('handles invalid JSON gracefully', () => {
    localStorage.setItem('hk-cantonese-bookmarks', 'not-json');
    localStorage.setItem('hk-cantonese-configs', '{broken');

    const counts = getLegacyItemCounts();
    expect(counts.bookmarks).toBe(0);
    expect(counts.configs).toBe(0);
  });
});

// ============================================================
// Tests: readLegacyData
// ============================================================

describe('readLegacyData', () => {
  it('parses old global keys correctly', () => {
    const bm = makeBookmarkedCopy();
    const sc = makeSavedConfig();

    localStorage.setItem('hk-cantonese-bookmarks', JSON.stringify([bm]));
    localStorage.setItem('hk-cantonese-configs', JSON.stringify([sc]));

    const result = readLegacyData();
    expect(result.bookmarks).toHaveLength(1);
    expect(result.bookmarks[0].id).toBe('bm-001');
    expect(result.bookmarks[0].content).toBe('測試繁體文案');
    expect(result.configs).toHaveLength(1);
    expect(result.configs[0].id).toBe('sc-001');
    expect(result.configs[0].name).toBe('Test Config');
  });

  it('returns empty arrays when legacy keys do not exist', () => {
    const result = readLegacyData();
    expect(result.bookmarks).toEqual([]);
    expect(result.configs).toEqual([]);
  });

  it('returns empty arrays when legacy keys contain invalid JSON', () => {
    localStorage.setItem('hk-cantonese-bookmarks', '{broken');
    localStorage.setItem('hk-cantonese-configs', 'not-json');

    const result = readLegacyData();
    expect(result.bookmarks).toEqual([]);
    expect(result.configs).toEqual([]);
  });

  it('handles partially missing keys', () => {
    const bm = makeBookmarkedCopy();
    localStorage.setItem('hk-cantonese-bookmarks', JSON.stringify([bm]));
    // No configs key

    const result = readLegacyData();
    expect(result.bookmarks).toHaveLength(1);
    expect(result.configs).toEqual([]);
  });
});

// ============================================================
// Tests: legacy import markers
// ============================================================

describe('markLegacyImported / isLegacyImported', () => {
  it('marks and checks legacy imported status', () => {
    expect(isLegacyImported('user-001')).toBe(false);

    markLegacyImported('user-001');

    expect(isLegacyImported('user-001')).toBe(true);
  });

  it('is per-user — different users have independent markers', () => {
    markLegacyImported('user-A');

    expect(isLegacyImported('user-A')).toBe(true);
    expect(isLegacyImported('user-B')).toBe(false);
  });
});

// ============================================================
// Tests: bookmarkToSyncFavorite
// ============================================================

describe('bookmarkToSyncFavorite', () => {
  it('converts all fields correctly', () => {
    const bm = makeBookmarkedCopy({
      notes: 'my note',
      rating: 5,
      favoriteReason: 'great copy',
      reasonTags: ['hook', 'emoji'],
      variantMeta: { headline: 'Test', altHeadlines: [], ctaLine: 'Buy now' },
      scores: { generated: { cantoneseNaturalness: 80, brandSafety: 90, platformFit: 85, readability: 88, creativity: 75, hookStrength: 70, emojiHashtagFit: 80, engagementPotential: 82, total: 81 }, source: null },
      consumerFeedback: [{ personaId: 'p1', personaName: 'Alice', feedback: 'Nice', rating: 4 }],
    });

    const result = bookmarkToSyncFavorite(bm);

    expect(result.clientId).toBe('bm-001');
    expect(result.variantKey).toBe('standardHK');
    expect(result.content).toBe('測試繁體文案');
    expect(result.source).toBe('測試原始文字');
    expect(result.notes).toBe('my note');
    expect(result.rating).toBe(5);
    expect(result.favoriteReason).toBe('great copy');
    expect(result.reasonTags).toEqual(['hook', 'emoji']);
    expect(result.savedAt).toBe('2026-07-12T10:00:00Z');
    expect(result.settings).toBeDefined();
    expect(result.variantMeta).toBeDefined();
    expect(result.scores).toBeDefined();
    expect(result.consumerFeedback).toBeDefined();
  });

  it('converts null/undefined optional fields to null', () => {
    const bm = makeBookmarkedCopy({
      notes: undefined,
      rating: undefined,
      favoriteReason: undefined,
      reasonTags: undefined,
      variantMeta: undefined,
      scores: undefined,
      consumerFeedback: undefined,
    });

    const result = bookmarkToSyncFavorite(bm);

    expect(result.notes).toBeNull();
    expect(result.rating).toBeNull();
    expect(result.favoriteReason).toBeNull();
    expect(result.reasonTags).toBeNull();
  });
});

// ============================================================
// Tests: favoriteRecordToBookmark
// ============================================================

describe('favoriteRecordToBookmark', () => {
  it('converts cloud record back to local format', () => {
    const fr = makeFavoriteRecord({
      variantMeta: { headline: 'H1' },
      variantKey: 'ig',
    });

    const result = favoriteRecordToBookmark(fr);

    expect(result.id).toBe('bm-001'); // from clientId
    expect(result.savedAt).toBe('2026-07-12T10:00:00Z');
    expect(result.variantKey).toBe('ig');
    expect(result.content).toBe('測試繁體文案');
    expect(result.source).toBe('測試原始文字');
    expect(result.notes).toBe('test note');
    expect(result.rating).toBe(4);
    expect(result.favoriteReason).toBe('good hook');
    expect(result.reasonTags).toEqual(['hook', 'tone']);
    expect(result.settings).toBeDefined();
    expect(result.variantMeta).toBeDefined();
  });

  it('converts null optional fields to undefined', () => {
    const fr = makeFavoriteRecord({
      notes: null,
      rating: null,
      favoriteReason: null,
      reasonTags: null,
      variantMeta: null,
      scores: null,
      consumerFeedback: null,
    });

    const result = favoriteRecordToBookmark(fr);

    expect(result.notes).toBeUndefined();
    expect(result.rating).toBeUndefined();
    expect(result.favoriteReason).toBeUndefined();
    expect(result.reasonTags).toBeUndefined();
  });
});

// ============================================================
// Tests: configToSyncConfig
// ============================================================

describe('configToSyncConfig', () => {
  it('converts all fields correctly', () => {
    const sc = makeSavedConfig({
      id: 'sc-abc',
      name: 'Summer Campaign',
      brandName: 'Brand X',
      platform: 'facebook',
      tone: '高級',
    });

    const result = configToSyncConfig(sc);

    expect(result.clientId).toBe('sc-abc');
    expect(result.name).toBe('Summer Campaign');
    expect(result.config).toBeDefined();
    expect((result.config as Record<string, unknown>).brandName).toBe('Brand X');
    expect((result.config as Record<string, unknown>).platform).toBe('facebook');
    expect((result.config as Record<string, unknown>).selectedReferenceCaseIds)
      .toEqual(['favorite-a', 'favorite-b']);
  });
});

// ============================================================
// Tests: configRecordToSavedConfig
// ============================================================

describe('configRecordToSavedConfig', () => {
  it('converts cloud record back to local format', () => {
    const scr = makeSavedConfigRecord({
      clientId: 'sc-local-id',
      name: 'My Saved',
      config: {
        brandName: 'Brand Y',
        productName: 'Prod Z',
        brandRedLines: 'None',
        structuredBriefEnabled: true,
        creativityLevel: 4,
        cantoneseLevel: 5,
        englishMixingLevel: 1,
        tone: '街坊',
        platform: 'shorts',
        inputLanguage: 'cantonese',
        consumerPersonas: [],
        selectedReferenceCaseIds: ['favorite-a', 'favorite-b'],
        createdAt: '2026-06-01T00:00:00Z',
      },
    });

    const result = configRecordToSavedConfig(scr);

    expect(result.id).toBe('sc-local-id');
    expect(result.name).toBe('My Saved');
    expect(result.brandName).toBe('Brand Y');
    expect(result.productName).toBe('Prod Z');
    expect(result.tone).toBe('街坊');
    expect(result.platform).toBe('shorts');
    expect(result.inputLanguage).toBe('cantonese');
    expect(result.creativityLevel).toBe(4);
    expect(result.selectedReferenceCaseIds).toEqual(['favorite-a', 'favorite-b']);
  });
});

// ============================================================
// Tests: API error handling
// ============================================================

describe('API error handling', () => {
  function setupAuth() {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: 'fake-jwt' },
      },
      error: null,
    });
  }

  beforeEach(() => {
    setupAuth();
  });

  it('network failure throws with user-friendly message', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBootstrap()).rejects.toThrow('Failed to fetch');
  });

  it('401 response throws with server error message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({ error: 'Unauthorized' }, 401, false),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBootstrap()).rejects.toThrow('Unauthorized');
  });

  it('500 response throws with generic fallback message', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({}, 500, false),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(syncFavoriteUp({
      clientId: 'x', variantKey: 'standardHK', content: '', source: '', settings: {},
    })).rejects.toThrow('Failed to sync favorite (500)');
  });

  it('throws with sanitized message when json parse fails on error response', async () => {
    const badResponse = {
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('Invalid JSON')),
    } as Response;

    const fetchMock = vi.fn().mockResolvedValue(badResponse);
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchBootstrap()).rejects.toThrow('Failed to fetch bootstrap (502)');
  });
});
