/**
 * Slice D: Cloud Sync Service
 *
 * Handles syncing local data (bookmarks, saved configs, brand profile)
 * to the server via /api/sync/* endpoints.
 *
 * Also provides legacy key detection for migrating data from old
 * global (non-namespaced) localStorage keys to per-user namespaced keys.
 */

import { supabase } from './supabase';
import type {
  BootstrapResponse, SyncFavoriteRequest, SyncConfigRequest,
  SyncBrandProfileRequest, SyncImportRequest, SyncImportResponse,
  FavoriteRecord, SavedConfigRecord, BrandProfileRecord,
  BookmarkedCopy, SavedConfig,
} from '../types';

const API_BASE = '/api';

// ============================================================
// Helpers
// ============================================================

/** Get current auth headers (JWT), optionally pinned to the active account. */
export async function getAuthHeaders(expectedOwnerId?: string): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (expectedOwnerId && session?.user?.id !== expectedOwnerId) {
    throw new Error('Session owner mismatch');
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

/** Convert BookmarkedCopy (local) → SyncFavoriteRequest (API format) */
export function bookmarkToSyncFavorite(b: BookmarkedCopy): SyncFavoriteRequest {
  return {
    clientId: b.id,
    variantKey: b.variantKey,
    content: b.content,
    source: b.source,
    settings: b.settings as unknown as Record<string, unknown>,
    variantMeta: b.variantMeta as unknown as Record<string, unknown> | null | undefined,
    scores: b.scores as unknown as Record<string, unknown> | null | undefined,
    consumerFeedback: b.consumerFeedback as unknown as Record<string, unknown>[] | null | undefined,
    notes: b.notes ?? null,
    rating: b.rating ?? null,
    favoriteReason: b.favoriteReason ?? null,
    reasonTags: b.reasonTags ?? null,
    savedAt: b.savedAt,
  };
}

/** Convert SavedConfig (local) → SyncConfigRequest (API format) */
export function configToSyncConfig(c: SavedConfig): SyncConfigRequest {
  return {
    clientId: c.id,
    name: c.name,
    config: {
      brandName: c.brandName,
      productName: c.productName,
      brandRedLines: c.brandRedLines,
      structuredBriefEnabled: c.structuredBriefEnabled,
      creativityLevel: c.creativityLevel,
      cantoneseLevel: c.cantoneseLevel,
      englishMixingLevel: c.englishMixingLevel,
      tone: c.tone,
      platform: c.platform,
      inputLanguage: c.inputLanguage,
      consumerPersonas: c.consumerPersonas,
      targetDate: c.targetDate,
      competitorQueries: c.competitorQueries,
      selectedCalendarEventIds: c.selectedCalendarEventIds,
      createdAt: c.createdAt,
    },
  };
}

/** Convert FavoriteRecord (cloud) → BookmarkedCopy (local format) */
export function favoriteRecordToBookmark(r: FavoriteRecord): BookmarkedCopy {
  return {
    id: r.clientId,
    savedAt: r.savedAt,
    variantKey: r.variantKey as BookmarkedCopy['variantKey'],
    content: r.content,
    source: r.source,
    settings: r.settings as unknown as BookmarkedCopy['settings'],
    variantMeta: r.variantMeta as unknown as BookmarkedCopy['variantMeta'],
    scores: r.scores as unknown as BookmarkedCopy['scores'],
    consumerFeedback: r.consumerFeedback as unknown as BookmarkedCopy['consumerFeedback'],
    notes: r.notes ?? undefined,
    rating: r.rating ?? undefined,
    favoriteReason: r.favoriteReason ?? undefined,
    reasonTags: r.reasonTags ?? undefined,
  };
}

/** Convert SavedConfigRecord (cloud) → SavedConfig (local format) */
export function configRecordToSavedConfig(r: SavedConfigRecord): SavedConfig {
  const cfg = r.config as Record<string, unknown>;
  return {
    id: r.clientId,
    name: r.name,
    brandName: (cfg.brandName as string) ?? '',
    productName: (cfg.productName as string) ?? '',
    brandRedLines: (cfg.brandRedLines as string) ?? '',
    structuredBriefEnabled: (cfg.structuredBriefEnabled as boolean) ?? false,
    creativityLevel: (cfg.creativityLevel as number) ?? 1,
    cantoneseLevel: (cfg.cantoneseLevel as number) ?? 4,
    englishMixingLevel: (cfg.englishMixingLevel as number) ?? 1,
    tone: (cfg.tone as SavedConfig['tone']) ?? '穩妥',
    platform: (cfg.platform as SavedConfig['platform']) ?? 'all',
    inputLanguage: (cfg.inputLanguage as SavedConfig['inputLanguage']) ?? 'mandarin',
    consumerPersonas: (cfg.consumerPersonas as SavedConfig['consumerPersonas']) ?? [],
    targetDate: cfg.targetDate as string | undefined,
    competitorQueries: (cfg.competitorQueries as string[]) ?? [],
    selectedCalendarEventIds: (cfg.selectedCalendarEventIds as string[]) ?? [],
    createdAt: (cfg.createdAt as string) ?? r.createdAt,
  };
}

// ============================================================
// API calls
// ============================================================

/** Fetch all cloud data for the current user */
export async function fetchBootstrap(expectedOwnerId?: string): Promise<BootstrapResponse> {
  const headers = await getAuthHeaders(expectedOwnerId);
  const res = await fetch(`${API_BASE}/sync/bootstrap`, { headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Failed to fetch bootstrap (${res.status})`,
    );
  }

  return res.json() as Promise<BootstrapResponse>;
}

/** Upsert a single favorite to the cloud */
export async function syncFavoriteUp(data: SyncFavoriteRequest, expectedOwnerId?: string): Promise<FavoriteRecord> {
  const headers = await getAuthHeaders(expectedOwnerId);
  const res = await fetch(`${API_BASE}/sync/favorites`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Failed to sync favorite (${res.status})`,
    );
  }

  return res.json() as Promise<FavoriteRecord>;
}

/** Delete a favorite from the cloud by clientId */
export async function syncFavoriteDelete(clientId: string, expectedOwnerId?: string): Promise<void> {
  const headers = await getAuthHeaders(expectedOwnerId);
  const res = await fetch(`${API_BASE}/sync/favorites/${encodeURIComponent(clientId)}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Failed to delete favorite (${res.status})`,
    );
  }
}

