import { createUserClient } from './supabase.js';
import { getTrustedSupabase } from './trustedSupabase.js';
import type {
  GenerationJob, GenerationJobSummary, GenerationStatus,
  CreateGenerationRequest, ListGenerationQuery,
} from '../types/index.js';

// ============================================================
// Column mapping: snake_case (DB) ↔ camelCase (TS)
// ============================================================

function toCamel(row: Record<string, unknown>): GenerationJob {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    idempotencyKey: row.idempotency_key as string,
    status: row.status as GenerationStatus,
    source: row.source as string,
    platform: row.platform as string,
    tone: row.tone as string,
    cantoneseLevel: row.cantonese_level as number,
    englishMixingLevel: row.english_mixing_level as number,
    creativityLevel: row.creativity_level as number,
    inputLanguage: row.input_language as string,
    brandName: row.brand_name as string | null,
    productName: row.product_name as string | null,
    brandRedLines: row.brand_red_lines as string | null,
    brief: row.brief as Record<string, unknown> | null,
    variants: row.variants as GenerationJob['variants'] | null,
    variantMeta: row.variant_meta as GenerationJob['variantMeta'] | null,
    diagnosis: row.diagnosis as GenerationJob['diagnosis'] | null,
    audit: row.audit as GenerationJob['audit'] | null,
    scores: row.scores as GenerationJob['scores'] | null,
    consumerFeedback: row.consumer_feedback as GenerationJob['consumerFeedback'] | null,
    generationEngine: row.generation_engine as string | null,
    errorMessage: row.error_message as string | null,
    errorCode: row.error_code as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    completedAt: row.completed_at as string | null,
    deletedAt: row.deleted_at as string | null,
  };
}

function toSummary(row: Record<string, unknown>): GenerationJobSummary {
  return {
    id: row.id as string,
    idempotencyKey: row.idempotency_key as string,
    status: row.status as GenerationStatus,
    source: row.source as string,
    platform: row.platform as string,
    tone: row.tone as string,
    brandName: row.brand_name as string | null,
    productName: row.product_name as string | null,
    createdAt: row.created_at as string,
    completedAt: row.completed_at as string | null,
  };
}

// ============================================================
// Atomic upsert using INSERT ... ON CONFLICT
// ============================================================

/**
 * Atomically create a generation job or return the existing one.
 *
 * Uses INSERT ... ON CONFLICT (owner_id, idempotency_key) DO NOTHING
 * followed by a SELECT to retrieve the row. This is atomic: concurrent
 * requests with the same idempotency key will create exactly ONE job.
 *
 * Rules for duplicate requests:
 * - completed → return existing result (200, created=false)
 * - processing/pending → return existing job (200, created=false);
 *   caller can poll or wait — model is NOT called again
 * - failed → return existing failed job (200, created=false);
 *   caller must use a NEW idempotency key to retry generation
 */
