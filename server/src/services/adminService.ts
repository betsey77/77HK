/**
 * Admin Service — Slice G1 (schema-matched).
 *
 * Read-only queries for the admin dashboard. Uses the trusted (service_role)
 * client to aggregate across all users. Never returns passwords, tokens,
 * secrets, or full generation/feedback body text by default.
 *
 * Security:
 * - All functions use getTrustedSupabase() for cross-user aggregation.
 * - Field allowlists are enforced at this layer (never in the route).
 * - Pagination limits are enforced: max 100 rows per query.
 * - No write operations are exposed (except audit log append for detail views).
 * - All column references match the actual migration schema.
 * - No `select('*')` anywhere.
 * - No non-existent RPC calls.
 */
import { getTrustedSupabase } from './trustedSupabase.js';

// ── Types ──────────────────────────────────────────────────────

export interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalGenerations: number;
  totalFeedback: number;
  adminUsers: number;
}

export interface AdminUserOverview {
  id: string;
  displayName: string;
  userIdPrefix: string;
  roles: string[];
  status: string;
  createdAt: string;
  deletionRequestedAt: string | null;
  subscriptionPlan: string | null;
  generationCount: number;
}

export interface AdminGenerationMeta {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  status: string;
  platform: string;
  tone: string;
  generationEngine: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AdminFeedbackSummary {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  type: string;
  title: string;
  notifyStatus: string;
  createdAt: string;
}

export interface AdminSubscriptionOverview {
  id: string;
  userId: string;
  userDisplayName: string;
  planName: string;
  status: string;
  quotaUsed: number;
  quotaTotal: number;
  cycleStart: string;
  cycleEnd: string;
}

export interface AdminAuditEntry {
  id: string;
  actor: string | null;
  actorRole: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  reason: string | null;
  diff: unknown;
  requestId: string | null;
  createdAt: string;
}

/** W4: safe snapshot fields from favorites.settings (null → client shows 未填写). */
export interface FavoriteSettingsFields {
  brandName: string | null;
  productName: string | null;
  copyType: string | null;
  platform: string | null;
  /** Favorite-only publish platform snapshot; null if unset */
  publishPlatform: string | null;
}

export type AdminReviewStatus = 'adopted' | 'changes_requested';

export interface AdminReviewAnnotation {
  id: string;
  startOffset: number;
  endOffset: number;
  quotedText: string;
  note: string;
}

export interface AdminFavoriteActorScope {
  actorId: string;
  actorRole: 'admin' | 'super_admin';
}

export interface AdminFavoriteMeta extends FavoriteSettingsFields {
  id: string;
  ownerDisplayName: string;
  userEmail: string;
  variantKey: string;
  rating: number | null;
  notes: string | null;
  favoriteReason: string | null;
  reasonTags: string[];
  savedAt: string;
  /** Admin review summary — never includes reviewer email/group */
  reviewStatus: AdminReviewStatus | null;
  reviewNote: string | null;
  reviewUpdatedAt: string | null;
  reviewAnnotations: AdminReviewAnnotation[];
  contentRevision: number;
  contentEditedAt: string | null;
  isUserAuthored: boolean;
  reviewRequested: boolean;
  reviewRequestedAt: string | null;
  isPendingReview: boolean;
}

export interface AdminPendingReviewSummary {
  count: number;
  latestRequestedAt: string | null;
}

/** Max length for admin favorites metadata search query. */
export const ADMIN_FAVORITE_SEARCH_MAX_LEN = 80;

/**
 * Normalize admin favorites `q`: trim, cap length, strip PostgREST filter metacharacters.
 * Returns null when empty after normalization.
 */
export function normalizeAdminFavoriteQuery(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let q = raw.trim().slice(0, ADMIN_FAVORITE_SEARCH_MAX_LEN);
  if (!q) return null;
  // Commas/parens/periods break PostgREST `or=(...)` grammar; never pass raw q into SQL.
  q = q.replace(/[,.()\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return q || null;
}

/** Escape LIKE/ILIKE wildcards so user input cannot broaden the pattern. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Build a PostgREST `or` filter for favorite metadata only (never content).
 * Explicit field list only — no select('*') and no body column.
 */
export function buildAdminFavoriteSearchOrFilter(q: string): string {
  const pattern = `%${escapeIlikePattern(q)}%`;
  // PostgREST accepts JSON paths directly in `or()` filters.
  const jsonIlike = (path: string) => `settings->>${path}.ilike.${pattern}`;
  const parts = [
    `notes.ilike.${pattern}`,
    `favorite_reason.ilike.${pattern}`,
    `variant_key.ilike.${pattern}`,
    jsonIlike('brandName'),
    jsonIlike('productName'),
    jsonIlike('copyType'),
    jsonIlike('platform'),
    jsonIlike('publishPlatform'),
  ];
  // reason_tags is varchar[]; map known Chinese labels → key; never filter content
  const tagKey = reverseReasonTagLabel(q);
  if (tagKey) {
    parts.push(`reason_tags.cs.{${tagKey}}`);
  } else if (/^[a-zA-Z_]{2,20}$/.test(q)) {
    parts.push(`reason_tags.cs.{${q}}`);
  }
  return parts.join(',');
}

const REASON_TAG_LABEL_TO_KEY: Record<string, string> = {
  开场吸睛: 'hook',
  语气贴地: 'tone',
  行动引导有力: 'cta',
  句式节奏好: 'rhythm',
  表情自然: 'emoji',
  品牌调性匹配: 'brand',
  创意突出: 'creative',
  适合目标受众: 'audience',
};

function reverseReasonTagLabel(q: string): string | null {
  return REASON_TAG_LABEL_TO_KEY[q] ?? null;
}

export interface AdminFavoriteDetail extends AdminFavoriteMeta {
  content: string;
}

export interface AdminFavoriteReviewResult {
  favoriteId: string;
  reviewStatus: AdminReviewStatus | null;
  reviewNote: string | null;
  reviewUpdatedAt: string | null;
  reviewAnnotations: AdminReviewAnnotation[];
}

/** Thrown with HTTP-ish status for route mapping (400/403/404). */
export class AdminFavoriteReviewError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AdminFavoriteReviewError';
    this.status = status;
    this.code = code;
  }
}

/** W4: super_admin-only case library review payload (no email/secrets). */
export interface AdminCaseLibraryDetail {
  id: string;
  ownerDisplayName: string;
  caseType: string;
  title: string | null;
  body: string;
  reason: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Safely extract review context from a favorites.settings JSON snapshot.
 * Never guesses missing values — returns null so the UI can show「未填写」.
 */
export function extractFavoriteSettingsFields(settings: unknown): FavoriteSettingsFields {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { brandName: null, productName: null, copyType: null, platform: null, publishPlatform: null };
  }
  const s = settings as Record<string, unknown>;
  const pick = (key: string): string | null => {
    const v = s[key];
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };
  return {
    brandName: pick('brandName'),
    productName: pick('productName'),
    copyType: pick('copyType'),
    platform: pick('platform'),
    publishPlatform: pick('publishPlatform'),
  };
}

// ── Internal row shapes (match actual DB columns from migrations) ─

interface ProfileRow {
  id: string;
  display_name: string | null;
  status: string;
  deletion_requested_at: string | null;
  purge_after: string | null;
  created_at: string;
  updated_at: string;
}

interface UserRoleRow {
  user_id: string;
  role: string;
}

interface GenerationJobMetaRow {
  id: string;
  owner_id: string;
  status: string;
  platform: string;
  tone: string;
  generation_engine: string | null;
  created_at: string;
  completed_at: string | null;
}

interface FeedbackMetaRow {
  id: string;
  owner_id: string;
  type: string;
  title: string;
  notify_status: string;
  created_at: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  quota_used: number;
  current_period_start: string;
  current_period_end: string;
}

interface PlanRow {
  id: string;
  name: string;
  quota_per_cycle: number;
}

interface AuditRow {
  id: string;
  actor: string | null;
  actor_role: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  reason: string | null;
  diff: unknown;
  request_id: string | null;
  created_at: string;
}

interface FavoriteMetaRow {
  id: string;
  owner_id: string;
  variant_key: string;
  rating: number | null;
  notes: string | null;
  favorite_reason: string | null;
  reason_tags: string[] | null;
  saved_at: string;
  settings: unknown;
  content_revision: number;
  content_edited_at: string | null;
  is_user_authored: boolean;
  review_requested: boolean;
  review_requested_at: string | null;
}

interface FavoriteDetailRow extends FavoriteMetaRow {
  content: string;
}

interface CaseLibraryDetailRow {
  id: string;
  owner_id: string;
  case_type: string;
  title: string | null;
  body: string;
  reason: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

async function buildUserEmailMap(userIds: string[]): Promise<Map<string, string>> {
  const db = getTrustedSupabase();
  const entries = await Promise.all(userIds.map(async (userId) => {
    const { data, error } = await db.auth.admin.getUserById(userId);
    if (error) throw new Error('Database query failed');
    return [userId, data.user?.email ?? '—'] as const;
  }));
  return new Map(entries);
}

interface GenerationJobFullRow {
  id: string;
  owner_id: string;
  idempotency_key: string;
  status: string;
  source: string;
  platform: string;
  tone: string;
  cantonese_level: number;
  english_mixing_level: number;
  creativity_level: number;
  input_language: string;
  brand_name: string | null;
  product_name: string | null;
  brand_red_lines: string | null;
  brief: unknown;
  variants: unknown;
  variant_meta: unknown;
  diagnosis: unknown;
  audit: unknown;
  scores: unknown;
  consumer_feedback: unknown;
  generation_engine: string | null;
  error_message: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

// ── Query Limits ───────────────────────────────────────────────

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

function clampLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(n), MAX_PAGE_SIZE);
}

function clampOffset(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

// ── Helpers ────────────────────────────────────────────────────

/** Obfuscated user ID prefix for de-identified display (8 hex chars). */
function userIdPrefix(id: string): string {
  return id.replace(/-/g, '').slice(0, 8);
}

/** Fetch display names for a batch of user IDs. */
async function buildDisplayNameMap(
  userIds: string[],
): Promise<Map<string, string>> {
  const db = getTrustedSupabase();
  const unique = [...new Set(userIds)];
  const map = new Map<string, string>();

  // Batch in groups of 100 to stay within URL limits
  for (let i = 0; i < unique.length; i += 100) {
    const batch = unique.slice(i, i + 100);
    const { data, error } = await db
      .from('profiles')
      .select('id,display_name')
      .in('id', batch);

    if (error) throw error;

    for (const row of (data ?? []) as { id: string; display_name: string | null }[]) {
      map.set(row.id, row.display_name ?? `用户 ${userIdPrefix(row.id)}`);
    }
  }

  // Fill in any missing with de-identified prefix
  for (const id of unique) {
    if (!map.has(id)) {
      map.set(id, `用户 ${userIdPrefix(id)}`);
    }
  }

  return map;
}

/** Fetch plan name map. */
async function buildPlanNameMap(): Promise<Map<string, string>> {
  const db = getTrustedSupabase();
  const { data, error } = await db
    .from('plans')
    .select('id,name');
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of (data ?? []) as { id: string; name: string }[]) {
    map.set(row.id, row.name);
  }
  return map;
}

// ── Service Functions ──────────────────────────────────────────

/**
 * Check whether a generation job exists (by id, non-deleted).
 * Does NOT read body content — only the `id` column.
 * Used before writing an audit log entry so we never read
 * sensitive body text without a prior audit record.
 */
export async function adminGenerationExists(jobId: string): Promise<boolean> {
  const db = getTrustedSupabase();
  const { data, error } = await db
    .from('generation_jobs')
    .select('id')
    .eq('id', jobId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(`Database query failed`);
  return data !== null;
}

export async function getAdminStats(): Promise<AdminStats> {
  const db = getTrustedSupabase();

  const [profiles, subs, jobs, fb, admins] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    db.from('generation_jobs').select('id', { count: 'exact', head: true }).is('deleted_at', null),
    db.from('user_feedback').select('id', { count: 'exact', head: true }),
    db.from('user_roles').select('user_id', { count: 'exact', head: true }).in('role', ['admin', 'super_admin']),
  ]);

