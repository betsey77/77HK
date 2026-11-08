/**
 * E7 client for Bad Case diagnostic metrics.
 * Strict whitelist parse; null rates and unavailable CNY never become fake zeros.
 */
import { apiUrl } from './apiBase';
import { supabase } from './supabase';

export type CostStatus = 'ok' | 'partial' | 'unavailable';

export interface CategoryShareBucket {
  count: number;
  share: number | null;
}

export interface CategoryDistributionDto {
  total: number;
  byCategory: Record<string, CategoryShareBucket>;
}

export interface RecurrenceDto {
  totalFindings: number;
  sampleRecurrenceRate: number | null;
  categoryRecurrenceRate: number | null;
  duplicateSampleCount: number;
}

export interface DispositionRatesDto {
  total: number;
  reviewed: number;
  reviewCoverage: number | null;
  confirmationRate: number | null;
  falsePositiveRate: number | null;
}

export interface CriterionCoverageDto {
  total: number;
  evaluated: number;
  notEvaluated: number;
  evaluatedRate: number | null;
  notEvaluatedRate: number | null;
  failRateAmongEvaluated: number | null;
}

export interface ResolutionLatencyDto {
  sampleSize: number;
  p50Ms: number | null;
  p95Ms: number | null;
  invalidCount: number;
}

export interface TokenCostDto {
  costStatus: CostStatus;
  sumCny: number | null;
  okCount: number;
  unavailableCount: number;
  sampleSize: number;
}

export interface DiagnosticsSummaryDto {
  categoryDistribution: CategoryDistributionDto;
  recurrence: RecurrenceDto;
  dispositionRates: DispositionRatesDto;
  criterionCoverage: CriterionCoverageDto;
  resolutionLatency: ResolutionLatencyDto;
  tokenCost: TokenCostDto | null;
}

export interface BadCaseDiagnosticsResponse {
  from: string;
  to: string;
  summary: DiagnosticsSummaryDto;
}

export interface DiagnosticsQuery {
  from?: string;
  to?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(path: string): never {
  throw new Error(`invalid diagnostics response: ${path}`);
}

function asNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0) invalid(`missing ${path}`);
  return value;
}

function asNonNegInt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    invalid(path);
  }
  return value;
}

function asNullableFiniteNumber(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(path);
  return value;
}

function asNullableNonNegMs(value: unknown, path: string): number | null {
  const n = asNullableFiniteNumber(value, path);
  if (n !== null && n < 0) invalid(path);
  return n;
}

function parseCategoryBucket(raw: unknown, path: string): CategoryShareBucket {
  if (!isRecord(raw)) invalid(path);
  return {
    count: asNonNegInt(raw.count, `${path}.count`),
    share: asNullableFiniteNumber(raw.share, `${path}.share`),
  };
}

function parseCategoryDistribution(raw: unknown): CategoryDistributionDto {
  if (!isRecord(raw)) invalid('summary.categoryDistribution');
  if (!isRecord(raw.byCategory)) invalid('summary.categoryDistribution.byCategory');
  const byCategory: Record<string, CategoryShareBucket> = {};
  for (const [key, value] of Object.entries(raw.byCategory)) {
    byCategory[key] = parseCategoryBucket(value, `summary.categoryDistribution.byCategory.${key}`);
  }
  return {
    total: asNonNegInt(raw.total, 'summary.categoryDistribution.total'),
    byCategory,
  };
}

function parseRecurrence(raw: unknown): RecurrenceDto {
  if (!isRecord(raw)) invalid('summary.recurrence');
  return {
    totalFindings: asNonNegInt(raw.totalFindings, 'summary.recurrence.totalFindings'),
    sampleRecurrenceRate: asNullableFiniteNumber(
      raw.sampleRecurrenceRate,
      'summary.recurrence.sampleRecurrenceRate',
    ),
    categoryRecurrenceRate: asNullableFiniteNumber(
      raw.categoryRecurrenceRate,
      'summary.recurrence.categoryRecurrenceRate',
    ),
    duplicateSampleCount: asNonNegInt(
      raw.duplicateSampleCount,
      'summary.recurrence.duplicateSampleCount',
    ),
  };
}

