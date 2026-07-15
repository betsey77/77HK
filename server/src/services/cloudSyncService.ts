import { createUserClient } from './supabase.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FavoriteRecord,
  SavedConfigRecord,
  BrandProfileRecord,
  BootstrapResponse,
  SyncFavoriteRequest,
  SyncConfigRequest,
  SyncBrandProfileRequest,
  SyncImportRequest,
  SyncImportResponse,
} from '../types/index.js';
import { FREE_FAVORITE_LIMIT, resolveUserPlanId } from './planAccessService.js';

// ============================================================
// Column mapping: snake_case (DB) ↔ camelCase (TS)
// ============================================================

function toFavorite(
  row: Record<string, unknown>,
  adminReview?: FavoriteRecord['adminReview'],
): FavoriteRecord {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    clientId: row.client_id as string,
    variantKey: row.variant_key as string,
    content: row.content as string,
    source: row.source as string,
    settings: row.settings as Record<string, unknown>,
    variantMeta: (row.variant_meta as Record<string, unknown> | null) ?? null,
    scores: (row.scores as Record<string, unknown> | null) ?? null,
    consumerFeedback: (row.consumer_feedback as Record<string, unknown>[] | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    rating: (row.rating as number | null) ?? null,
    favoriteReason: (row.favorite_reason as string | null) ?? null,
    reasonTags: Array.isArray(row.reason_tags) ? (row.reason_tags as string[]) : [],
    savedAt: row.saved_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    contentRevision: typeof row.content_revision === 'number' ? row.content_revision : 1,
    contentEditedAt: (row.content_edited_at as string | null) ?? null,
    isUserAuthored: row.is_user_authored === true,
    reviewRequested: row.review_requested === true,
    reviewRequestedAt: (row.review_requested_at as string | null) ?? null,
    adminReview: adminReview ?? null,
  };
}

function toSavedConfig(row: Record<string, unknown>): SavedConfigRecord {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    clientId: row.client_id as string,
    name: row.name as string,
    config: row.config as Record<string, unknown>,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toBrandProfile(row: Record<string, unknown>): BrandProfileRecord {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    brandName: (row.brand_name as string | null) ?? null,
    productName: (row.product_name as string | null) ?? null,
    brandRedLines: (row.brand_red_lines as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ============================================================
// Helpers
// ============================================================

/** Map camelCase request body to snake_case DB columns */
function favoriteToDb(data: SyncFavoriteRequest, ownerId: string): Record<string, unknown> {
  return {
    owner_id: ownerId,
    client_id: data.clientId,
    variant_key: data.variantKey,
    content: data.content,
    source: data.source,
    settings: data.settings,
    variant_meta: data.variantMeta ?? null,
    scores: data.scores ?? null,
    consumer_feedback: data.consumerFeedback ?? null,
    notes: data.notes ?? null,
    rating: data.rating ?? null,
    favorite_reason: data.favoriteReason ?? null,
    reason_tags: Array.isArray(data.reasonTags) ? data.reasonTags : [],
    saved_at: data.savedAt ?? new Date().toISOString(),
    is_user_authored: data.isUserAuthored ?? false,
    review_requested: data.reviewRequested ?? false,
  };
}

function configToDb(data: SyncConfigRequest, ownerId: string): Record<string, unknown> {
  return {
    owner_id: ownerId,
    client_id: data.clientId,
    name: data.name,
    config: data.config,
  };
}

function brandProfileToDb(data: SyncBrandProfileRequest, ownerId: string): Record<string, unknown> {
  return {
    owner_id: ownerId,
    brand_name: data.brandName ?? null,
    product_name: data.productName ?? null,
    brand_red_lines: data.brandRedLines ?? null,
  };
}

// ============================================================
// MAX_SAVED_CONFIGS
// ============================================================

const MAX_SAVED_CONFIGS = 20;

async function countConfigs(client: SupabaseClient, ownerId: string): Promise<number> {
  const { count, error } = await client
    .from('saved_configs')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId);

  if (error) throw new Error('Failed to count saved configs');
  return count ?? 0;
}

// ============================================================
// Public API
// ============================================================

/** Bootstrap: returns all user's cloud data at once */
export async function getBootstrap(
  jwt: string,
  ownerId: string,
): Promise<BootstrapResponse> {
  const client = createUserClient(jwt);

  const [favRes, cfgRes, bpRes] = await Promise.all([
    client.from('favorites').select('*').eq('owner_id', ownerId).order('saved_at', { ascending: false }),
    client.from('saved_configs').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false }),
    client.from('brand_profiles').select('*').eq('owner_id', ownerId).maybeSingle(),
  ]);

  if (favRes.error) throw new Error('Failed to load favorites');
  if (cfgRes.error) throw new Error('Failed to load saved configs');
  if (bpRes.error) throw new Error('Failed to load brand profile');

  const favRows = (favRes.data ?? []) as Record<string, unknown>[];
  const favoriteIds = favRows.map((r) => r.id as string).filter(Boolean);

  // Owner-readable admin reviews via RLS (status/note/updated_at only).
  const reviewByFavoriteId = new Map<string, NonNullable<FavoriteRecord['adminReview']>>();
  if (favoriteIds.length > 0) {
    const reviewRes = await client
      .from('favorite_admin_reviews')
      .select('favorite_id,review_status,note,annotations,updated_at')
      .in('favorite_id', favoriteIds);
    if (reviewRes.error) throw new Error('Failed to load favorite reviews');
    for (const row of (reviewRes.data ?? []) as {
      favorite_id: string;
      review_status: string;
      note: string | null;
      annotations: unknown;
      updated_at: string;
    }[]) {
      if (row.review_status !== 'adopted' && row.review_status !== 'changes_requested') continue;
      reviewByFavoriteId.set(row.favorite_id, {
        status: row.review_status,
        note: row.note ?? null,
        annotations: Array.isArray(row.annotations)
          ? row.annotations as NonNullable<FavoriteRecord['adminReview']>['annotations']
          : [],
        updatedAt: row.updated_at,
      });
    }
  }

  return {
    favorites: favRows.map((row) =>
      toFavorite(row, reviewByFavoriteId.get(row.id as string) ?? null),
    ),
    savedConfigs: (cfgRes.data ?? []).map(toSavedConfig),
    brandProfile: bpRes.data ? toBrandProfile(bpRes.data) : null,
  };
}