export async function upsertJob(
  ownerId: string,
  params: CreateGenerationRequest & { idempotencyKey: string },
): Promise<{ job: GenerationJob; created: boolean }> {
  const client = getTrustedSupabase();

  // Atomic: INSERT ... ON CONFLICT DO NOTHING.
  // If a row with same (owner_id, idempotency_key) already exists,
  // this is a no-op and returns 0 rows.
  const { error: insertError } = await client
    .from('generation_jobs')
    .insert({
      owner_id: ownerId,
      idempotency_key: params.idempotencyKey,
      status: 'pending',
      source: params.source,
      platform: params.platform ?? 'all',
      tone: params.tone ?? '穩妥',
      cantonese_level: params.cantoneseLevel ?? 2,
      english_mixing_level: params.englishMixingLevel ?? 1,
      creativity_level: params.creativityLevel ?? 2,
      input_language: params.inputLanguage ?? 'mandarin',
      brand_name: params.brandName ?? null,
      product_name: params.productName ?? null,
      brand_red_lines: params.brandRedLines ?? null,
      brief: params.brief ?? null,
      // Never accept lifecycle/result fields from the request. A new job is
      // always an empty pending record and only trusted lifecycle methods may
      // populate its result columns.
      variants: null,
      variant_meta: null,
      diagnosis: null,
      audit: null,
      scores: null,
      consumer_feedback: null,
      generation_engine: null,
      error_message: null,
      error_code: null,
      completed_at: null,
      deleted_at: null,
    });

  // If insert failed with unique violation, the job already exists.
  // Otherwise it's a real error.
  const isDuplicate = insertError?.code === '23505'
    || insertError?.message?.includes('duplicate key')
    || insertError?.message?.includes('unique')
    || insertError?.message?.includes('already exists');

  if (insertError && !isDuplicate) {
    throw new Error(`Failed to create generation job: ${insertError.message}`);
  }

  // Fetch the row (either newly created or existing)
  const { data: row, error: selectError } = await client
    .from('generation_jobs')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('idempotency_key', params.idempotencyKey)
    .maybeSingle();

  if (selectError || !row) {
    throw new Error(`Failed to retrieve generation job: ${selectError?.message ?? 'not found'}`);
  }

  const job = toCamel(row);
  const created = !isDuplicate;

  return { job, created };
}

// ============================================================
// Lifecycle transitions
// ============================================================

/**
 * Transition job to 'processing' — called before model invocation.
 *
 * @C2a-TRUSTED-WRITE: Uses trusted Supabase client (service_role) because
 * authenticated no longer has UPDATE grant on generation_jobs (see migration
 * 20260712000000). BFF enforces ownership via the WHERE clause.
 */