/** Upsert a single saved config to the cloud */
export async function syncConfigUp(data: SyncConfigRequest, expectedOwnerId?: string): Promise<SavedConfigRecord> {
  const headers = await getAuthHeaders(expectedOwnerId);
  const res = await fetch(`${API_BASE}/sync/configs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Failed to sync config (${res.status})`,
    );
  }

  return res.json() as Promise<SavedConfigRecord>;
}

/** Delete a saved config from the cloud by clientId */
export async function syncConfigDelete(clientId: string, expectedOwnerId?: string): Promise<void> {
  const headers = await getAuthHeaders(expectedOwnerId);
  const res = await fetch(`${API_BASE}/sync/configs/${encodeURIComponent(clientId)}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Failed to delete config (${res.status})`,
    );
  }
}

/** Upsert brand profile to the cloud */
export async function syncBrandProfile(data: SyncBrandProfileRequest, expectedOwnerId?: string): Promise<BrandProfileRecord> {
  const headers = await getAuthHeaders(expectedOwnerId);
  const res = await fetch(`${API_BASE}/sync/brand-profile`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Failed to sync brand profile (${res.status})`,
    );
  }

  return res.json() as Promise<BrandProfileRecord>;
}

/** Bulk import local data to cloud */
export async function syncImport(data: SyncImportRequest, expectedOwnerId?: string): Promise<SyncImportResponse> {
  const headers = await getAuthHeaders(expectedOwnerId);
  const res = await fetch(`${API_BASE}/sync/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Failed to import data (${res.status})`,
    );
  }

  return res.json() as Promise<SyncImportResponse>;
}

// ============================================================
// Legacy key detection
// ============================================================

const LEGACY_BOOKMARKS_KEY = 'hk-cantonese-bookmarks';
const LEGACY_CONFIGS_KEY = 'hk-cantonese-configs';
const LEGACY_IMPORTED_MARKER_PREFIX = 'hk-cantonese-legacy-imported';

/**
 * Check if old global (non-namespaced) localStorage keys exist.
 *
 * Old format: `hk-cantonese-bookmarks`, `hk-cantonese-configs`
 * New format: `hk-cantonese-bookmarks:${userId}`, `hk-cantonese-configs:${userId}`
 */
export function hasLegacyGlobalKeys(): boolean {
  return localStorage.getItem(LEGACY_BOOKMARKS_KEY) !== null
    || localStorage.getItem(LEGACY_CONFIGS_KEY) !== null;
}

/** Get count of legacy items (for UI prompt) */
export function getLegacyItemCounts(): { bookmarks: number; configs: number } {
  let bookmarks = 0;
  let configs = 0;

  try {
    const rawBookmarks = localStorage.getItem(LEGACY_BOOKMARKS_KEY);
    if (rawBookmarks) {
      const parsed = JSON.parse(rawBookmarks);
      bookmarks = Array.isArray(parsed) ? parsed.length : 0;
    }
  } catch {
    // Ignore parse errors — return 0
  }

  try {
    const rawConfigs = localStorage.getItem(LEGACY_CONFIGS_KEY);
    if (rawConfigs) {
      const parsed = JSON.parse(rawConfigs);
      configs = Array.isArray(parsed) ? parsed.length : 0;
    }
  } catch {
    // Ignore parse errors — return 0
  }

  return { bookmarks, configs };
}

/** Read legacy data for import (called only when user confirms) */
export function readLegacyData(): { bookmarks: BookmarkedCopy[]; configs: SavedConfig[] } {
  let bookmarks: BookmarkedCopy[] = [];
  let configs: SavedConfig[] = [];

  try {
    const rawBookmarks = localStorage.getItem(LEGACY_BOOKMARKS_KEY);
    if (rawBookmarks) {
      const parsed = JSON.parse(rawBookmarks);
      bookmarks = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // Ignore parse errors — return empty
  }

  try {
    const rawConfigs = localStorage.getItem(LEGACY_CONFIGS_KEY);
    if (rawConfigs) {
      const parsed = JSON.parse(rawConfigs);
      configs = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // Ignore parse errors — return empty
  }

  return { bookmarks, configs };
}

/**
 * Store a marker that legacy data has been imported for this user.
 * Prevents re-prompting the user after a successful import.
 */
export function markLegacyImported(userId: string): void {
  localStorage.setItem(`${LEGACY_IMPORTED_MARKER_PREFIX}:${userId}`, 'true');
}

/**
 * Check if legacy data has already been imported for a given user.
 */
export function isLegacyImported(userId: string): boolean {
  return localStorage.getItem(`${LEGACY_IMPORTED_MARKER_PREFIX}:${userId}`) === 'true';
}
