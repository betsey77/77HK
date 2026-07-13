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