  // Throw on any query error — never silently return zero
  for (const result of [profiles, subs, jobs, fb, admins]) {
    if (result.error) throw new Error(`Database query failed`);
  }

  return {
    totalUsers: profiles.count ?? 0,
    activeSubscriptions: subs.count ?? 0,
    totalGenerations: jobs.count ?? 0,
    totalFeedback: fb.count ?? 0,
    adminUsers: admins.count ?? 0,
  };
}

export async function getAdminUsersOverview(
  limit: unknown,
  offset: unknown,
): Promise<{ users: AdminUserOverview[]; total: number }> {
  const db = getTrustedSupabase();
  const l = clampLimit(limit);
  const o = clampOffset(offset);

  const { count, error: countError } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  if (countError) throw new Error(`Database query failed`);

  const { data, error } = await db
    .from('profiles')
    .select('id,display_name,status,deletion_requested_at,purge_after,created_at,updated_at')
    .order('created_at', { ascending: false })
    .range(o, o + l - 1);

  if (error) throw new Error(`Database query failed`);

  const profiles = (data ?? []) as unknown as ProfileRow[];

  if (profiles.length === 0) {
    return { users: [], total: count ?? 0 };
  }

  const userIds = profiles.map((p) => p.id);

  // Get roles
  const { data: roleData, error: roleError } = await db
    .from('user_roles')
    .select('user_id,role')
    .in('user_id', userIds);

  if (roleError) throw new Error(`Database query failed`);

  const roles = (roleData ?? []) as unknown as UserRoleRow[];

  const roleMap = new Map<string, string[]>();
  for (const r of roles) {
    const existing = roleMap.get(r.user_id) ?? [];
    existing.push(r.role);
    roleMap.set(r.user_id, existing);
  }

  // Get subscription plan names
  const { data: subData, error: subError } = await db
    .from('subscriptions')
    .select('user_id,plan_id')
    .in('user_id', userIds)
    .eq('status', 'active');

  if (subError) throw new Error(`Database query failed`);

  const subs = (subData ?? []) as unknown as { user_id: string; plan_id: string }[];

  const planNameMap = await buildPlanNameMap();
  const subMap = new Map<string, string>();
  for (const s of subs) {
    subMap.set(s.user_id, planNameMap.get(s.plan_id) ?? 'unknown');
  }

  // Get generation counts via direct query (no non-existent RPC)
  const { data: gcData, error: gcError } = await db
    .from('generation_jobs')
    .select('owner_id')
    .in('owner_id', userIds)
    .is('deleted_at', null);

  if (gcError) throw new Error(`Database query failed`);

  const jobCountMap = new Map<string, number>();
  for (const row of (gcData ?? []) as { owner_id: string }[]) {
    jobCountMap.set(row.owner_id, (jobCountMap.get(row.owner_id) ?? 0) + 1);
  }

  const users: AdminUserOverview[] = profiles.map((p) => ({
    id: p.id,
    displayName: p.display_name ?? `用户 ${userIdPrefix(p.id)}`,
    userIdPrefix: userIdPrefix(p.id),
    roles: roleMap.get(p.id) ?? ['user'],
    status: p.status,
    createdAt: p.created_at ?? '',
    deletionRequestedAt: p.deletion_requested_at ?? null,
    subscriptionPlan: subMap.get(p.id) ?? null,
    generationCount: jobCountMap.get(p.id) ?? 0,
  }));

  return { users, total: count ?? 0 };
}