function parseDispositionRates(raw: unknown): DispositionRatesDto {
  if (!isRecord(raw)) invalid('summary.dispositionRates');
  const total = asNonNegInt(raw.total, 'summary.dispositionRates.total');
  const reviewed = asNonNegInt(raw.reviewed, 'summary.dispositionRates.reviewed');
  if (reviewed > total) invalid('summary.dispositionRates.reviewed');
  return {
    total,
    reviewed,
    reviewCoverage: asNullableFiniteNumber(
      raw.reviewCoverage,
      'summary.dispositionRates.reviewCoverage',
    ),
    confirmationRate: asNullableFiniteNumber(
      raw.confirmationRate,
      'summary.dispositionRates.confirmationRate',
    ),
    falsePositiveRate: asNullableFiniteNumber(
      raw.falsePositiveRate,
      'summary.dispositionRates.falsePositiveRate',
    ),
  };
}

function parseCriterionCoverage(raw: unknown): CriterionCoverageDto {
  if (!isRecord(raw)) invalid('summary.criterionCoverage');
  return {
    total: asNonNegInt(raw.total, 'summary.criterionCoverage.total'),
    evaluated: asNonNegInt(raw.evaluated, 'summary.criterionCoverage.evaluated'),
    notEvaluated: asNonNegInt(raw.notEvaluated, 'summary.criterionCoverage.notEvaluated'),
    evaluatedRate: asNullableFiniteNumber(
      raw.evaluatedRate,
      'summary.criterionCoverage.evaluatedRate',
    ),
    notEvaluatedRate: asNullableFiniteNumber(
      raw.notEvaluatedRate,
      'summary.criterionCoverage.notEvaluatedRate',
    ),
    failRateAmongEvaluated: asNullableFiniteNumber(
      raw.failRateAmongEvaluated,
      'summary.criterionCoverage.failRateAmongEvaluated',
    ),
  };
}

function parseResolutionLatency(raw: unknown): ResolutionLatencyDto {
  if (!isRecord(raw)) invalid('summary.resolutionLatency');
  const sampleSize = asNonNegInt(raw.sampleSize, 'summary.resolutionLatency.sampleSize');
  const p50Ms = asNullableNonNegMs(raw.p50Ms, 'summary.resolutionLatency.p50Ms');
  const p95Ms = asNullableNonNegMs(raw.p95Ms, 'summary.resolutionLatency.p95Ms');
  if (sampleSize === 0 && (p50Ms !== null || p95Ms !== null)) {
    invalid('summary.resolutionLatency.p50Ms');
  }
  return {
    sampleSize,
    p50Ms,
    p95Ms,
    invalidCount: asNonNegInt(raw.invalidCount, 'summary.resolutionLatency.invalidCount'),
  };
}

function parseTokenCost(raw: unknown): TokenCostDto | null {
  if (raw === null) return null;
  if (!isRecord(raw)) invalid('summary.tokenCost');

  const costStatus = raw.costStatus;
  if (costStatus !== 'ok' && costStatus !== 'partial' && costStatus !== 'unavailable') {
    invalid('tokenCost.costStatus');
  }

  const sumCny = asNullableFiniteNumber(raw.sumCny, 'summary.tokenCost.sumCny');
  const okCount = asNonNegInt(raw.okCount, 'summary.tokenCost.okCount');
  const unavailableCount = asNonNegInt(raw.unavailableCount, 'summary.tokenCost.unavailableCount');
  const sampleSize = asNonNegInt(raw.sampleSize, 'summary.tokenCost.sampleSize');

  if (costStatus === 'unavailable') {
    if (sumCny !== null) invalid('tokenCost.sumCny');
  } else if (sumCny === null) {
    invalid('tokenCost.sumCny');
  }

  return {
    costStatus,
    sumCny,
    okCount,
    unavailableCount,
    sampleSize,
  };
}

