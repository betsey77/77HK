import { getTrustedSupabase } from './trustedSupabase.js';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 30;
const PAGE_SIZE = 1000;
const MAX_PAGES = 100;
const OWNER_BATCH_SIZE = 100;

export interface AdminMetricsActor {
  actorId: string;
  actorRole: 'admin' | 'super_admin';
}

export interface AdminMetricsRange {
  from: string;
  to: string;
}

export interface AdminMetricsOverview extends AdminMetricsRange {
  scope: 'group' | 'global';
  reviewGroup: string | null;
  activity: { dau: number; wau: number; mau: number };
  membershipGrants: { total: number; pending: number; applied: number };
  quota: { consumed: number; remaining: number };
}

export interface AdminModelMetricsRow {
  provider: string;
  model: string;
  total: number;
  success: number;
  error: number;
  errorRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  unavailableUsageCount: number;
}

export interface AdminModelMetrics extends AdminMetricsRange {
  rows: AdminModelMetricsRow[];
}

export interface AdminBadCase {
  id: string;
  score: number;
  platform: string;
  tone: string;
  generationEngine: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AdminBadCases extends AdminMetricsRange {
  threshold: number;
  items: AdminBadCase[];
}

export interface AdminBadCaseModelAttempt {
  createdAt: string;
  operation: string;
  provider: string;
  model: string;
  status: 'success' | 'error';
  errorClass: string | null;
  latencyMs: number;
  attempt: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cacheHitTokens: number | null;
  cacheMissTokens: number | null;
  usageSource: 'provider' | 'unavailable';
}

export type AdminBadCaseModelAttempts =
  | { status: 'available'; items: AdminBadCaseModelAttempt[] }
  | { status: 'unavailable'; items: [] };

export class AdminMetricsError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'AdminMetricsError';
    this.status = status;
    this.code = code;
  }
}

interface ActivityRow { user_id: string; activity_date_hk: string }
interface GrantRow { user_id: string; status: 'pending' | 'applied'; created_at: string }
interface LedgerRow { user_id: string; amount: number | string; created_at: string }
interface MetricsSubscriptionRow { user_id: string; plan_id: string; quota_used: number }
interface MetricsPlanRow { id: string; quota_per_cycle: number }
interface ModelLogRow {
  provider: string;
  model: string;
  status: 'success' | 'error';
  latency_ms: number | string;
  prompt_tokens: number | string | null;
  completion_tokens: number | string | null;
  total_tokens: number | string | null;
  cache_hit_tokens: number | string | null;
  cache_miss_tokens: number | string | null;
  usage_source: 'provider' | 'unavailable';
  created_at: string;
}
interface ModelAttemptRow {
  created_at: string;
  operation: string;
  provider: string;
  model: string;
  status: 'success' | 'error';
  error_class: string | null;
  latency_ms: number | string;
  attempt: number | string;
  prompt_tokens: number | string | null;
  completion_tokens: number | string | null;
  total_tokens: number | string | null;
  cache_hit_tokens: number | string | null;
  cache_miss_tokens: number | string | null;
  usage_source: 'provider' | 'unavailable';
}
interface BadCaseRow {
  id: string;
  scores: unknown;
  platform: string;
  tone: string;
  generation_engine: string | null;
  created_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

function dateToEpoch(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function parseDateOnly(value: unknown): string | null {
  if (typeof value !== 'string' || !DATE_ONLY_PATTERN.test(value)) return null;
  const epoch = dateToEpoch(value);
  if (!Number.isFinite(epoch)) return null;
  return new Date(epoch).toISOString().slice(0, 10) === value ? value : null;
}

function addDays(date: string, days: number): string {
  return new Date(dateToEpoch(date) + days * 86_400_000).toISOString().slice(0, 10);
}

function hongKongDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function parseAdminMetricsRange(
  rawFrom: unknown,
  rawTo: unknown,
  now = new Date(),
): AdminMetricsRange {
  const today = hongKongDate(now);
  const to = rawTo === undefined ? today : parseDateOnly(rawTo);
  if (!to) throw new AdminMetricsError(400, 'invalid_metrics_range');

  const from = rawFrom === undefined
    ? addDays(to, -(DEFAULT_RANGE_DAYS - 1))
    : parseDateOnly(rawFrom);
  if (!from) throw new AdminMetricsError(400, 'invalid_metrics_range');

  const inclusiveDays = Math.floor((dateToEpoch(to) - dateToEpoch(from)) / 86_400_000) + 1;
  if (inclusiveDays < 1 || inclusiveDays > MAX_RANGE_DAYS || to > today) {
    throw new AdminMetricsError(400, 'invalid_metrics_range');
  }
  return { from, to };
}

function utcBounds(range: AdminMetricsRange): { start: string; endExclusive: string } {
  return {
    start: new Date(`${range.from}T00:00:00+08:00`).toISOString(),
    endExclusive: new Date(`${addDays(range.to, 1)}T00:00:00+08:00`).toISOString(),
  };
}

async function readPages<T>(
  readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const result = await readPage(from, from + PAGE_SIZE - 1);
    if (result.error) throw new Error('Database query failed');
    const pageRows = result.data ?? [];
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) return rows;
  }
  throw new Error('Metrics query exceeds safe page limit');
}