export async function getAdminGenerationMeta(
  limit: unknown,
  offset: unknown,
): Promise<{ jobs: AdminGenerationMeta[]; total: number }> {
  const db = getTrustedSupabase();
  const l = clampLimit(limit);
  const o = clampOffset(offset);

  const { count, error: countError } = await db
    .from('generation_jobs')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null);

  if (countError) throw new Error(`Database query failed`);

  const { data, error } = await db
    .from('generation_jobs')
    .select('id,owner_id,status,platform,tone,generation_engine,created_at,completed_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(o, o + l - 1);

  if (error) throw new Error(`Database query failed`);

  const jobs = (data ?? []) as unknown as GenerationJobMetaRow[];

  if (jobs.length === 0) {
    return { jobs: [], total: count ?? 0 };
  }

  // Get owner display names (no email access — use display_name or de-identified ID)
  const ownerIds = [...new Set(jobs.map((j) => j.owner_id))];
  const displayNameMap = await buildDisplayNameMap(ownerIds);

  const result: AdminGenerationMeta[] = jobs.map((j) => ({
    id: j.id,
    ownerId: j.owner_id,
    ownerDisplayName: displayNameMap.get(j.owner_id) ?? `用户 ${userIdPrefix(j.owner_id)}`,
    status: j.status,
    platform: j.platform,
    tone: j.tone,
    generationEngine: j.generation_engine ?? null,
    createdAt: j.created_at,
    completedAt: j.completed_at ?? null,
  }));

  return { jobs: result, total: count ?? 0 };
}

