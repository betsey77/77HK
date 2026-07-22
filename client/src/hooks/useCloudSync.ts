import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppContext } from '../context/AppContext';
import { supabase } from '../services/supabase';
import type { BookmarkedCopy, SavedConfig } from '../types';
import * as cloudSync from '../services/cloudSync';

function migrationMarker(ownerId: string) {
  return `hk-cantonese-cloud-migrated:${ownerId}`;
}

function outboxKey(ownerId: string) {
  return `hk-cantonese-sync-outbox:${ownerId}`;
}

function snapshotKey(ownerId: string, kind: string) {
  return `hk-cantonese-snapshot-v2-${kind}:${ownerId}`;
}

type OutboxEntry =
  | { op: 'upsert-fav'; clientId: string; payload: Record<string, unknown> }
  | { op: 'delete-fav'; clientId: string }
  | { op: 'upsert-cfg'; clientId: string; payload: Record<string, unknown> }
  | { op: 'delete-cfg'; clientId: string }
  | { op: 'upsert-brand'; payload: Record<string, unknown> };

type ItemSnapshot = Record<string, string>;

function loadOutbox(ownerId: string): OutboxEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(outboxKey(ownerId)) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOutbox(ownerId: string, entries: OutboxEntry[]) {
  try {
    localStorage.setItem(outboxKey(ownerId), JSON.stringify(entries));
  } catch {
    // A localStorage failure must not block local editing.
  }
}

function sameOutboxTarget(left: OutboxEntry, right: OutboxEntry) {
  if (left.op === 'upsert-brand' || right.op === 'upsert-brand') {
    return left.op === 'upsert-brand' && right.op === 'upsert-brand';
  }
  const leftKind = left.op.endsWith('fav') ? 'fav' : 'cfg';
  const rightKind = right.op.endsWith('fav') ? 'fav' : 'cfg';
  return leftKind === rightKind && left.clientId === right.clientId;
}