function ownerBatches(ownerIds: string[] | null): Array<string[] | null> {
  if (ownerIds === null) return [null];
  const batches: string[][] = [];
  for (let index = 0; index < ownerIds.length; index += OWNER_BATCH_SIZE) {
    batches.push(ownerIds.slice(index, index + OWNER_BATCH_SIZE));
  }
  return batches;
}

async function resolveScope(actor: AdminMetricsActor): Promise<{
  scope: 'group' | 'global';
  reviewGroup: string | null;
  ownerIds: string[] | null;
}> {
  if (actor.actorRole === 'super_admin') {
    return { scope: 'global', reviewGroup: null, ownerIds: null };
  }

  const db = getTrustedSupabase();
  const actorResult = await db
    .from('profiles')
    .select('review_group')
    .eq('id', actor.actorId)
    .maybeSingle();
  if (actorResult.error) throw new Error('Database query failed');
  const rawGroup = (actorResult.data as { review_group?: unknown } | null)?.review_group;
  const reviewGroup = typeof rawGroup === 'string' ? rawGroup.trim() : '';
  if (!reviewGroup) throw new AdminMetricsError(403, 'admin_review_group_required');

  const owners = await readPages<{ id: string }>((from, to) => db
    .from('profiles')
    .select('id')
    .eq('review_group', reviewGroup)
    .range(from, to));

  return {
    scope: 'group',
    reviewGroup,
    ownerIds: [...new Set(owners.map((owner) => owner.id))],
  };
}

async function readActivity(ownerIds: string[] | null, to: string): Promise<ActivityRow[]> {
  const db = getTrustedSupabase();
  const rows: ActivityRow[] = [];
  for (const batch of ownerBatches(ownerIds)) {
    rows.push(...await readPages<ActivityRow>((from, pageTo) => {
      let query = db
        .from('app_activity_daily')
        .select('user_id,activity_date_hk')
        .gte('activity_date_hk', addDays(to, -29))
        .lte('activity_date_hk', to);
      if (batch) query = query.in('user_id', batch);
      return query.range(from, pageTo);
    }));
  }
  return rows;
}

async function readGrants(ownerIds: string[] | null, range: AdminMetricsRange): Promise<GrantRow[]> {
  const db = getTrustedSupabase();
  const bounds = utcBounds(range);
  const rows: GrantRow[] = [];
  for (const batch of ownerBatches(ownerIds)) {
    rows.push(...await readPages<GrantRow>((from, to) => {
      let query = db
        .from('membership_grants')
        .select('user_id,status,created_at')
        .gte('created_at', bounds.start)
        .lt('created_at', bounds.endExclusive);
      if (batch) query = query.in('user_id', batch);
      return query.range(from, to);
    }));
  }
  return rows;
}

async function readConsumed(ownerIds: string[] | null, range: AdminMetricsRange): Promise<LedgerRow[]> {
  const db = getTrustedSupabase();
  const bounds = utcBounds(range);
  const rows: LedgerRow[] = [];
  for (const batch of ownerBatches(ownerIds)) {
    rows.push(...await readPages<LedgerRow>((from, to) => {
      let query = db
        .from('usage_ledger')
        .select('user_id,amount,created_at')
        .eq('event_type', 'consume')
        .gte('created_at', bounds.start)
        .lt('created_at', bounds.endExclusive);
      if (batch) query = query.in('user_id', batch);
      return query.range(from, to);
    }));
  }
  return rows;
}