export function parseDiagnosticsResponse(raw: unknown): BadCaseDiagnosticsResponse {
  if (!isRecord(raw)) invalid('root');
  if (!isRecord(raw.summary)) invalid('summary');

  return {
    from: asNonEmptyString(raw.from, 'from'),
    to: asNonEmptyString(raw.to, 'to'),
    summary: {
      categoryDistribution: parseCategoryDistribution(raw.summary.categoryDistribution),
      recurrence: parseRecurrence(raw.summary.recurrence),
      dispositionRates: parseDispositionRates(raw.summary.dispositionRates),
      criterionCoverage: parseCriterionCoverage(raw.summary.criterionCoverage),
      resolutionLatency: parseResolutionLatency(raw.summary.resolutionLatency),
      tokenCost: parseTokenCost(raw.summary.tokenCost),
    },
  };
}

async function authHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

function mapHttpError(status: number, fallback: string): Error {
  if (status === 401) return new Error('UNAUTHORIZED');
  if (status === 403) return new Error('FORBIDDEN');
  if (status === 404) return new Error('NOT_FOUND');
  if (status === 409) return new Error('CONFLICT');
  if (status === 429) return new Error('RATE_LIMITED');
  if (status === 400) return new Error('BAD_REQUEST');
  return new Error(fallback);
}

function buildQuery(query: DiagnosticsQuery = {}): string {
  const params = new URLSearchParams();
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function getBadCaseDiagnostics(
  query: DiagnosticsQuery = {},
): Promise<BadCaseDiagnosticsResponse> {
  const headers = await authHeaders();
  const response = await fetch(
    apiUrl(`/admin/bad-case-review-packs/diagnostics${buildQuery(query)}`),
    { headers },
  );
  if (!response.ok) {
    throw mapHttpError(response.status, 'Failed to load diagnostics');
  }
  const raw: unknown = await response.json();
  return parseDiagnosticsResponse(raw);
}

/** Map API error codes to user-facing Chinese copy. Never pass through raw server bodies. */
export function userFacingDiagnosticsError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  switch (code) {
    case 'FORBIDDEN':
      return '无超级管理员权限';
    case 'UNAUTHORIZED':
      return '请先登录';
    case 'NOT_FOUND':
      return '资源不存在或不可用';
    case 'CONFLICT':
      return '状态冲突，请刷新后重试';
    case 'RATE_LIMITED':
      return '操作过于频繁，请稍后再试';
    case 'BAD_REQUEST':
      return '输入无效，请检查后重试';
    default:
      return '加载失败，请重试';
  }
}

/** null → 暂无样本；0 → 0%；else percentage with one decimal. */
export function formatDiagnosticsRate(rate: number | null): string {
  if (rate === null) return '暂无样本';
  if (rate === 0) return '0%';
  return `${(rate * 100).toFixed(1)}%`;
}

export type TokenCostDisplay =
  | { kind: 'money'; label: string; sumCny: number; partial: boolean }
  | { kind: 'unavailable'; label: '暂不可估算' };

/**
 * CNY only when costStatus is ok|partial and sumCny is a finite number.
 * null / unavailable → 暂不可估算 (never fake ¥0).
 */
export function formatTokenCostDisplay(tokenCost: TokenCostDto | null): TokenCostDisplay {
  if (
    tokenCost &&
    (tokenCost.costStatus === 'ok' || tokenCost.costStatus === 'partial') &&
    typeof tokenCost.sumCny === 'number' &&
    Number.isFinite(tokenCost.sumCny)
  ) {
    const formatted = Number.isInteger(tokenCost.sumCny)
      ? String(tokenCost.sumCny)
      : tokenCost.sumCny.toFixed(6).replace(/\.?0+$/, '');
    return {
      kind: 'money',
      label: `¥${formatted}`,
      sumCny: tokenCost.sumCny,
      partial: tokenCost.costStatus === 'partial',
    };
  }
  return { kind: 'unavailable', label: '暂不可估算' };
}

export function formatDurationMs(ms: number | null): string {
  if (ms === null) return '暂无样本';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) {
    const hours = ms / 3_600_000;
    return `${hours % 1 === 0 ? hours : hours.toFixed(1)}h`;
  }
  const days = ms / 86_400_000;
  return `${days % 1 === 0 ? days : days.toFixed(1)}d`;
}
