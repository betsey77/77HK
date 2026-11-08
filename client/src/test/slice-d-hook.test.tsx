/**
 * Slice D: useCloudSync hook — behavior tests (TDD)
 *
 * Architecture:
 * - Mock cloudSync service module (all API functions)
 * - Mock supabase auth (getSession)
 * - Wrap hook + dispatch in a SINGLE AppProvider
 * - Expose dispatch via global API so tests can trigger reducer actions
 * - Use waitFor to poll for expected side-effects
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import React, { useEffect } from 'react';
import { AppProvider, AppContext } from '../context/AppContext';
import type { BookmarkedCopy, SavedConfig, BootstrapResponse, FavoriteRecord, AppAction } from '../types';

// ============================================================
// Hoisted mocks
// ============================================================

const {
  mockFetchBootstrap,
  mockRecordActivity,
  mockSyncFavoriteUp,
  mockSyncFavoriteDelete,
  mockSyncConfigUp,
  mockSyncConfigDelete,
  mockSyncBrandProfile,
  mockSyncImport,
  mockHasLegacyGlobalKeys,
  mockGetLegacyItemCounts,
  mockReadLegacyData,
  mockIsLegacyImported,
  mockMarkLegacyImported,
  mockGetSession,
} = vi.hoisted(() => ({
  mockFetchBootstrap: vi.fn(),
  mockRecordActivity: vi.fn(),
  mockSyncFavoriteUp: vi.fn(),
  mockSyncFavoriteDelete: vi.fn(),
  mockSyncConfigUp: vi.fn(),
  mockSyncConfigDelete: vi.fn(),
  mockSyncBrandProfile: vi.fn(),
  mockSyncImport: vi.fn(),
  mockHasLegacyGlobalKeys: vi.fn(() => false),
  mockGetLegacyItemCounts: vi.fn(() => ({ bookmarks: 0, configs: 0 })),
  mockReadLegacyData: vi.fn(() => ({ bookmarks: [], configs: [] })),
  mockIsLegacyImported: vi.fn(() => true),
  mockMarkLegacyImported: vi.fn(),
  mockGetSession: vi.fn(),
}));

vi.mock('../services/cloudSync', () => ({
  fetchBootstrap: mockFetchBootstrap,
  recordActivity: mockRecordActivity,
  syncFavoriteUp: mockSyncFavoriteUp,
  syncFavoriteDelete: mockSyncFavoriteDelete,
  syncConfigUp: mockSyncConfigUp,
  syncConfigDelete: mockSyncConfigDelete,
  syncBrandProfile: mockSyncBrandProfile,
  syncImport: mockSyncImport,
  bookmarkToSyncFavorite: (b: BookmarkedCopy) => ({
    clientId: b.id, variantKey: b.variantKey, content: b.content, source: b.source,
    settings: b.settings as unknown as Record<string, unknown>,
    notes: b.notes ?? null, rating: b.rating ?? null,
    favoriteReason: b.favoriteReason ?? null, reasonTags: b.reasonTags ?? null, savedAt: b.savedAt,
    isUserAuthored: b.isUserAuthored ?? false,
    reviewRequested: b.reviewRequested ?? false,
  }),
  configToSyncConfig: (c: SavedConfig) => ({
    clientId: c.id, name: c.name, config: c as unknown as Record<string, unknown>,
  }),
  favoriteRecordToBookmark: (r: FavoriteRecord) => ({
    id: r.clientId, savedAt: r.savedAt, variantKey: r.variantKey,
    content: r.content, source: r.source,
    settings: r.settings as unknown as BookmarkedCopy['settings'],
    variantMeta: null, scores: null, consumerFeedback: null,
    notes: r.notes ?? undefined, rating: r.rating ?? undefined,
    favoriteReason: r.favoriteReason ?? undefined, reasonTags: r.reasonTags ?? undefined,
    isUserAuthored: r.isUserAuthored ?? false,
    reviewRequested: r.reviewRequested ?? false,
    reviewRequestedAt: r.reviewRequestedAt ?? null,
  }),
  configRecordToSavedConfig: (r: { clientId: string; name: string; config: Record<string, unknown> }) => ({
    id: r.clientId, name: r.name, brandName: '', productName: '', brandRedLines: '',
    structuredBriefEnabled: false, creativityLevel: 1, cantoneseLevel: 4,
    englishMixingLevel: 1, tone: '穩妥' as const, platform: 'all' as const,
    inputLanguage: 'mandarin' as const, consumerPersonas: [], createdAt: '',
  }),
  hasLegacyGlobalKeys: () => mockHasLegacyGlobalKeys(),
  getLegacyItemCounts: () => mockGetLegacyItemCounts(),
  readLegacyData: () => mockReadLegacyData(),
  isLegacyImported: (...args: [string]) => mockIsLegacyImported(...args),
  markLegacyImported: (...args: [string]) => mockMarkLegacyImported(...args),
}));

vi.mock('../services/supabase', () => ({
  supabase: { auth: { getSession: () => mockGetSession() } },
}));

// Dynamic import AFTER mocks
let useCloudSync: typeof import('../hooks/useCloudSync').useCloudSync;
beforeAll(async () => {
  useCloudSync = (await import('../hooks/useCloudSync')).useCloudSync;
});

// ============================================================
// Test data
// ============================================================

const OWNER_ID = 'test-user-123';

function makeBookmark(id: string, overrides: Partial<BookmarkedCopy> = {}): BookmarkedCopy {
  return {
    id, savedAt: '2026-07-12T10:00:00Z', variantKey: 'standardHK',
    content: 'content-' + id, source: 'source',
    settings: { platform: 'ig', tone: '活潑', cantoneseLevel: 3, englishMixingLevel: 2, creativityLevel: 2, inputLanguage: 'mandarin', brandName: '', productName: '', brandRedLines: '', structuredBriefEnabled: false, consumerPersonas: [] },
    ...overrides,
  };
}

function makeConfig(id: string): SavedConfig {
  return {
    id, name: 'Config ' + id, brandName: '', productName: '', brandRedLines: '',
    structuredBriefEnabled: false, creativityLevel: 2, cantoneseLevel: 3,
    englishMixingLevel: 2, tone: '活潑', platform: 'ig', inputLanguage: 'mandarin',
    consumerPersonas: [], createdAt: '2026-07-12T10:00:00Z',
  };
}

function makeFavoriteRecord(clientId: string, overrides: Partial<FavoriteRecord> = {}): FavoriteRecord {
  return {
    id: 'rec-' + clientId, ownerId: OWNER_ID, clientId,
    variantKey: 'standardHK', content: 'cloud-' + clientId, source: 'source', settings: {},
    savedAt: '2026-07-12T10:00:00Z', createdAt: '2026-07-12T10:00:00Z', updatedAt: '2026-07-12T10:00:00Z',
    ...overrides,
  };
}

// ============================================================
// Single-render harness: hook + dispatch in ONE AppProvider
// ============================================================

interface HookResult {
  syncStatus: string;
  syncError: string | null;
  legacyImportAvailable: boolean;
  legacyBookmarkCount: number;
  legacyConfigCount: number;
}

/**
 * Renders useCloudSync within AppProvider and exposes:
 * - __hookApi: { retryHydration, importLegacyData, skipLegacyImport, dismissSyncError, syncBrandProfileToCloud }
 * - __hookDispatch: reducer dispatch function
 * - __hookResults: array of observed state snapshots
 */