async function readSubscriptions(ownerIds: string[] | null): Promise<MetricsSubscriptionRow[]> {
  const db = getTrustedSupabase();
  const rows: MetricsSubscriptionRow[] = [];
  for (const batch of ownerBatches(ownerIds)) {
    rows.push(...await readPages<MetricsSubscriptionRow>((from, to) => {
      let query = db
        .from('subscriptions')
        .select('user_id,plan_id,quota_used')
        .eq('status', 'active');
      if (batch) query = query.in('user_id', batch);
      return query.range(from, to);
    }));
  }
  return rows;
}

async function readPlans(): Promise<MetricsPlanRow[]> {
  const db = getTrustedSupabase();
  return readPages<MetricsPlanRow>((from, to) => db
    .from('plans')
    .select('id,quota_per_cycle')
    .range(from, to));
}

function safeNonNegativeInteger(value: unknown): number {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(number) || (number as number) < 0) {
    throw new Error('Invalid metrics value');
  }
  return number as number;
}

function sumSafe(values: number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!Number.isSafeInteger(total)) throw new Error('Invalid metrics value');
  return total;
}

export async function getAdminMetricsOverview(
  actor: AdminMetricsActor,
  range: AdminMetricsRange,
): Promise<AdminMetricsOverview> {
  const resolved = await resolveScope(actor);
  if (resolved.ownerIds?.length === 0) {
    return {
      scope: resolved.scope,
      reviewGroup: resolved.reviewGroup,
      ...range,
      activity: { dau: 0, wau: 0, mau: 0 },
      membershipGrants: { total: 0, pending: 0, applied: 0 },
      quota: { consumed: 0, remaining: 0 },
    };
  }

  const [activityRows, grants, consumedRows, subscriptions, plans] = await Promise.all([
    readActivity(resolved.ownerIds, range.to),
    readGrants(resolved.ownerIds, range),
    readConsumed(resolved.ownerIds, range),
    readSubscriptions(resolved.ownerIds),
    readPlans(),
  ]);

  const distinctSince = (from: string) => new Set(
    activityRows
      .filter((row) => row.activity_date_hk >= from && row.activity_date_hk <= range.to)
      .map((row) => row.user_id),
  ).size;
  const pending = grants.filter((grant) => grant.status === 'pending').length;
  const applied = grants.filter((grant) => grant.status === 'applied').length;
  const planQuota = new Map(plans.map((plan) => [plan.id, safeNonNegativeInteger(plan.quota_per_cycle)]));
  const remaining = sumSafe(subscriptions.map((subscription) => {
    const quota = planQuota.get(subscription.plan_id);
    if (quota === undefined) throw new Error('Database query failed');
    return Math.max(0, quota - safeNonNegativeInteger(subscription.quota_used));
  }));

  return {
    scope: resolved.scope,
    reviewGroup: resolved.reviewGroup,
    ...range,
    activity: {
      dau: distinctSince(range.to),
      wau: distinctSince(addDays(range.to, -6)),
      mau: distinctSince(addDays(range.to, -29)),
    },
    membershipGrants: { total: pending + applied, pending, applied },
    quota: {
      consumed: sumSafe(consumedRows.map((row) => safeNonNegativeInteger(row.amount))),
      remaining,
    },
  };
}

function tokenValue(value: number | string | null): number {
  return value === null ? 0 : safeNonNegativeInteger(value);
}

function roundRate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Super-admin-only aggregate. Authorization is enforced by the route. */
export async function getAdminModelMetrics(range: AdminMetricsRange): Promise<AdminModelMetrics> {
  const db = getTrustedSupabase();
  const bounds = utcBounds(range);
  const rows = await readPages<ModelLogRow>((from, to) => db
    .from('model_call_logs')
    .select('provider,model,status,latency_ms,prompt_tokens,completion_tokens,total_tokens,cache_hit_tokens,cache_miss_tokens,usage_source,created_at')
    .gte('created_at', bounds.start)
    .lt('created_at', bounds.endExclusive)
    .range(from, to));

  const grouped = new Map<string, ModelLogRow[]>();
  for (const row of rows) {
    if (typeof row.provider !== 'string' || typeof row.model !== 'string') {
      throw new Error('Invalid metrics value');
    }
    const key = `${row.provider}\u0000${row.model}`;
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  const resultRows = [...grouped.values()].map((group): AdminModelMetricsRow => {
    const latencies = group.map((row) => safeNonNegativeInteger(row.latency_ms)).sort((a, b) => a - b);
    const success = group.filter((row) => row.status === 'success').length;
    const error = group.filter((row) => row.status === 'error').length;
    if (success + error !== group.length) throw new Error('Invalid metrics value');
    const totalLatency = sumSafe(latencies);
    const p95Index = Math.max(0, Math.ceil(latencies.length * 0.95) - 1);

    return {
      provider: group[0].provider,
      model: group[0].model,
      total: group.length,
      success,
      error,
      errorRate: roundRate(error / group.length),
      avgLatencyMs: Math.round(totalLatency / group.length),
      p95LatencyMs: latencies[p95Index],
      promptTokens: sumSafe(group.map((row) => tokenValue(row.prompt_tokens))),
      completionTokens: sumSafe(group.map((row) => tokenValue(row.completion_tokens))),
      totalTokens: sumSafe(group.map((row) => tokenValue(row.total_tokens))),
      cacheHitTokens: sumSafe(group.map((row) => tokenValue(row.cache_hit_tokens))),
      cacheMissTokens: sumSafe(group.map((row) => tokenValue(row.cache_miss_tokens))),
      unavailableUsageCount: group.filter((row) => row.usage_source === 'unavailable').length,
    };
  }).sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model));

  return { ...range, rows: resultRows };
}