/**
 * Get a single generation job's FULL details.
 *
 * SECURITY:
 * - Explicit field allowlist (no select('*')).
 * - Audit log write is BEFORE response and is MANDATORY (fail closed).
 * - If audit write fails, the detail request is rejected.
 * - Never exposes source/variants/diagnosis/audit/consumer_feedback content
 *   in default list views — only in this explicit detail endpoint.
 */
export async function getAdminGenerationDetail(
  jobId: string,
): Promise<Record<string, unknown> | null> {
  const db = getTrustedSupabase();

  // Confirm resource exists first
  const { data: exists, error: existsError } = await db
    .from('generation_jobs')
    .select('id')
    .eq('id', jobId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existsError) throw new Error(`Database query failed`);
  if (!exists) return null;

  // Explicit field allowlist — no select('*')
  const { data, error } = await db
    .from('generation_jobs')
    .select(`
      id, owner_id, idempotency_key, status,
      source, platform, tone,
      cantonese_level, english_mixing_level, creativity_level, input_language,
      brand_name, product_name, brand_red_lines,
      brief, variants, variant_meta, diagnosis, audit, scores,
      consumer_feedback, generation_engine,
      error_message, error_code,
      created_at, updated_at, completed_at, deleted_at
    `)
    .eq('id', jobId)
    .is('deleted_at', null)
    .single();

  if (error || !data) return null;

  return data as unknown as Record<string, unknown>;
}

/**
 * Resolve owner_id allowlist for an admin actor.
 * - super_admin: null (no filter, all owners)
 * - ordinary admin with non-null review_group: owners in same group
 * - ordinary admin with null review_group: empty set (no visibility)
 *
 * Service-role BFF must re-check group scope explicitly (does not rely on RLS).
 */
export async function resolveAdminFavoriteOwnerScope(
  scope: AdminFavoriteActorScope,
): Promise<{ mode: 'all' } | { mode: 'none' } | { mode: 'owners'; ownerIds: string[] }> {
  if (scope.actorRole === 'super_admin') {
    return { mode: 'all' };
  }

  const db = getTrustedSupabase();
  const { data: actorProfile, error: actorErr } = await db
    .from('profiles')
    .select('review_group')
    .eq('id', scope.actorId)
    .maybeSingle();
  if (actorErr) throw new Error('Database query failed');

  const actorGroup =
    actorProfile && typeof (actorProfile as { review_group?: unknown }).review_group === 'string'
      ? ((actorProfile as { review_group: string }).review_group)
      : null;

  if (!actorGroup) {
    return { mode: 'none' };
  }

  const { data: peers, error: peersErr } = await db
    .from('profiles')
    .select('id')
    .eq('review_group', actorGroup);
  if (peersErr) throw new Error('Database query failed');

  const ownerIds = ((peers ?? []) as { id: string }[]).map((p) => p.id);
  if (ownerIds.length === 0) return { mode: 'none' };
  return { mode: 'owners', ownerIds };
}

async function loadFavoriteReviewMap(
  favoriteIds: string[],
): Promise<Map<string, { reviewStatus: AdminReviewStatus; reviewNote: string | null; reviewUpdatedAt: string; reviewAnnotations: AdminReviewAnnotation[] }>> {
  const map = new Map<string, { reviewStatus: AdminReviewStatus; reviewNote: string | null; reviewUpdatedAt: string; reviewAnnotations: AdminReviewAnnotation[] }>();
  if (favoriteIds.length === 0) return map;

  const db = getTrustedSupabase();
  for (let i = 0; i < favoriteIds.length; i += 100) {
    const batch = favoriteIds.slice(i, i + 100);
    const { data, error } = await db
      .from('favorite_admin_reviews')
      .select('favorite_id,review_status,note,annotations,updated_at')
      .in('favorite_id', batch);
    if (error) throw new Error('Database query failed');
    for (const row of (data ?? []) as {
      favorite_id: string;
      review_status: string;
      note: string | null;
      annotations: unknown;
      updated_at: string;
    }[]) {
      if (row.review_status !== 'adopted' && row.review_status !== 'changes_requested') continue;
      map.set(row.favorite_id, {
        reviewStatus: row.review_status,
        reviewNote: row.note ?? null,
        reviewUpdatedAt: row.updated_at,
        reviewAnnotations: Array.isArray(row.annotations)
          ? row.annotations as AdminReviewAnnotation[]
          : [],
      });
    }
  }
  return map;
}