function SingleHarness({
  ownerId,
  isAuthenticated,
  results,
}: {
  ownerId: string;
  isAuthenticated: boolean;
  results: HookResult[];
}) {
  const { dispatch } = React.useContext(AppContext);
  const hookResult = useCloudSync(ownerId, isAuthenticated);

  useEffect(() => {
    results.push({
      syncStatus: hookResult.syncStatus,
      syncError: hookResult.syncError,
      legacyImportAvailable: hookResult.legacyImportAvailable,
      legacyBookmarkCount: hookResult.legacyBookmarkCount,
      legacyConfigCount: hookResult.legacyConfigCount,
    });
  });

  // Expose via global for test access
  useEffect(() => {
    (globalThis as Record<string, unknown>).__hookApi = {
      retryHydration: hookResult.retryHydration,
      importLegacyData: hookResult.importLegacyData,
      skipLegacyImport: hookResult.skipLegacyImport,
      dismissSyncError: hookResult.dismissSyncError,
      syncBrandProfileToCloud: hookResult.syncBrandProfileToCloud,
    };
    (globalThis as Record<string, unknown>).__hookDispatch = dispatch;
  });

  return null;
}

function renderSingleHarness(ownerId = OWNER_ID, isAuthenticated = true) {
  const results: HookResult[] = [];

  const { unmount } = render(
    React.createElement(AppProvider, { ownerId },
      React.createElement(SingleHarness, { ownerId, isAuthenticated, results }),
    ),
  );

  return { results, unmount };
}