function generatedTotal(scores: unknown): number | null {
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) return null;
  const generated = (scores as { generated?: unknown }).generated;
  if (!generated || typeof generated !== 'object' || Array.isArray(generated)) return null;
  const total = (generated as { total?: unknown }).total;
  return typeof total === 'number' && Number.isFinite(total) && total >= 0 && total <= 100 ? total : null;
}

/** Super-admin-only metadata projection. Never returns the raw scores object or content. */
export async function getAdminBadCases(range: AdminMetricsRange): Promise<AdminBadCases> {
  const db = getTrustedSupabase();
  const bounds = utcBounds(range);
  const rows = await readPages<BadCaseRow>((from, to) => db
    .from('generation_jobs')
    .select('id,scores,platform,tone,generation_engine,created_at,completed_at,deleted_at')
    .gte('created_at', bounds.start)
    .lt('created_at', bounds.endExclusive)
    .is('deleted_at', null)
    .range(from, to));

  const items = rows
    .map((row): AdminBadCase | null => {
      const score = generatedTotal(row.scores);
      if (score === null || score >= 50) return null;
      return {
        id: row.id,
        score,
        platform: row.platform,
        tone: row.tone,
        generationEngine: row.generation_engine,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      };
    })
    .filter((item): item is AdminBadCase => item !== null)
    .sort((a, b) => a.score - b.score || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

  return { ...range, threshold: 50, items };
}

/** Super-admin-only per-attempt telemetry; route authorization and audit are mandatory. */
export async function getAdminBadCaseModelAttempts(jobId: string): Promise<AdminBadCaseModelAttempts> {
  try {
    const db = getTrustedSupabase();
    const { data, error } = await db
      .from('model_call_logs')
      .select('created_at,operation,provider,model,status,error_class,latency_ms,attempt,prompt_tokens,completion_tokens,total_tokens,cache_hit_tokens,cache_miss_tokens,usage_source')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) return { status: 'unavailable', items: [] };

    const items = ((data ?? []) as unknown as ModelAttemptRow[]).map((row): AdminBadCaseModelAttempt => {
      if (
        typeof row.created_at !== 'string'
        || typeof row.operation !== 'string'
        || typeof row.provider !== 'string'
        || typeof row.model !== 'string'
        || (row.status !== 'success' && row.status !== 'error')
        || (row.error_class !== null && typeof row.error_class !== 'string')
        || (row.usage_source !== 'provider' && row.usage_source !== 'unavailable')
      ) throw new Error('Invalid metrics value');
      const nullableToken = (value: number | string | null): number | null => (
        value === null ? null : safeNonNegativeInteger(value)
      );
      return {
        createdAt: row.created_at,
        operation: row.operation,
        provider: row.provider,
        model: row.model,
        status: row.status,
        errorClass: row.error_class,
        latencyMs: safeNonNegativeInteger(row.latency_ms),
        attempt: safeNonNegativeInteger(row.attempt),
        promptTokens: nullableToken(row.prompt_tokens),
        completionTokens: nullableToken(row.completion_tokens),
        totalTokens: nullableToken(row.total_tokens),
        cacheHitTokens: nullableToken(row.cache_hit_tokens),
        cacheMissTokens: nullableToken(row.cache_miss_tokens),
        usageSource: row.usage_source,
      };
    });
    return { status: 'available', items };
  } catch {
    // D4 may not be migrated yet; keep the audited generation body available.
    return { status: 'unavailable', items: [] };
  }
}