/** Upsert a favorite by (owner_id, client_id) */
export async function upsertFavorite(
  jwt: string,
  ownerId: string,
  data: SyncFavoriteRequest,
): Promise<FavoriteRecord> {
  const client = createUserClient(jwt);

  if (await resolveUserPlanId(ownerId) === 'free') {
    const existing = await client
      .from('favorites')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('client_id', data.clientId)
      .maybeSingle();

    if (existing.error) throw new Error('Failed to verify favorite capacity');

    if (!existing.data) {
      const { count, error: countError } = await client
        .from('favorites')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', ownerId);

      if (countError) throw new Error('Failed to verify favorite capacity');
      if ((count ?? 0) >= FREE_FAVORITE_LIMIT) {
        throw {
          status: 403,
          code: 'PLAN_LIMIT',
          message: `Free 最多保存 ${FREE_FAVORITE_LIMIT} 条收藏`,
        };
      }
    }
  }

  // owner_id is set from the trusted BFF (JWT), never from the request body.
  // The route layer already calls rejectOverpost() to block body owner_id/ownerId/id.
  const dbRow = favoriteToDb(data, ownerId);

  const { data: row, error } = await client
    .from('favorites')
    .upsert(dbRow, { onConflict: 'owner_id, client_id' })
    .select('*')
    .single();

  if (error) {
    // Sanitise: never leak constraint/table names
    throw new Error('Failed to save favorite');
  }

  return toFavorite(row);
}

/** Explicit owner-scoped content edit. Every revision enters the admin review queue. */
export async function updateFavoriteContent(
  jwt: string,
  ownerId: string,
  clientId: string,
  content: string,
): Promise<FavoriteRecord> {
  const client = createUserClient(jwt);
  const { data: row, error } = await client
    .from('favorites')
    .update({ content, review_requested: true })
    .eq('owner_id', ownerId)
    .eq('client_id', clientId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error('Failed to update favorite content');
  if (!row) throw { status: 404, message: 'Favorite not found' };

  const reviewRes = await client
    .from('favorite_admin_reviews')
    .select('review_status,note,annotations,updated_at')
    .eq('favorite_id', row.id)
    .maybeSingle();
  if (reviewRes.error) throw new Error('Failed to load favorite review');
  const reviewRow = reviewRes.data as {
    review_status: string;
    note: string | null;
    annotations: unknown;
    updated_at: string;
  } | null;
  const adminReview = reviewRow
    && (reviewRow.review_status === 'adopted' || reviewRow.review_status === 'changes_requested')
    ? {
        status: reviewRow.review_status,
        note: reviewRow.note ?? null,
        annotations: Array.isArray(reviewRow.annotations)
          ? reviewRow.annotations as NonNullable<FavoriteRecord['adminReview']>['annotations']
          : [],
        updatedAt: reviewRow.updated_at,
      } satisfies NonNullable<FavoriteRecord['adminReview']>
    : null;

  return toFavorite(row as Record<string, unknown>, adminReview);
}

/** Delete a favorite by (owner_id, client_id). Returns true if deleted, false if not found. */
export async function deleteFavorite(
  jwt: string,
  ownerId: string,
  clientId: string,
): Promise<boolean> {
  const client = createUserClient(jwt);

  const { error, count } = await client
    .from('favorites')
    .delete({ count: 'exact' })
    .eq('owner_id', ownerId)
    .eq('client_id', clientId);

  if (error) {
    throw new Error('Failed to delete favorite');
  }

  return (count ?? 0) > 0;
}

/** Upsert a saved config by (owner_id, client_id) */
export async function upsertConfig(
  jwt: string,
  ownerId: string,
  data: SyncConfigRequest,
): Promise<SavedConfigRecord> {
  const client = createUserClient(jwt);

  // Check config count before inserting (only for new inserts)
  const existing = await client
    .from('saved_configs')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('client_id', data.clientId)
    .maybeSingle();

  if (!existing.data) {
    const currentCount = await countConfigs(client, ownerId);
    if (currentCount >= MAX_SAVED_CONFIGS) {
      throw new Error(`You have reached the maximum of ${MAX_SAVED_CONFIGS} saved configs`);
    }
  }

  const dbRow = configToDb(data, ownerId);

  const { data: row, error } = await client
    .from('saved_configs')
    .upsert(dbRow, { onConflict: 'owner_id, client_id' })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23US1' || error.message?.includes('config_limit_exceeded')) {
      throw { status: 400, message: `You have reached the maximum of ${MAX_SAVED_CONFIGS} saved configs` };
    }
    throw new Error('Failed to save config');
  }

  return toSavedConfig(row);
}