// ============================================================
// Helpers
// ============================================================

async function waitForStatus(expectedStatus: string, results: HookResult[], timeout = 2000): Promise<HookResult | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const m = results.find((r) => r.syncStatus === expectedStatus);
    if (m) return m;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

async function waitFor(predicate: () => boolean, timeout = 3000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return predicate();
}

function dispatchViaGlobal(action: AppAction) {
  const d = (globalThis as Record<string, unknown>).__hookDispatch as React.Dispatch<AppAction>;
  if (!d) throw new Error('dispatch not available');
  d(action);
}

function api() {
  return (globalThis as Record<string, unknown>).__hookApi as {
    retryHydration: () => void;
    importLegacyData: () => Promise<unknown>;
    skipLegacyImport: () => void;
    dismissSyncError: () => void;
    syncBrandProfileToCloud: (a?: string | null, b?: string | null, c?: string | null) => Promise<void>;
  };
}

// ============================================================
// Setup / teardown
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: OWNER_ID } } }, error: null,
  });
  mockFetchBootstrap.mockResolvedValue({
    favorites: [], savedConfigs: [], brandProfile: null,
  } as BootstrapResponse);
  mockRecordActivity.mockResolvedValue(undefined);
  mockIsLegacyImported.mockReturnValue(true);
  mockHasLegacyGlobalKeys.mockReturnValue(false);
  mockSyncImport.mockResolvedValue({ favorites: { imported: 0, updated: 0 }, savedConfigs: { imported: 0, updated: 0 } });
  mockSyncFavoriteUp.mockResolvedValue({ id: 'rec', ownerId: OWNER_ID, clientId: 'x' });
  mockSyncFavoriteDelete.mockResolvedValue(undefined);
  mockSyncConfigUp.mockResolvedValue({ id: 'rec', ownerId: OWNER_ID, clientId: 'x' } as Record<string, unknown>);
  mockSyncConfigDelete.mockResolvedValue(undefined);
  mockSyncBrandProfile.mockResolvedValue({ id: 'bp', ownerId: OWNER_ID });
});

afterEach(() => {
  localStorage.clear();
  delete (globalThis as Record<string, unknown>).__hookApi;
  delete (globalThis as Record<string, unknown>).__hookDispatch;
});

// ============================================================
// Tests
// ============================================================