export async function markProcessing(
  jobId: string,
  ownerId: string,
): Promise<GenerationJob> {
  const db = getTrustedSupabase();

  const { data, error } = await db
    .from('generation_jobs')
    .update({
      status: 'processing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('owner_id', ownerId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to mark job as processing: ${error.message}`);
  return toCamel(data);
}

/**
 * Complete a job with successful results.
 *
 * @C2a-TRUSTED-WRITE: Uses trusted Supabase client (service_role) because
 * authenticated no longer has UPDATE grant on generation_jobs. BFF enforces
 * ownership via WHERE clause with owner_id.
 */
export async function completeJob(
  jobId: string,
  ownerId: string,
  data: {
    variants?: Record<string, unknown> | null;
    variantMeta?: Record<string, unknown> | null;
    diagnosis?: Record<string, unknown> | null;
    audit?: Record<string, unknown> | null;
    scores?: Record<string, unknown> | null;
    consumerFeedback?: Record<string, unknown>[] | null;
    generationEngine?: string | null;
  },
): Promise<GenerationJob> {
  const db = getTrustedSupabase();

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: 'completed',
    updated_at: now,
    completed_at: now,
  };

  if (data.variants !== undefined) update.variants = data.variants;
  if (data.variantMeta !== undefined) update.variant_meta = data.variantMeta;
  if (data.diagnosis !== undefined) update.diagnosis = data.diagnosis;
  if (data.audit !== undefined) update.audit = data.audit;
  if (data.scores !== undefined) update.scores = data.scores;
  if (data.consumerFeedback !== undefined) update.consumer_feedback = data.consumerFeedback;
  if (data.generationEngine !== undefined) update.generation_engine = data.generationEngine;

  const { data: updated, error } = await db
    .from('generation_jobs')
    .update(update)
    .eq('id', jobId)
    .eq('owner_id', ownerId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to complete generation job: ${error.message}`);
  return toCamel(updated);
}

/**
 * Mark job as failed with error details.
 *
 * @C2a-TRUSTED-WRITE: Uses trusted Supabase client (service_role) because
 * authenticated no longer has UPDATE grant on generation_jobs. BFF enforces
 * ownership via WHERE clause with owner_id.
 */
export async function failJob(
  jobId: string,
  ownerId: string,
  errorMessage: string,
  errorCode?: string,
): Promise<GenerationJob> {
  const db = getTrustedSupabase();

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('generation_jobs')
    .update({
      status: 'failed',
      error_message: errorMessage,
      error_code: errorCode ?? null,
      updated_at: now,
      completed_at: now,
    })
    .eq('id', jobId)
    .eq('owner_id', ownerId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to mark job as failed: ${error.message}`);
  return toCamel(data);
}

// ============================================================
// Queries
// ============================================================

/** List user's non-deleted jobs (summary only — no heavy jsonb) */
export async function listJobs(
  jwt: string,
  ownerId: string,
  query: ListGenerationQuery = {},
): Promise<{ jobs: GenerationJobSummary[]; total: number; lockedCount: number }> {
  const client = createUserClient(jwt);
  const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
  const offset = Math.max(query.offset ?? 0, 0);

  if (query.accessLimit) {
    const { data, error, count } = await client
      .from('generation_jobs')
      .select('id, idempotency_key, status, source, platform, tone, brand_name, product_name, created_at, completed_at', { count: 'exact' })
      .eq('owner_id', ownerId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(query.accessLimit);

    if (error) throw new Error(`Failed to list generation jobs: ${error.message}`);

    const terms = query.query?.toLocaleLowerCase().split(/\s+/).filter(Boolean) ?? [];
    const accessibleRows = ((data ?? []) as Record<string, unknown>[]).filter((row) => {
      if (terms.length === 0) return true;
      const searchable = [row.brand_name, row.product_name, row.source]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLocaleLowerCase();
      return terms.every((term) => searchable.includes(term));
    });

    return {
      jobs: accessibleRows.slice(offset, offset + limit).map(toSummary),
      total: accessibleRows.length,
      lockedCount: Math.max(0, (count ?? accessibleRows.length) - query.accessLimit),
    };
  }

  let request = client
    .from('generation_jobs')
    .select('id, idempotency_key, status, source, platform, tone, brand_name, product_name, created_at, completed_at', { count: 'exact' })
    .eq('owner_id', ownerId)
    .is('deleted_at', null);

  for (const term of query.query?.split(/\s+/).filter(Boolean) ?? []) {
    request = request.or(
      `brand_name.ilike.%${term}%,product_name.ilike.%${term}%,source.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await request
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`Failed to list generation jobs: ${error.message}`);
  return {
    jobs: (data ?? []).map(toSummary),
    total: count ?? 0,
    lockedCount: 0,
  };
}

/** Check whether a job is among the newest records available to a Free user. */
export async function isJobWithinHistoryLimit(
  jwt: string,
  ownerId: string,
  jobId: string,
  accessLimit: number,
): Promise<boolean> {
  const client = createUserClient(jwt);
  const { data, error } = await client
    .from('generation_jobs')
    .select('id')
    .eq('owner_id', ownerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(accessLimit);

  if (error) throw new Error('Failed to verify generation history access');
  return (data ?? []).some((row: Record<string, unknown>) => row.id === jobId);
}

/** Get a single job by id (with all fields), owner-scoped */
export async function getJob(
  jwt: string,
  jobId: string,
): Promise<GenerationJob | null> {
  const client = createUserClient(jwt);

  const { data, error } = await client
    .from('generation_jobs')
    .select('*')
    .eq('id', jobId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(`Failed to get generation job: ${error.message}`);
  if (!data) return null;
  return toCamel(data);
}

/** Soft-delete a job via SECURITY DEFINER RPC.
 *  Returns true if the job was deleted, false if not found / not owner / already deleted.
 *  DB errors are sanitised — no constraint names or table names leaked. */
export async function softDeleteJob(
  jwt: string,
  jobId: string,
): Promise<boolean> {
  const client = createUserClient(jwt);

  const { data, error } = await client
    .rpc('soft_delete_generation_job', { _job_id: jobId });

  if (error) {
    // Sanitise — never leak DB internals
    throw new Error('Failed to delete generation job');
  }

  return data === true;
}