/** Delete a saved config by (owner_id, client_id). Returns true if deleted, false if not found. */
export async function deleteConfig(
  jwt: string,
  ownerId: string,
  clientId: string,
): Promise<boolean> {
  const client = createUserClient(jwt);

  const { error, count } = await client
    .from('saved_configs')
    .delete({ count: 'exact' })
    .eq('owner_id', ownerId)
    .eq('client_id', clientId);

  if (error) {
    throw new Error('Failed to delete config');
  }

  return (count ?? 0) > 0;
}

/** Upsert brand profile (MVP: one per user) */
export async function upsertBrandProfile(
  jwt: string,
  ownerId: string,
  data: SyncBrandProfileRequest,
): Promise<BrandProfileRecord> {
  const client = createUserClient(jwt);
  const dbRow = brandProfileToDb(data, ownerId);

  const { data: row, error } = await client
    .from('brand_profiles')
    .upsert(dbRow, { onConflict: 'owner_id' })
    .select('*')
    .single();

  if (error) {
    throw new Error('Failed to save brand profile');
  }

  return toBrandProfile(row);
}

/** Idempotent bulk import */
export async function importData(
  jwt: string,
  ownerId: string,
  data: SyncImportRequest,
): Promise<SyncImportResponse> {
  const favorites = data.favorites ?? [];
  const savedConfigs = data.savedConfigs ?? [];

  let favImported = 0;
  let favUpdated = 0;
  let cfgImported = 0;
  let cfgUpdated = 0;

  const client = createUserClient(jwt);

  if (favorites.length > 0 && await resolveUserPlanId(ownerId) === 'free') {
    const { data: existingRows, error } = await client
      .from('favorites')
      .select('client_id')
      .eq('owner_id', ownerId);

    if (error) throw new Error('Failed to verify favorite capacity');
    const existingIds = new Set(
      (existingRows ?? []).map((row: Record<string, unknown>) => row.client_id as string),
    );
    const newIds = new Set(
      favorites.map((favorite) => favorite.clientId).filter((clientId) => !existingIds.has(clientId)),
    );

    if (existingIds.size + newIds.size > FREE_FAVORITE_LIMIT) {
      throw {
        status: 403,
        code: 'PLAN_LIMIT',
        message: `导入后将超过 Free 的 ${FREE_FAVORITE_LIMIT} 条收藏上限`,
      };
    }
  }

  // Import favorites
  for (const fav of favorites) {
    const dbRow = favoriteToDb(fav, ownerId);

    // Check if exists
    const { data: existing } = await client
      .from('favorites')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('client_id', fav.clientId)
      .maybeSingle();

    if (existing) {
      favUpdated++;
    } else {
      favImported++;
    }

    const { error } = await client
      .from('favorites')
      .upsert(dbRow, { onConflict: 'owner_id, client_id' });

    if (error) {
      throw new Error('Failed to import favorites');
    }
  }

  // Import saved configs
  for (const cfg of savedConfigs) {
    const dbRow = configToDb(cfg, ownerId);

    const { data: existing } = await client
      .from('saved_configs')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('client_id', cfg.clientId)
      .maybeSingle();

    if (existing) {
      cfgUpdated++;
    } else {
      cfgImported++;
    }

    const { error } = await client
      .from('saved_configs')
      .upsert(dbRow, { onConflict: 'owner_id, client_id' });

    if (error) {
      if (error.code === '23US1' || error.message?.includes('config_limit_exceeded')) {
        throw { status: 400, message: `You have reached the maximum of ${MAX_SAVED_CONFIGS} saved configs` };
      }
      throw new Error('Failed to import saved configs');
    }
  }

  return {
    favorites: { imported: favImported, updated: favUpdated },
    savedConfigs: { imported: cfgImported, updated: cfgUpdated },
  };
}