export async function getAdminFavoritesOverview(
  limit: unknown,
  offset: unknown,
  searchQuery?: unknown,
  actorScope?: AdminFavoriteActorScope,
  pendingOnly = false,
): Promise<{ favorites: AdminFavoriteMeta[]; total: number }> {
  const db = getTrustedSupabase();
  const l = clampLimit(limit);
  const o = clampOffset(offset);
  const q = normalizeAdminFavoriteQuery(searchQuery);

  // Explicit actor scope required for group isolation (service_role bypasses RLS).
  const scope = actorScope
    ? await resolveAdminFavoriteOwnerScope(actorScope)
    : { mode: 'all' as const };

  if (scope.mode === 'none') {
    return { favorites: [], total: 0 };
  }

  // Deliberately exclude content from the list. Full copy text is available
  // only through the audited detail endpoint below. settings is read only for
  // safe brand/product/copyType/platform/publishPlatform snapshot fields.
  // Explicit column list — never select('*') or content.
  const baseListSelect =
    'id,owner_id,variant_key,rating,notes,favorite_reason,reason_tags,saved_at,settings,content_revision,content_edited_at,is_user_authored,review_requested,review_requested_at';
  const listSelect = pendingOnly
    ? `${baseListSelect},favorite_admin_reviews!left(favorite_id)`
    : baseListSelect;

  let countQuery = db.from('favorites').select(
    pendingOnly ? 'id,favorite_admin_reviews!left(favorite_id)' : 'id',
    { count: 'exact', head: true },
  );
  let dataQuery = db
    .from('favorites')
    .select(listSelect)
    .order('saved_at', { ascending: false })
    .range(o, o + l - 1);

  if (scope.mode === 'owners') {
    countQuery = countQuery.in('owner_id', scope.ownerIds);
    dataQuery = dataQuery.in('owner_id', scope.ownerIds);
  }

  if (q) {
    const orFilter = buildAdminFavoriteSearchOrFilter(q);
    countQuery = countQuery.or(orFilter);
    dataQuery = dataQuery.or(orFilter);
  }

  if (pendingOnly) {
    countQuery = countQuery.eq('review_requested', true).is('favorite_admin_reviews', null);
    dataQuery = dataQuery.eq('review_requested', true).is('favorite_admin_reviews', null);
  }

  const { count, error: countError } = await countQuery;
  if (countError) throw new Error('Database query failed');

  const { data, error } = await dataQuery;
  if (error) throw new Error('Database query failed');

  const rows = (data ?? []) as unknown as FavoriteMetaRow[];
  if (rows.length === 0) return { favorites: [], total: count ?? 0 };

  const ownerIds = [...new Set(rows.map((row) => row.owner_id))];
  const reviewMap = await loadFavoriteReviewMap(rows.map((r) => r.id));
  const [displayNameMap, emailMap] = await Promise.all([
    buildDisplayNameMap(ownerIds),
    buildUserEmailMap(ownerIds),
  ]);

  return {
    favorites: rows.map((row) => {
      const snap = extractFavoriteSettingsFields(row.settings);
      const review = reviewMap.get(row.id);
      return {
        id: row.id,
        ownerDisplayName: displayNameMap.get(row.owner_id) ?? `用户 ${userIdPrefix(row.owner_id)}`,
        userEmail: emailMap.get(row.owner_id) ?? '—',
        variantKey: row.variant_key,
        rating: row.rating ?? null,
        notes: row.notes ?? null,
        favoriteReason: row.favorite_reason ?? null,
        reasonTags: row.reason_tags ?? [],
        savedAt: row.saved_at,
        brandName: snap.brandName,
        productName: snap.productName,
        copyType: snap.copyType,
        platform: snap.platform,
        publishPlatform: snap.publishPlatform,
        reviewStatus: review?.reviewStatus ?? null,
        reviewNote: review?.reviewNote ?? null,
        reviewUpdatedAt: review?.reviewUpdatedAt ?? null,
        reviewAnnotations: review?.reviewAnnotations ?? [],
        contentRevision: row.content_revision ?? 1,
        contentEditedAt: row.content_edited_at ?? null,
        isUserAuthored: row.is_user_authored === true,
        reviewRequested: row.review_requested === true,
        reviewRequestedAt: row.review_requested_at ?? null,
        isPendingReview: row.review_requested === true && !review,
      };
    }),
    total: count ?? 0,
  };
}

/** Same-group queue signal only. It never selects favorite content or user identity. */
export async function getAdminPendingReviewSummary(
  actorScope: AdminFavoriteActorScope,
): Promise<AdminPendingReviewSummary> {
  const db = getTrustedSupabase();
  const scope = await resolveAdminFavoriteOwnerScope(actorScope);
  if (scope.mode === 'none') return { count: 0, latestRequestedAt: null };

  let query = db
    .from('favorites')
    .select('review_requested_at,favorite_admin_reviews!left(favorite_id)', { count: 'exact' })
    .eq('review_requested', true)
    .is('favorite_admin_reviews', null)
    .order('review_requested_at', { ascending: false })
    .limit(1);

  if (scope.mode === 'owners') {
    query = query.in('owner_id', scope.ownerIds);
  }

  const { data, count, error } = await query;
  if (error) throw new Error('Database query failed');
  const latest = Array.isArray(data) && data.length > 0
    ? (data[0] as { review_requested_at?: string | null }).review_requested_at ?? null
    : null;
  return { count: count ?? 0, latestRequestedAt: latest };
}