describe('useCloudSync', () => {
  // 1. idle → hydrating → ready
  it('1. idle → hydrating → ready on successful bootstrap', async () => {
    const { results } = renderSingleHarness();
    const ready = await waitForStatus('ready', results);
    expect(ready).not.toBeNull();
    expect(ready!.syncError).toBeNull();
    const statuses = results.map((r) => r.syncStatus);
    expect(statuses).toContain('hydrating');
    expect(statuses).toContain('ready');
  });

  it('1b. reports the authenticated account once after the first successful bootstrap', async () => {
    const { results } = renderSingleHarness();
    expect(await waitForStatus('ready', results)).not.toBeNull();
    await waitFor(() => mockRecordActivity.mock.calls.length > 0);

    expect(mockRecordActivity).toHaveBeenCalledTimes(1);
    expect(mockRecordActivity).toHaveBeenCalledWith(OWNER_ID);
  });

  it('1c. keeps the workbench ready when activity reporting fails', async () => {
    mockRecordActivity.mockRejectedValueOnce(new Error('telemetry unavailable'));
    const { results } = renderSingleHarness();

    const ready = await waitForStatus('ready', results);
    expect(ready).not.toBeNull();
    expect(ready!.syncError).toBeNull();
    expect(mockRecordActivity).toHaveBeenCalledWith(OWNER_ID);
  });

  // 2. Not permanently spinning
  it('2. stays hydrating then transitions to ready', async () => {
    mockFetchBootstrap.mockImplementation(() => new Promise((r) => {
      setTimeout(() => r({ favorites: [], savedConfigs: [], brandProfile: null }), 200);
    }));
    const { results } = renderSingleHarness();
    await new Promise((r) => setTimeout(r, 50));
    const hydrating = results.find((r) => r.syncStatus === 'hydrating');
    expect(hydrating).toBeDefined();
    const ready = await waitForStatus('ready', results, 3000);
    expect(ready).not.toBeNull();
  });

  // 3. Retry
  it('3. retry: first bootstrap fails, click retry, second succeeds', async () => {
    mockFetchBootstrap.mockRejectedValueOnce(new Error('Network error'));
    const { results } = renderSingleHarness();
    const err = await waitForStatus('error', results);
    expect(err).not.toBeNull();

    mockFetchBootstrap.mockResolvedValue({ favorites: [], savedConfigs: [], brandProfile: null });
    await act(async () => { api().retryHydration(); });
    const ready = await waitForStatus('ready', results, 3000);
    expect(ready).not.toBeNull();
  });

  // 4. Hydration does NOT trigger upsert/delete
  it('4. hydration does not trigger upsert/delete calls', async () => {
    mockFetchBootstrap.mockResolvedValue({
      favorites: [makeFavoriteRecord('bm-cloud')], savedConfigs: [], brandProfile: null,
    });
    const { results } = renderSingleHarness();
    const ready = await waitForStatus('ready', results);
    expect(ready).not.toBeNull();
    expect(mockSyncFavoriteUp).not.toHaveBeenCalled();
    expect(mockSyncFavoriteDelete).not.toHaveBeenCalled();
    expect(mockSyncConfigUp).not.toHaveBeenCalled();
    expect(mockSyncConfigDelete).not.toHaveBeenCalled();
  });

  // 5. ADD_BOOKMARK triggers syncFavoriteUp (via diff effect)
  it('5. ADD_BOOKMARK triggers syncFavoriteUp with correct payload', async () => {
    const { results } = renderSingleHarness();
    const ready = await waitForStatus('ready', results);
    expect(ready).not.toBeNull();

    // Dispatch a bookmark into state via the SAME context
    const bm = makeBookmark('bm-new-diff');
    await act(async () => {
      dispatchViaGlobal({ type: 'ADD_BOOKMARK', payload: bm });
    });

    // The diff effect should fire and call syncFavoriteUp
    await waitFor(() => mockSyncFavoriteUp.mock.calls.length > 0);
    expect(mockSyncFavoriteUp).toHaveBeenCalled();

    // Verify the payload has the correct clientId
    const lastCall = mockSyncFavoriteUp.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(lastCall).toBeDefined();
    expect(lastCall?.clientId).toBe('bm-new-diff');
  });

  it('5b. review request toggle is sent to cloud sync', async () => {
    mockFetchBootstrap.mockResolvedValue({
      favorites: [makeFavoriteRecord('bm-review', {
        isUserAuthored: true,
        reviewRequested: false,
        reviewRequestedAt: null,
      })],
      savedConfigs: [],
      brandProfile: null,
    });
    const { results } = renderSingleHarness();
    expect(await waitForStatus('ready', results)).not.toBeNull();

    await act(async () => {
      dispatchViaGlobal({
        type: 'UPDATE_BOOKMARK_REVIEW_REQUEST',
        payload: { id: 'bm-review', reviewRequested: true },
      });
    });

    await waitFor(() => mockSyncFavoriteUp.mock.calls.length > 0);
    const lastCall = mockSyncFavoriteUp.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(lastCall).toMatchObject({ clientId: 'bm-review', reviewRequested: true });
  });

  // 6. ADD_BOOKMARK with rating/reason includes rating in sync payload
  it('6. ADD_BOOKMARK with rating triggers syncFavoriteUp including rating data', async () => {
    const { results } = renderSingleHarness();
    const ready = await waitForStatus('ready', results);
    expect(ready).not.toBeNull();

    // Add a new bookmark with rating and reason tags
    const bm = makeBookmark('bm-rated-new', { rating: 5, favoriteReason: 'great', reasonTags: ['hook', 'tone'] });
    await act(async () => {
      dispatchViaGlobal({ type: 'ADD_BOOKMARK', payload: bm });
    });

    await waitFor(() => mockSyncFavoriteUp.mock.calls.length > 0);

    // Verify the sync call includes the rating and reason data
    const lastCall = mockSyncFavoriteUp.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;
    expect(lastCall).toBeDefined();
    expect(lastCall?.clientId).toBe('bm-rated-new');
    expect(lastCall?.rating).toBe(5);
    expect(lastCall?.favoriteReason).toBe('great');
    expect(lastCall?.reasonTags).toEqual(['hook', 'tone']);
  });

  // 7. REMOVE_BOOKMARK triggers syncFavoriteDelete
  it('7. REMOVE_BOOKMARK triggers syncFavoriteDelete', async () => {
    mockFetchBootstrap.mockResolvedValue({
      favorites: [makeFavoriteRecord('bm-del')],
      savedConfigs: [], brandProfile: null,
    });
    const { results } = renderSingleHarness();
    const ready = await waitForStatus('ready', results);
    expect(ready).not.toBeNull();

    await act(async () => {
      dispatchViaGlobal({ type: 'REMOVE_BOOKMARK', payload: 'bm-del' });
    });

    await waitFor(() => mockSyncFavoriteDelete.mock.calls.length > 0);
    expect(mockSyncFavoriteDelete).toHaveBeenCalledWith('bm-del', OWNER_ID);
  });

  // 8. New config triggers syncConfigUp
  it('8. SET_SAVED_CONFIGS new item triggers syncConfigUp', async () => {
    const { results } = renderSingleHarness();
    const ready = await waitForStatus('ready', results);
    expect(ready).not.toBeNull();

    const cfg = makeConfig('cfg-new');
    await act(async () => {
      dispatchViaGlobal({ type: 'SET_SAVED_CONFIGS', payload: [cfg] });
    });

    await waitFor(() => mockSyncConfigUp.mock.calls.length > 0);
    expect(mockSyncConfigUp).toHaveBeenCalled();
  });

  // 9. Sync failure enqueues to outbox
  it('9. sync failure enqueues to outbox; retry replays outbox', async () => {
    const { results } = renderSingleHarness();
    const ready = await waitForStatus('ready', results);
    expect(ready).not.toBeNull();

    // Make syncFavoriteUp fail
    mockSyncFavoriteUp.mockRejectedValue(new Error('Network error'));

    const bm = makeBookmark('bm-outbox');
    await act(async () => {
      dispatchViaGlobal({ type: 'ADD_BOOKMARK', payload: bm });
    });

    // Wait for outbox entry
    await waitFor(() => {
      const raw = localStorage.getItem(`hk-cantonese-sync-outbox:${OWNER_ID}`);
      return raw !== null && JSON.parse(raw).length > 0;
    });

    const outboxRaw = localStorage.getItem(`hk-cantonese-sync-outbox:${OWNER_ID}`);
    expect(outboxRaw).not.toBeNull();
    const outbox = JSON.parse(outboxRaw!);
    expect(outbox.length).toBeGreaterThan(0);
    expect(outbox[0].op).toBe('upsert-fav');

    // Fix the mock and retry
    mockSyncFavoriteUp.mockResolvedValue({ id: 'rec', ownerId: OWNER_ID, clientId: 'bm-outbox' });
    mockFetchBootstrap.mockResolvedValue({ favorites: [], savedConfigs: [], brandProfile: null });

    await act(async () => { api().retryHydration(); });
    const ready2 = await waitForStatus('ready', results, 3000);
    expect(ready2).not.toBeNull();

    // Outbox should be empty after replay
    const after = localStorage.getItem(`hk-cantonese-sync-outbox:${OWNER_ID}`);
    expect(after ? JSON.parse(after).length : 0).toBe(0);
  });

  // 10. Migration marker prevents local import
  it('10. marker=true prevents local import even when local data exists', async () => {
    localStorage.setItem(`hk-cantonese-cloud-migrated:${OWNER_ID}`, 'true');
    localStorage.setItem(`hk-cantonese-bookmarks:${OWNER_ID}`, JSON.stringify([makeBookmark('local-bm')]));
    mockIsLegacyImported.mockReturnValue(true);

    const { results } = renderSingleHarness();
    const ready = await waitForStatus('ready', results);
    expect(ready).not.toBeNull();

    const importCalls = mockSyncImport.mock.calls.filter(
      (c) => c[0]?.favorites?.length > 0 || c[0]?.savedConfigs?.length > 0,
    );
    expect(importCalls.length).toBe(0);
  });

  // 11. Legacy import dispatches items
  it('11. legacy import: importLegacyData syncs dispatch and hides banner', async () => {
    mockHasLegacyGlobalKeys.mockReturnValue(true);
    mockIsLegacyImported.mockReturnValue(false);
    mockGetLegacyItemCounts.mockReturnValue({ bookmarks: 1, configs: 0 });
    mockReadLegacyData.mockReturnValue({ bookmarks: [makeBookmark('legacy-bm')], configs: [] });
    mockSyncImport.mockResolvedValue({ favorites: { imported: 1, updated: 0 }, savedConfigs: { imported: 0, updated: 0 } });

    const { results } = renderSingleHarness();
    const ready = await waitForStatus('ready', results);
    expect(ready).not.toBeNull();
    expect(ready!.legacyImportAvailable).toBe(true);

    await act(async () => { await api().importLegacyData(); });

    await waitFor(() => {
      const last = results[results.length - 1];
      return last && last.legacyImportAvailable === false;
    });
    expect(mockMarkLegacyImported).toHaveBeenCalledWith(OWNER_ID);
    expect(mockSyncImport).toHaveBeenCalled();
  });

  // 12. skipLegacyImport hides banner
  it('12. skip: skipLegacyImport hides banner permanently', async () => {
    mockHasLegacyGlobalKeys.mockReturnValue(true);
    mockIsLegacyImported.mockReturnValue(false);
    mockGetLegacyItemCounts.mockReturnValue({ bookmarks: 2, configs: 1 });

    const { results } = renderSingleHarness();
    const ready = await waitForStatus('ready', results);
    expect(ready).not.toBeNull();
    expect(ready!.legacyImportAvailable).toBe(true);

    await act(async () => { api().skipLegacyImport(); });
    await waitFor(() => {
      const last = results[results.length - 1];
      return last && last.legacyImportAvailable === false;
    });
    expect(mockMarkLegacyImported).toHaveBeenCalledWith(OWNER_ID);
  });

  // 13. Owner mismatch
  it('13. owner mismatch: bootstrap with wrong ownerId → error state', async () => {
    mockFetchBootstrap.mockResolvedValue({
      favorites: [{ id: 'rec', ownerId: 'other-user', clientId: 'bm-x', variantKey: 'standardHK', content: 'x', source: 'x', settings: {}, savedAt: '', createdAt: '', updatedAt: '' }],
      savedConfigs: [], brandProfile: null,
    });
    const { results } = renderSingleHarness();
    const err = await waitForStatus('error', results);
    expect(err).not.toBeNull();
    expect(err!.syncError).toContain('owner mismatch');
  });

  // 14. Brand profile sync
  it('14. brand profile sync fires on syncBrandProfileToCloud call', async () => {
    const { results } = renderSingleHarness();
    const ready = await waitForStatus('ready', results);
    expect(ready).not.toBeNull();

    await act(async () => { await api().syncBrandProfileToCloud('MyBrand', 'MyProduct', 'NoPolitics'); });
    expect(mockSyncBrandProfile).toHaveBeenCalledWith({
      brandName: 'MyBrand', productName: 'MyProduct', brandRedLines: 'NoPolitics',
    }, OWNER_ID);
  });

  it('15. existing bookmark note and rating changes are upserted', async () => {
    mockFetchBootstrap.mockResolvedValue({
      favorites: [makeFavoriteRecord('bm-existing')], savedConfigs: [], brandProfile: null,
    });
    const { results } = renderSingleHarness();
    expect(await waitForStatus('ready', results)).not.toBeNull();
    mockSyncFavoriteUp.mockClear();

    await act(async () => {
      dispatchViaGlobal({
        type: 'UPDATE_BOOKMARK_NOTES',
        payload: { id: 'bm-existing', notes: 'new note' },
      });
    });
    expect(await waitFor(() => mockSyncFavoriteUp.mock.calls.length >= 1)).toBe(true);
    expect(mockSyncFavoriteUp.mock.calls.at(-1)?.[0]).toMatchObject({
      clientId: 'bm-existing', notes: 'new note',
    });

    await act(async () => {
      dispatchViaGlobal({
        type: 'UPDATE_BOOKMARK_RATING',
        payload: { id: 'bm-existing', rating: 5, favoriteReason: '自然', reasonTags: ['语气'] },
      });
    });
    expect(await waitFor(() => mockSyncFavoriteUp.mock.calls.length >= 2)).toBe(true);
    expect(mockSyncFavoriteUp.mock.calls.at(-1)?.[0]).toMatchObject({
      clientId: 'bm-existing', rating: 5, favoriteReason: '自然', reasonTags: ['语气'],
    });
    expect(mockSyncFavoriteUp.mock.calls.at(-1)?.[1]).toBe(OWNER_ID);
  });

  it('16. existing config changes and deletion are synced', async () => {
    mockFetchBootstrap.mockResolvedValue({
      favorites: [],
      savedConfigs: [{
        id: 'row-cfg', ownerId: OWNER_ID, clientId: 'cfg-existing', name: 'Old',
        config: {}, createdAt: '2026-07-12T10:00:00Z', updatedAt: '2026-07-12T10:00:00Z',
      }],
      brandProfile: null,
    });
    const { results } = renderSingleHarness();
    expect(await waitForStatus('ready', results)).not.toBeNull();
    mockSyncConfigUp.mockClear();
    mockSyncConfigDelete.mockClear();

    const changed = { ...makeConfig('cfg-existing'), name: 'Changed' };
    await act(async () => {
      dispatchViaGlobal({ type: 'SET_SAVED_CONFIGS', payload: [changed] });
    });
    expect(await waitFor(() => mockSyncConfigUp.mock.calls.length >= 1)).toBe(true);
    expect(mockSyncConfigUp.mock.calls.at(-1)?.[0]).toMatchObject({
      clientId: 'cfg-existing', name: 'Changed',
    });
    expect(mockSyncConfigUp.mock.calls.at(-1)?.[1]).toBe(OWNER_ID);

    await act(async () => {
      dispatchViaGlobal({ type: 'SET_SAVED_CONFIGS', payload: [] });
    });
    expect(await waitFor(() => mockSyncConfigDelete.mock.calls.length >= 1)).toBe(true);
    expect(mockSyncConfigDelete).toHaveBeenCalledWith('cfg-existing', OWNER_ID);
  });

  it('17. reducer brand changes and clearing are synced', async () => {
    const { results } = renderSingleHarness();
    expect(await waitForStatus('ready', results)).not.toBeNull();
    mockSyncBrandProfile.mockClear();

    await act(async () => {
      dispatchViaGlobal({ type: 'SET_BRAND_NAME', payload: 'Brand A' });
      dispatchViaGlobal({ type: 'SET_PRODUCT_NAME', payload: 'Product A' });
      dispatchViaGlobal({ type: 'SET_BRAND_RED_LINES', payload: 'No claims' });
    });
    expect(await waitFor(() => mockSyncBrandProfile.mock.calls.some((call) =>
      call[0]?.brandName === 'Brand A'
      && call[0]?.productName === 'Product A'
      && call[0]?.brandRedLines === 'No claims'))).toBe(true);

    await act(async () => {
      dispatchViaGlobal({ type: 'SET_BRAND_NAME', payload: '' });
      dispatchViaGlobal({ type: 'SET_PRODUCT_NAME', payload: '' });
      dispatchViaGlobal({ type: 'SET_BRAND_RED_LINES', payload: '' });
    });
    expect(await waitFor(() => mockSyncBrandProfile.mock.calls.some((call) =>
      call[0]?.brandName === null
      && call[0]?.productName === null
      && call[0]?.brandRedLines === null))).toBe(true);
  });

  // 15. Anonymous skips hydration
  it('18. anonymous owner does not start hydration', async () => {
    const { results } = renderSingleHarness('anonymous', true);
    await new Promise((r) => setTimeout(r, 500));
    const last = results[results.length - 1];
    expect(last?.syncStatus).toBe('idle');
    expect(mockFetchBootstrap).not.toHaveBeenCalled();
  });

  // 16. Not authenticated skips hydration
  it('19. not authenticated skips hydration entirely', async () => {
    const { results } = renderSingleHarness(OWNER_ID, false);
    await new Promise((r) => setTimeout(r, 500));
    const last = results[results.length - 1];
    expect(last?.syncStatus).toBe('idle');
    expect(mockFetchBootstrap).not.toHaveBeenCalled();
  });
});