function loadSnapshot(ownerId: string, kind: string): ItemSnapshot {
  try {
    const parsed = JSON.parse(localStorage.getItem(snapshotKey(ownerId, kind)) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveSnapshot(ownerId: string, kind: string, snapshot: ItemSnapshot) {
  try {
    localStorage.setItem(snapshotKey(ownerId, kind), JSON.stringify(snapshot));
  } catch {
    // Snapshot persistence is an optimisation; the cloud remains authoritative.
  }
}

function bookmarkSnapshot(items: BookmarkedCopy[]): ItemSnapshot {
  return Object.fromEntries(items.map((item) => [
    item.id,
    JSON.stringify(cloudSync.bookmarkToSyncFavorite(item)),
  ]));
}

function configSnapshot(items: SavedConfig[]): ItemSnapshot {
  return Object.fromEntries(items.map((item) => [
    item.id,
    JSON.stringify(cloudSync.configToSyncConfig(item)),
  ]));
}

function brandPayload(brandName: string, productName: string, brandRedLines: string) {
  return {
    brandName: brandName || null,
    productName: productName || null,
    brandRedLines: brandRedLines || null,
  };
}

function brandSnapshot(brandName: string, productName: string, brandRedLines: string): ItemSnapshot {
  return { current: JSON.stringify(brandPayload(brandName, productName, brandRedLines)) };
}

function mergeById<T extends { id: string }>(base: T[], additions: T[]) {
  const merged = new Map(base.map((item) => [item.id, item]));
  additions.forEach((item) => merged.set(item.id, item));
  return [...merged.values()];
}

/**
 * Hydrates account-scoped state and serialises later local mutations to cloud.
 * Cloud is authoritative after the one-time account-local migration succeeds.
 */
export function useCloudSync(ownerId: string, isAuthenticated: boolean) {
  const { state, dispatch } = useContext(AppContext);
  const [retryNonce, setRetryNonce] = useState(0);
  const hydrateRunRef = useRef(0);
  const activityReportedOwnerRef = useRef<string | null>(null);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());

  const enqueueOutbox = useCallback((entryOwnerId: string, entry: OutboxEntry) => {
    const withoutOlderTarget = loadOutbox(entryOwnerId)
      .filter((existing) => !sameOutboxTarget(existing, entry));
    saveOutbox(entryOwnerId, [...withoutOlderTarget, entry]);
    dispatch({ type: 'SET_SYNC_ERROR', payload: '部分数据仅保存在本机，请点击重试同步。' });
  }, [dispatch]);

  const replayOutbox = useCallback(async (entryOwnerId: string) => {
    const remaining: OutboxEntry[] = [];
    for (const entry of loadOutbox(entryOwnerId)) {
      try {
        switch (entry.op) {
          case 'upsert-fav':
            await cloudSync.syncFavoriteUp(
              entry.payload as unknown as Parameters<typeof cloudSync.syncFavoriteUp>[0],
              entryOwnerId,
            );
            break;
          case 'delete-fav':
            await cloudSync.syncFavoriteDelete(entry.clientId, entryOwnerId);
            break;
          case 'upsert-cfg':
            await cloudSync.syncConfigUp(
              entry.payload as unknown as Parameters<typeof cloudSync.syncConfigUp>[0],
              entryOwnerId,
            );
            break;
          case 'delete-cfg':
            await cloudSync.syncConfigDelete(entry.clientId, entryOwnerId);
            break;
          case 'upsert-brand':
            await cloudSync.syncBrandProfile(
              entry.payload as unknown as Parameters<typeof cloudSync.syncBrandProfile>[0],
              entryOwnerId,
            );
            break;
        }
      } catch {
        remaining.push(entry);
      }
    }
    saveOutbox(entryOwnerId, remaining);
    return remaining.length === 0;
  }, []);

  useEffect(() => {
    if (!isAuthenticated || ownerId === 'anonymous') return;
    const runId = ++hydrateRunRef.current;

    async function hydrate() {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'hydrating' });
      dispatch({ type: 'SET_SYNC_ERROR', payload: null });

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user || session.user.id !== ownerId) {
          throw new Error('当前登录账号与同步账号不一致');
        }

        // Replay before bootstrap so a stale cloud response cannot overwrite
        // a previously failed local optimistic mutation.
        if (!await replayOutbox(ownerId)) {
          throw new Error('仍有本地数据未同步，请重试');
        }

        const bootstrap = await cloudSync.fetchBootstrap(ownerId);
        if (hydrateRunRef.current !== runId) return;

        const hasForeignFavorite = bootstrap.favorites.some((item) => item.ownerId !== ownerId);
        const hasForeignConfig = bootstrap.savedConfigs.some((item) => item.ownerId !== ownerId);
        const hasForeignBrand = Boolean(
          bootstrap.brandProfile && bootstrap.brandProfile.ownerId !== ownerId,
        );
        if (hasForeignFavorite || hasForeignConfig || hasForeignBrand) {
          throw new Error('Cloud data owner mismatch');
        }

        let hydratedBookmarks = bootstrap.favorites.map(cloudSync.favoriteRecordToBookmark);
        let hydratedConfigs = bootstrap.savedConfigs.map(cloudSync.configRecordToSavedConfig);
        let hydratedBrand = {
          brandName: bootstrap.brandProfile?.brandName ?? null,
          productName: bootstrap.brandProfile?.productName ?? null,
          brandRedLines: bootstrap.brandProfile?.brandRedLines ?? null,
        };

        if (localStorage.getItem(migrationMarker(ownerId)) !== 'true') {
          const localKey = (kind: string) => `hk-cantonese-${kind}:${ownerId}`;
          let localBookmarks: BookmarkedCopy[] = [];
          let localConfigs: SavedConfig[] = [];
          try {
            const parsed = JSON.parse(localStorage.getItem(localKey('bookmarks')) ?? '[]');
            if (Array.isArray(parsed)) localBookmarks = parsed;
          } catch { /* keep empty */ }
          try {
            const parsed = JSON.parse(localStorage.getItem(localKey('configs')) ?? '[]');
            if (Array.isArray(parsed)) localConfigs = parsed;
          } catch { /* keep empty */ }

          const cloudBookmarkIds = new Set(hydratedBookmarks.map((item) => item.id));
          const cloudConfigIds = new Set(hydratedConfigs.map((item) => item.id));
          const localOnlyBookmarks = localBookmarks.filter((item) => !cloudBookmarkIds.has(item.id));
          const localOnlyConfigs = localConfigs.filter((item) => !cloudConfigIds.has(item.id));

          if (localOnlyBookmarks.length || localOnlyConfigs.length) {
            await cloudSync.syncImport({
              favorites: localOnlyBookmarks.map(cloudSync.bookmarkToSyncFavorite),
              savedConfigs: localOnlyConfigs.map(cloudSync.configToSyncConfig),
            }, ownerId);
            hydratedBookmarks = mergeById(hydratedBookmarks, localOnlyBookmarks);
            hydratedConfigs = mergeById(hydratedConfigs, localOnlyConfigs);
          }

          if (!bootstrap.brandProfile) {
            const localBrand = brandPayload(
              state.settings.brandName,
              state.settings.productName,
              state.settings.brandRedLines,
            );
            if (localBrand.brandName || localBrand.productName || localBrand.brandRedLines) {
              await cloudSync.syncBrandProfile(localBrand, ownerId);
              hydratedBrand = localBrand;
            }
          }

          localStorage.setItem(migrationMarker(ownerId), 'true');
        }

        if (hydrateRunRef.current !== runId) return;
        dispatch({ type: 'HYDRATE_BOOKMARKS', payload: hydratedBookmarks });
        dispatch({ type: 'HYDRATE_CONFIGS', payload: hydratedConfigs });
        dispatch({ type: 'HYDRATE_BRAND_PROFILE', payload: hydratedBrand });
        saveSnapshot(ownerId, 'bookmarks', bookmarkSnapshot(hydratedBookmarks));
        saveSnapshot(ownerId, 'configs', configSnapshot(hydratedConfigs));
        saveSnapshot(ownerId, 'brand', brandSnapshot(
          hydratedBrand.brandName ?? '',
          hydratedBrand.productName ?? '',
          hydratedBrand.brandRedLines ?? '',
        ));

        if (!cloudSync.isLegacyImported(ownerId) && cloudSync.hasLegacyGlobalKeys()) {
          const counts = cloudSync.getLegacyItemCounts();
          dispatch({
            type: 'SET_LEGACY_INFO',
            payload: {
              available: true,
              bookmarkCount: counts.bookmarks,
              configCount: counts.configs,
            },
          });
        } else {
          dispatch({
            type: 'SET_LEGACY_INFO',
            payload: { available: false, bookmarkCount: 0, configCount: 0 },
          });
        }

        if (hydrateRunRef.current === runId) {
          if (activityReportedOwnerRef.current !== ownerId) {
            activityReportedOwnerRef.current = ownerId;
            void cloudSync.recordActivity(ownerId).catch(() => {
              if (activityReportedOwnerRef.current === ownerId) {
                activityReportedOwnerRef.current = null;
              }
            });
          }
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'ready' });
        }
      } catch (error) {
        if (hydrateRunRef.current !== runId) return;
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
        dispatch({
          type: 'SET_SYNC_ERROR',
          payload: error instanceof Error ? error.message : '云端同步暂不可用',
        });
      }
    }

    void hydrate();
    return () => {
      if (hydrateRunRef.current === runId) hydrateRunRef.current += 1;
    };
    // The account-local brand is read only during the one-time migration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, isAuthenticated, retryNonce, dispatch, replayOutbox]);

  useEffect(() => {
    if (state.syncStatus !== 'ready' || !isAuthenticated || ownerId === 'anonymous') return;

    const bookmarks = state.bookmarkedCopies;
    const configs = state.savedConfigs;
    const currentBrand = brandPayload(
      state.settings.brandName,
      state.settings.productName,
      state.settings.brandRedLines,
    );

    syncQueueRef.current = syncQueueRef.current.catch(() => undefined).then(async () => {
      const previousBookmarks = loadSnapshot(ownerId, 'bookmarks');
      const previousConfigs = loadSnapshot(ownerId, 'configs');
      const previousBrand = loadSnapshot(ownerId, 'brand');
      const nextBookmarks = bookmarkSnapshot(bookmarks);
      const nextConfigs = configSnapshot(configs);
      const nextBrand = brandSnapshot(
        currentBrand.brandName ?? '',
        currentBrand.productName ?? '',
        currentBrand.brandRedLines ?? '',
      );

      for (const bookmark of bookmarks) {
        if (previousBookmarks[bookmark.id] === nextBookmarks[bookmark.id]) continue;
        const payload = cloudSync.bookmarkToSyncFavorite(bookmark);
        try {
          await cloudSync.syncFavoriteUp(payload, ownerId);
        } catch {
          enqueueOutbox(ownerId, {
            op: 'upsert-fav',
            clientId: bookmark.id,
            payload: payload as unknown as Record<string, unknown>,
          });
        }
      }
      for (const clientId of Object.keys(previousBookmarks)) {
        if (clientId in nextBookmarks) continue;
        try {
          await cloudSync.syncFavoriteDelete(clientId, ownerId);
        } catch {
          enqueueOutbox(ownerId, { op: 'delete-fav', clientId });
        }
      }

      for (const config of configs) {
        if (previousConfigs[config.id] === nextConfigs[config.id]) continue;
        const payload = cloudSync.configToSyncConfig(config);
        try {
          await cloudSync.syncConfigUp(payload, ownerId);
        } catch {
          enqueueOutbox(ownerId, {
            op: 'upsert-cfg',
            clientId: config.id,
            payload: payload as unknown as Record<string, unknown>,
          });
        }
      }
      for (const clientId of Object.keys(previousConfigs)) {
        if (clientId in nextConfigs) continue;
        try {
          await cloudSync.syncConfigDelete(clientId, ownerId);
        } catch {
          enqueueOutbox(ownerId, { op: 'delete-cfg', clientId });
        }
      }

      if (previousBrand.current !== nextBrand.current) {
        try {
          await cloudSync.syncBrandProfile(currentBrand, ownerId);
        } catch {
          enqueueOutbox(ownerId, {
            op: 'upsert-brand',
            payload: currentBrand as unknown as Record<string, unknown>,
          });
        }
      }

      saveSnapshot(ownerId, 'bookmarks', nextBookmarks);
      saveSnapshot(ownerId, 'configs', nextConfigs);
      saveSnapshot(ownerId, 'brand', nextBrand);
      if (loadOutbox(ownerId).length === 0) {
        dispatch({ type: 'SET_SYNC_ERROR', payload: null });
      }
    });
  }, [
    state.syncStatus,
    state.bookmarkedCopies,
    state.savedConfigs,
    state.settings.brandName,
    state.settings.productName,
    state.settings.brandRedLines,
    ownerId,
    isAuthenticated,
    dispatch,
    enqueueOutbox,
  ]);

  const retryHydration = useCallback(() => {
    setRetryNonce((value) => value + 1);
  }, []);

  const importLegacyData = useCallback(async () => {
    if (!isAuthenticated || ownerId === 'anonymous') return null;
    try {
      const legacy = cloudSync.readLegacyData();
      const result = await cloudSync.syncImport({
        favorites: legacy.bookmarks.map(cloudSync.bookmarkToSyncFavorite),
        savedConfigs: legacy.configs.map(cloudSync.configToSyncConfig),
      }, ownerId);
      const mergedBookmarks = mergeById(state.bookmarkedCopies, legacy.bookmarks);
      const mergedConfigs = mergeById(state.savedConfigs, legacy.configs);
      saveSnapshot(ownerId, 'bookmarks', bookmarkSnapshot(mergedBookmarks));
      saveSnapshot(ownerId, 'configs', configSnapshot(mergedConfigs));
      dispatch({ type: 'HYDRATE_BOOKMARKS', payload: mergedBookmarks });
      dispatch({ type: 'HYDRATE_CONFIGS', payload: mergedConfigs });
      cloudSync.markLegacyImported(ownerId);
      dispatch({ type: 'MARK_LEGACY_IMPORTED' });
      dispatch({ type: 'SET_SYNC_ERROR', payload: null });
      return result;
    } catch {
      dispatch({ type: 'SET_SYNC_ERROR', payload: '导入失败，请重试。' });
      return null;
    }
  }, [isAuthenticated, ownerId, state.bookmarkedCopies, state.savedConfigs, dispatch]);

  const skipLegacyImport = useCallback(() => {
    cloudSync.markLegacyImported(ownerId);
    dispatch({ type: 'MARK_LEGACY_IMPORTED' });
  }, [ownerId, dispatch]);

  const dismissSyncError = useCallback(() => {
    dispatch({ type: 'SET_SYNC_ERROR', payload: null });
  }, [dispatch]);

  // Kept for callers that need an explicit immediate brand flush; normal UI
  // changes are already covered by the state-diff effect above.
  const syncBrandProfileToCloud = useCallback(async (
    brandName?: string | null,
    productName?: string | null,
    brandRedLines?: string | null,
  ) => {
    if (!isAuthenticated || ownerId === 'anonymous') return;
    const payload = { brandName, productName, brandRedLines };
    try {
      await cloudSync.syncBrandProfile(payload, ownerId);
    } catch {
      enqueueOutbox(ownerId, {
        op: 'upsert-brand',
        payload: payload as unknown as Record<string, unknown>,
      });
    }
  }, [isAuthenticated, ownerId, enqueueOutbox]);

  return {
    syncStatus: state.syncStatus,
    syncError: state.syncError,
    legacyImportAvailable: state.legacyImportAvailable,
    legacyBookmarkCount: state.legacyBookmarkCount,
    legacyConfigCount: state.legacyConfigCount,
    syncBrandProfileToCloud,
    importLegacyData,
    skipLegacyImport,
    retryHydration,
    dismissSyncError,
  };
}