/**
 * Existence + scope check that never reads the favorite body.
 * Cross-group for ordinary admin → false (route returns 404, no audit, no body).
 */
export async function adminFavoriteExists(
  favoriteId: string,
  actorScope?: AdminFavoriteActorScope,
): Promise<boolean> {
  const db = getTrustedSupabase();
  const { data, error } = await db
    .from('favorites')
    .select('id,owner_id')
    .eq('id', favoriteId)
    .maybeSingle();
  if (error) throw new Error('Database query failed');
  if (!data) return false;

  if (!actorScope) return true;

  const scope = await resolveAdminFavoriteOwnerScope(actorScope);
  if (scope.mode === 'all') return true;
  if (scope.mode === 'none') return false;
  const ownerId = (data as { owner_id: string }).owner_id;
  return scope.ownerIds.includes(ownerId);
}

/** Read one favorite after the route has durably written its access audit. */
export async function getAdminFavoriteDetail(
  favoriteId: string,
  actorScope?: AdminFavoriteActorScope,
): Promise<AdminFavoriteDetail | null> {
  // Re-check scope before body read (fail-closed if scope changed).
  if (actorScope) {
    const inScope = await adminFavoriteExists(favoriteId, actorScope);
    if (!inScope) return null;
  }

  const db = getTrustedSupabase();
  const { data, error } = await db
    .from('favorites')
    .select('id,owner_id,variant_key,content,rating,notes,favorite_reason,reason_tags,saved_at,settings,content_revision,content_edited_at,is_user_authored,review_requested,review_requested_at')
    .eq('id', favoriteId)
    .maybeSingle();
  if (error) throw new Error('Database query failed');
  if (!data) return null;

  const row = data as unknown as FavoriteDetailRow;
  const snap = extractFavoriteSettingsFields(row.settings);
  const [displayNameMap, emailMap, reviewMap] = await Promise.all([
    buildDisplayNameMap([row.owner_id]),
    buildUserEmailMap([row.owner_id]),
    loadFavoriteReviewMap([row.id]),
  ]);
  const review = reviewMap.get(row.id);
  return {
    id: row.id,
    ownerDisplayName: displayNameMap.get(row.owner_id) ?? `用户 ${userIdPrefix(row.owner_id)}`,
    userEmail: emailMap.get(row.owner_id) ?? '—',
    variantKey: row.variant_key,
    content: row.content,
    rating: row.rating ?? null,
    notes: row.notes ?? null,
    favoriteReason: row.favorite_reason ?? null,
    reasonTags: row.reason_tags ?? [],
    savedAt: row.saved_at,
    brandName: snap.brandName,
    productName: snap.productName,
    copyType: snap.copyType,
    platform: snap.platform,
    publishPlatform: snap.publishPlatform,
    reviewStatus: review?.reviewStatus ?? null,
    reviewNote: review?.reviewNote ?? null,
    reviewUpdatedAt: review?.reviewUpdatedAt ?? null,
    reviewAnnotations: review?.reviewAnnotations ?? [],
    contentRevision: row.content_revision ?? 1,
    contentEditedAt: row.content_edited_at ?? null,
    isUserAuthored: row.is_user_authored === true,
    reviewRequested: row.review_requested === true,
    reviewRequestedAt: row.review_requested_at ?? null,
    isPendingReview: row.review_requested === true && !review,
  };
}

const REVIEW_NOTE_MAX = 2000;
const REVIEW_ANNOTATION_MAX = 50;
const REVIEW_ANNOTATION_TEXT_MAX = 1000;

/**
 * Normalize review note: trim; empty string → null; enforce max length.
 */
export function normalizeReviewNote(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') {
    throw new AdminFavoriteReviewError(400, 'invalid_note', 'Invalid note');
  }
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.length > REVIEW_NOTE_MAX) {
    throw new AdminFavoriteReviewError(400, 'note_too_long', 'Note too long');
  }
  return trimmed;
}

export function normalizeReviewAnnotations(raw: unknown): AdminReviewAnnotation[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > REVIEW_ANNOTATION_MAX) {
    throw new AdminFavoriteReviewError(400, 'invalid_annotations', 'Invalid annotations');
  }
  const normalized = raw.map((item): AdminReviewAnnotation => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new AdminFavoriteReviewError(400, 'invalid_annotation', 'Invalid annotation');
    }
    const value = item as Record<string, unknown>;
    const id = typeof value.id === 'string' ? value.id.trim() : '';
    const quotedText = typeof value.quotedText === 'string' ? value.quotedText : '';
    const note = typeof value.note === 'string' ? value.note.trim() : '';
    const startOffset = value.startOffset;
    const endOffset = value.endOffset;
    if (!id || id.length > 100 || !Number.isInteger(startOffset) || !Number.isInteger(endOffset)
        || (startOffset as number) < 0 || (endOffset as number) <= (startOffset as number)
        || !quotedText || quotedText.length > REVIEW_ANNOTATION_TEXT_MAX
        || !note || note.length > REVIEW_ANNOTATION_TEXT_MAX) {
      throw new AdminFavoriteReviewError(400, 'invalid_annotation', 'Invalid annotation');
    }
    return { id, startOffset: startOffset as number, endOffset: endOffset as number, quotedText, note };
  });
  normalized.sort((a, b) => a.startOffset - b.startOffset);
  return normalized;
}

/**
 * Atomically upsert/clear favorite review via service-role-only RPC.
 * Does NOT write review + audit from separate JS statements.
 */
export async function updateAdminFavoriteReview(
  scope: AdminFavoriteActorScope,
  favoriteId: string,
  status: AdminReviewStatus | null,
  noteRaw: unknown,
  annotationsRaw: unknown = [],
): Promise<AdminFavoriteReviewResult> {
  if (status !== null && status !== 'adopted' && status !== 'changes_requested') {
    throw new AdminFavoriteReviewError(400, 'invalid_status', 'Invalid status');
  }

  let note: string | null = null;
  const annotations = status === null ? [] : normalizeReviewAnnotations(annotationsRaw);
  if (status !== null) {
    note = normalizeReviewNote(noteRaw);
    if (status === 'changes_requested' && !note) {
      throw new AdminFavoriteReviewError(400, 'note_required', 'Note required for changes_requested');
    }
  }

  const db = getTrustedSupabase();
  const { data, error } = await db.rpc('admin_save_favorite_review', {
    _actor_id: scope.actorId,
    _favorite_id: favoriteId,
    _status: status,
    _note: status === null ? null : note,
    _annotations: annotations,
  });

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    const code = (error as { code?: string }).code ?? '';
    if (code === 'P0002' || msg.includes('not_found') || msg.includes('p0002')) {
      throw new AdminFavoriteReviewError(404, 'not_found', 'Favorite not found');
    }
    if (code === '42501' || msg.includes('forbidden')) {
      throw new AdminFavoriteReviewError(403, 'forbidden', 'Admin access required');
    }
    if (msg.includes('note_required') || msg.includes('invalid_status') || msg.includes('note_too_long') || msg.includes('invalid_args') || msg.includes('annotation') || code === '22023') {
      throw new AdminFavoriteReviewError(400, 'invalid_body', 'Invalid review payload');
    }
    throw new Error('Database query failed');
  }

  const payload = (data ?? {}) as Record<string, unknown>;
  const reviewStatus =
    payload.reviewStatus === 'adopted' || payload.reviewStatus === 'changes_requested'
      ? payload.reviewStatus
      : null;
  return {
    favoriteId: typeof payload.favoriteId === 'string' ? payload.favoriteId : favoriteId,
    reviewStatus,
    reviewNote: typeof payload.reviewNote === 'string' ? payload.reviewNote : null,
    reviewUpdatedAt: typeof payload.reviewUpdatedAt === 'string' ? payload.reviewUpdatedAt : null,
    reviewAnnotations: Array.isArray(payload.annotations)
      ? payload.annotations as AdminReviewAnnotation[]
      : [],
  };
}

/**
 * Existence check for case_library_entries — id only, excludes soft-deleted.
 * Never reads body. Soft-deleted rows are treated as not found (404 upstream).
 */
export async function adminCaseLibraryExists(caseId: string): Promise<boolean> {
  const db = getTrustedSupabase();
  const { data, error } = await db
    .from('case_library_entries')
    .select('id')
    .eq('id', caseId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error('Database query failed');
  return data !== null;
}

/**
 * Read one case library entry after durable audit write.
 * Explicit allowlist only — no select(*), no email/password/token.
 */
export async function getAdminCaseLibraryDetail(
  caseId: string,
): Promise<AdminCaseLibraryDetail | null> {
  const db = getTrustedSupabase();
  const { data, error } = await db
    .from('case_library_entries')
    .select('id,owner_id,case_type,title,body,reason,tags,created_at,updated_at,deleted_at')
    .eq('id', caseId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error('Database query failed');
  if (!data) return null;

  const row = data as unknown as CaseLibraryDetailRow;
  const displayNameMap = await buildDisplayNameMap([row.owner_id]);
  return {
    id: row.id,
    ownerDisplayName: displayNameMap.get(row.owner_id) ?? `用户 ${userIdPrefix(row.owner_id)}`,
    caseType: row.case_type,
    title: row.title ?? null,
    body: row.body,
    reason: row.reason,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAdminFeedbackSummary(
  limit: unknown,
  offset: unknown,
): Promise<{ feedback: AdminFeedbackSummary[]; total: number }> {
  const db = getTrustedSupabase();
  const l = clampLimit(limit);
  const o = clampOffset(offset);

  const { count, error: countError } = await db
    .from('user_feedback')
    .select('id', { count: 'exact', head: true });

  if (countError) throw new Error(`Database query failed`);

  // Default list: NEVER select content — only metadata columns
  const { data, error } = await db
    .from('user_feedback')
    .select('id,owner_id,type,title,notify_status,created_at')
    .order('created_at', { ascending: false })
    .range(o, o + l - 1);

  if (error) throw new Error(`Database query failed`);

  const fb = (data ?? []) as unknown as FeedbackMetaRow[];

  if (fb.length === 0) {
    return { feedback: [], total: count ?? 0 };
  }

  const ownerIds = [...new Set(fb.map((f) => f.owner_id))];
  const displayNameMap = await buildDisplayNameMap(ownerIds);

  const result: AdminFeedbackSummary[] = fb.map((f) => ({
    id: f.id,
    ownerId: f.owner_id,
    ownerDisplayName: displayNameMap.get(f.owner_id) ?? `用户 ${userIdPrefix(f.owner_id)}`,
    type: f.type,
    title: f.title,
    notifyStatus: f.notify_status ?? 'pending',
    createdAt: f.created_at,
  }));

  return { feedback: result, total: count ?? 0 };
}

export async function getAdminSubscriptionsOverview(
  limit: unknown,
  offset: unknown,
): Promise<{ subscriptions: AdminSubscriptionOverview[]; total: number }> {
  const db = getTrustedSupabase();
  const l = clampLimit(limit);
  const o = clampOffset(offset);

  const { count, error: countError } = await db
    .from('subscriptions')
    .select('id', { count: 'exact', head: true });

  if (countError) throw new Error(`Database query failed`);

  const { data, error } = await db
    .from('subscriptions')
    .select('id,user_id,plan_id,status,quota_used,current_period_start,current_period_end')
    .order('created_at', { ascending: false })
    .range(o, o + l - 1);

  if (error) throw new Error(`Database query failed`);

  const subs = (data ?? []) as unknown as SubscriptionRow[];

  if (subs.length === 0) {
    return { subscriptions: [], total: count ?? 0 };
  }

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const [displayNameMap, planNameMap, planQuotaMap] = await Promise.all([
    buildDisplayNameMap(userIds),
    buildPlanNameMap(),
    buildPlanQuotaMap(),
  ]);

  const result: AdminSubscriptionOverview[] = subs.map((s) => {
    const planName = planNameMap.get(s.plan_id) ?? 'unknown';
    return {
      id: s.id,
      userId: s.user_id,
      userDisplayName: displayNameMap.get(s.user_id) ?? `用户 ${userIdPrefix(s.user_id)}`,
      planName,
      status: s.status,
      quotaUsed: s.quota_used ?? 0,
      quotaTotal: planQuotaMap.get(s.plan_id) ?? 0,
      cycleStart: s.current_period_start ?? '',
      cycleEnd: s.current_period_end ?? '',
    };
  });

  return { subscriptions: result, total: count ?? 0 };
}

/** Fetch plan name → quota_per_cycle map. */
async function buildPlanQuotaMap(): Promise<Map<string, number>> {
  const db = getTrustedSupabase();
  const { data, error } = await db
    .from('plans')
    .select('id,quota_per_cycle');
  if (error) throw new Error(`Database query failed`);

  const map = new Map<string, number>();
  for (const row of (data ?? []) as { id: string; quota_per_cycle: number }[]) {
    map.set(row.id, row.quota_per_cycle ?? 0);
  }
  return map;
}

export async function getAdminAuditLog(
  limit: unknown,
  offset: unknown,
): Promise<{ entries: AdminAuditEntry[]; total: number }> {
  const db = getTrustedSupabase();
  const l = clampLimit(limit);
  const o = clampOffset(offset);

  const { count, error: countError } = await db
    .from('audit_log')
    .select('id', { count: 'exact', head: true });

  if (countError) throw new Error(`Database query failed`);

  const { data, error } = await db
    .from('audit_log')
    .select('id,actor,actor_role,action,entity,entity_id,reason,diff,request_id,created_at')
    .order('created_at', { ascending: false })
    .range(o, o + l - 1);

  if (error) throw new Error(`Database query failed`);

  const entries = (data ?? []) as unknown as AuditRow[];

  if (entries.length === 0) {
    return { entries: [], total: count ?? 0 };
  }

  const result: AdminAuditEntry[] = entries.map((e) => ({
    id: e.id,
    actor: e.actor ?? null,
    actorRole: e.actor_role ?? null,
    action: e.action,
    entity: e.entity ?? null,
    entityId: e.entity_id ?? null,
    reason: e.reason ?? null,
    diff: e.diff ?? null,
    requestId: e.request_id ?? null,
    createdAt: e.created_at,
  }));

  return { entries: result, total: count ?? 0 };
}

/** Write an audit log entry (append-only) when admin views body content.
 *
 * Uses the real audit_log columns: actor, actor_role, action, entity,
 * entity_id, reason, diff, request_id.
 *
 * This should be called BEFORE returning the sensitive data (fail-closed).
 */
export async function writeAdminAuditLog(entry: {
  actorId: string;
  actorRole?: string;
  action: string;
  entity: string;
  entityId: string;
  reason?: string;
  diff?: Record<string, unknown>;
  requestId?: string;
}): Promise<void> {
  const db = getTrustedSupabase();
  const { error } = await db.from('audit_log').insert({
    actor: entry.actorId,
    actor_role: entry.actorRole ?? 'admin',
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId,
    reason: entry.reason ?? null,
    diff: entry.diff ?? null,
    request_id: entry.requestId ?? null,
    created_at: new Date().toISOString(),
  });

  // Fail closed: if audit write fails, the caller MUST NOT proceed
  if (error) {
    throw new Error(`Audit log write failed`);
  }
}
