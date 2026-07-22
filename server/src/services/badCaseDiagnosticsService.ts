/**
 * 2.1 Slice E7 — Bad case diagnostic metrics (pure aggregation).
 *
 * Deterministic rates, recurrence, coverage, resolution latency, and versioned
 * CNY token cost. Denominator 0 → null / unavailable (never fake zero rates or ¥0 bills).
 * No DB, no routes, no balance-delta estimation.
 */

import type { EvaluationDisposition, FindingCategory } from './badCaseEvaluationService.js';

// ---------------------------------------------------------------------------
// Input rows (de-identified; projected by E3 callers)
// ---------------------------------------------------------------------------

export interface DiagnosticPackRow {
  reviewPackId: string;
  generationJobId: string;
  createdAt: string;
  firstAssignedAt: string | null;
  resolvedAt: string | null;
  status: string;
  categories: FindingCategory[];
}

export interface DiagnosticFindingRow {
  findingId: string;
  reviewPackId: string;
  category: FindingCategory;
  disposition: EvaluationDisposition | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface DiagnosticCriterionRow {
  reviewPackId: string;
  criterionId: string;
  result: 'pass' | 'fail' | 'not_evaluated';
}

export interface TokenUsageRow {
  provider: string;
  model: string;
  usageSource: 'provider' | 'unavailable';
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cacheHitTokens: number | null;
  cacheMissTokens: number | null;
  priceVersion: string | null;
}

export interface PriceTableEntry {
  provider: string;
  model: string;
  priceVersion: string;
  currency: 'CNY';
  unit: number;
  inputCacheHitCnyPerMTok: number;
  inputCacheMissCnyPerMTok: number;
  outputCnyPerMTok: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface PriceTable {
  version: string;
  entries: PriceTableEntry[];
}

export type CostUnavailableReason =
  | 'usage_unavailable'
  | 'price_entry_missing'
  | 'price_version_unspecified'
  | 'ambiguous_price_entry'
  | 'invalid_price_table'
  | 'balance_delta_forbidden';

export type AttemptCostResult =
  | {
      status: 'ok';
      cny: number;
      priceVersion: string;
      provider: string;
      model: string;
    }
  | {
      status: 'unavailable';
      reason: CostUnavailableReason;
    };

export interface AggregateTokenCostResult {
  costStatus: 'ok' | 'partial' | 'unavailable';
  sumCny: number | null;
  okCount: number;
  unavailableCount: number;
  sampleSize: number;
}

// ---------------------------------------------------------------------------
// Category registry (plan §4.2)
// ---------------------------------------------------------------------------

export const FINDING_CATEGORIES: readonly FindingCategory[] = [
  'input_contract',
  'context_resolution',
  'prompt_instruction',
  'knowledge_retrieval',
  'model_transport',
  'model_output_schema',
  'content_quality',
  'compliance',
  'persistence',
  'ui_presentation',
  'evaluation_gap',
] as const;

function roundRate(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function nearestRank(sortedAsc: number[], p: number): number {
  const m = sortedAsc.length;
  const idx = Math.max(0, Math.ceil(m * p) - 1);
  return sortedAsc[idx]!;
}

function isNonNegInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

// ---------------------------------------------------------------------------
// 3.1 Category distribution
// ---------------------------------------------------------------------------

export interface CategoryDistribution {
  total: number;
  byCategory: Record<FindingCategory, { count: number; share: number | null }>;
}

export function computeCategoryDistribution(
  findings: DiagnosticFindingRow[],
): CategoryDistribution {
  const total = findings.length;
  const byCategory = {} as CategoryDistribution['byCategory'];

  for (const cat of FINDING_CATEGORIES) {
    const count = findings.filter((f) => f.category === cat).length;
    byCategory[cat] = {
      count,
      share: total === 0 ? null : roundRate(count / total),
    };
  }

  return { total, byCategory };
}

// ---------------------------------------------------------------------------
// 3.2 Same-category recurrence
// ---------------------------------------------------------------------------

export interface SameCategoryRecurrence {
  totalFindings: number;
  /** Findings belonging to categories with n>=2, over total findings. */
  sampleRecurrenceRate: number | null;
  /** Categories with n>=2 over categories with n>=1. */
  categoryRecurrenceRate: number | null;
  /** sum(max(0, n_c - 1)) */
  duplicateSampleCount: number;
}

export function computeSameCategoryRecurrence(
  findings: DiagnosticFindingRow[],
): SameCategoryRecurrence {
  const counts = new Map<FindingCategory, number>();
  for (const f of findings) {
    counts.set(f.category, (counts.get(f.category) ?? 0) + 1);
  }

  let recurrentCategories = 0;
  let categoriesWithAny = 0;
  let recurrentFindings = 0;
  let duplicateSampleCount = 0;

  for (const n of counts.values()) {
    if (n >= 1) categoriesWithAny += 1;
    if (n >= 2) {
      recurrentCategories += 1;
      recurrentFindings += n;
    }
    duplicateSampleCount += Math.max(0, n - 1);
  }

  const N = findings.length;
  return {
    totalFindings: N,
    sampleRecurrenceRate: N === 0 ? null : roundRate(recurrentFindings / N),
    categoryRecurrenceRate:
      categoriesWithAny === 0 ? null : roundRate(recurrentCategories / categoriesWithAny),
    duplicateSampleCount,
  };
}

// ---------------------------------------------------------------------------
// 3.3 Finding disposition rates
// ---------------------------------------------------------------------------

export interface FindingDispositionRates {
  total: number;
  reviewed: number;
  reviewCoverage: number | null;
  confirmationRate: number | null;
  falsePositiveRate: number | null;
}

export function computeFindingDispositionRates(
  findings: DiagnosticFindingRow[],
): FindingDispositionRates {
  const N = findings.length;
  if (N === 0) {
    return {
      total: 0,
      reviewed: 0,
      reviewCoverage: null,
      confirmationRate: null,
      falsePositiveRate: null,
    };
  }

  const reviewedRows = findings.filter((f) => f.disposition !== null);
  const R = reviewedRows.length;
  const C = reviewedRows.filter((f) => f.disposition === 'confirmed').length;
  const FP = reviewedRows.filter((f) => f.disposition === 'false_positive').length;

  return {
    total: N,
    reviewed: R,
    reviewCoverage: roundRate(R / N),
    confirmationRate: R === 0 ? null : roundRate(C / R),
    falsePositiveRate: R === 0 ? null : roundRate(FP / R),
  };
}

// ---------------------------------------------------------------------------
// 3.4 Criterion coverage
// ---------------------------------------------------------------------------

export interface CriterionCoverage {
  total: number;
  evaluated: number;
  notEvaluated: number;
  evaluatedRate: number | null;
  notEvaluatedRate: number | null;
  failRateAmongEvaluated: number | null;
}

export function computeCriterionCoverage(
  criteria: DiagnosticCriterionRow[],
): CriterionCoverage {
  const K = criteria.length;
  if (K === 0) {
    return {
      total: 0,
      evaluated: 0,
      notEvaluated: 0,
      evaluatedRate: null,
      notEvaluatedRate: null,
      failRateAmongEvaluated: null,
    };
  }

  const evaluatedRows = criteria.filter(
    (r) => r.result === 'pass' || r.result === 'fail',
  );
  const notEvaluated = criteria.filter((r) => r.result === 'not_evaluated').length;
  const fails = evaluatedRows.filter((r) => r.result === 'fail').length;
  const E = evaluatedRows.length;

  return {
    total: K,
    evaluated: E,
    notEvaluated,
    evaluatedRate: roundRate(E / K),
    notEvaluatedRate: roundRate(notEvaluated / K),
    failRateAmongEvaluated: E === 0 ? null : roundRate(fails / E),
  };
}

// ---------------------------------------------------------------------------
// 3.5 Resolution latency P50 / P95
// ---------------------------------------------------------------------------

export interface ResolutionLatency {
  sampleSize: number;
  p50Ms: number | null;
  p95Ms: number | null;
  invalidCount: number;
}

export function computeResolutionLatency(packs: DiagnosticPackRow[]): ResolutionLatency {
  const durations: number[] = [];
  let invalidCount = 0;

  for (const pack of packs) {
    if (!pack.resolvedAt || !pack.createdAt) continue;
    const created = Date.parse(pack.createdAt);
    const resolved = Date.parse(pack.resolvedAt);
    if (!Number.isFinite(created) || !Number.isFinite(resolved)) {
      invalidCount += 1;
      continue;
    }
    const ms = resolved - created;
    if (ms < 0) {
      invalidCount += 1;
      continue;
    }
    durations.push(ms);
  }

  if (durations.length === 0) {
    return { sampleSize: 0, p50Ms: null, p95Ms: null, invalidCount };
  }

  durations.sort((a, b) => a - b);
  return {
    sampleSize: durations.length,
    p50Ms: nearestRank(durations, 0.5),
    p95Ms: nearestRank(durations, 0.95),
    invalidCount,
  };
}

// ---------------------------------------------------------------------------
// 4. CNY cost
// ---------------------------------------------------------------------------

function hasBalanceDeltaField(row: TokenUsageRow): boolean {
  const obj = row as TokenUsageRow & Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const compact = key.toLowerCase().replace(/_/g, '');
    if (
      compact === 'balancedeltacny' ||
      compact === 'balancedelta' ||
      compact === 'balancechange' ||
      compact === 'providerbalancedelta'
    ) {
      return true;
    }
  }
  return false;
}

function findPriceEntry(
  row: TokenUsageRow,
  table: PriceTable,
  defaultPriceVersion?: string | null,
):
  | { ok: true; entry: PriceTableEntry }
  | { ok: false; reason: CostUnavailableReason } {
  if (!table || !Array.isArray(table.entries)) {
    return { ok: false, reason: 'invalid_price_table' };
  }

  const priceVersion = row.priceVersion ?? defaultPriceVersion ?? null;
  if (!priceVersion) {
    return { ok: false, reason: 'price_version_unspecified' };
  }

  const matches = table.entries.filter(
    (e) =>
      e.provider === row.provider &&
      e.model === row.model &&
      e.priceVersion === priceVersion,
  );

  if (matches.length === 0) {
    return { ok: false, reason: 'price_entry_missing' };
  }
  if (matches.length > 1) {
    return { ok: false, reason: 'ambiguous_price_entry' };
  }

  const entry = matches[0]!;
  if (
    entry.currency !== 'CNY' ||
    entry.unit !== 1_000_000 ||
    !Number.isFinite(entry.inputCacheHitCnyPerMTok) ||
    !Number.isFinite(entry.inputCacheMissCnyPerMTok) ||
    !Number.isFinite(entry.outputCnyPerMTok) ||
    entry.inputCacheHitCnyPerMTok < 0 ||
    entry.inputCacheMissCnyPerMTok < 0 ||
    entry.outputCnyPerMTok < 0
  ) {
    return { ok: false, reason: 'invalid_price_table' };
  }

  return { ok: true, entry };
}

export function estimateAttemptCostCny(
  row: TokenUsageRow,
  priceTable: PriceTable,
  options?: { defaultPriceVersion?: string | null },
): AttemptCostResult {
  if (hasBalanceDeltaField(row)) {
    return { status: 'unavailable', reason: 'balance_delta_forbidden' };
  }

  if (
    row.usageSource !== 'provider' ||
    !isNonNegInt(row.cacheHitTokens) ||
    !isNonNegInt(row.cacheMissTokens) ||
    !isNonNegInt(row.completionTokens)
  ) {
    return { status: 'unavailable', reason: 'usage_unavailable' };
  }

  // Optional consistency check when promptTokens is present.
  if (
    row.promptTokens !== null &&
    isNonNegInt(row.promptTokens) &&
    row.promptTokens !== row.cacheHitTokens + row.cacheMissTokens
  ) {
    return { status: 'unavailable', reason: 'usage_unavailable' };
  }

  const found = findPriceEntry(row, priceTable, options?.defaultPriceVersion);
  if (!found.ok) {
    return { status: 'unavailable', reason: found.reason };
  }

  const entry = found.entry;
  const unit = entry.unit;
  const cny =
    (row.cacheHitTokens / unit) * entry.inputCacheHitCnyPerMTok +
    (row.cacheMissTokens / unit) * entry.inputCacheMissCnyPerMTok +
    (row.completionTokens / unit) * entry.outputCnyPerMTok;

  const rounded = Math.round(cny * 1_000_000) / 1_000_000;

  return {
    status: 'ok',
    cny: rounded,
    priceVersion: entry.priceVersion,
    provider: row.provider,
    model: row.model,
  };
}

export function aggregateTokenCost(
  attempts: TokenUsageRow[],
  priceTable: PriceTable,
  options?: { defaultPriceVersion?: string | null },
): AggregateTokenCostResult {
  const sampleSize = attempts.length;
  if (sampleSize === 0) {
    return {
      costStatus: 'unavailable',
      sumCny: null,
      okCount: 0,
      unavailableCount: 0,
      sampleSize: 0,
    };
  }

  let sum = 0;
  let okCount = 0;
  let unavailableCount = 0;

  for (const row of attempts) {
    const result = estimateAttemptCostCny(row, priceTable, options);
    if (result.status === 'ok') {
      okCount += 1;
      sum += result.cny;
    } else {
      unavailableCount += 1;
    }
  }

  if (okCount === 0) {
    return {
      costStatus: 'unavailable',
      sumCny: null,
      okCount: 0,
      unavailableCount,
      sampleSize,
    };
  }

  const rounded = Math.round(sum * 1_000_000) / 1_000_000;
  return {
    costStatus: unavailableCount === 0 ? 'ok' : 'partial',
    sumCny: rounded,
    okCount,
    unavailableCount,
    sampleSize,
  };
}

// ---------------------------------------------------------------------------
// Summary helper
// ---------------------------------------------------------------------------

export interface DiagnosticsSummary {
  categoryDistribution: CategoryDistribution;
  recurrence: SameCategoryRecurrence;
  dispositionRates: FindingDispositionRates;
  criterionCoverage: CriterionCoverage;
  resolutionLatency: ResolutionLatency;
  tokenCost: AggregateTokenCostResult | null;
}

export function buildDiagnosticsSummary(input: {
  findings: DiagnosticFindingRow[];
  criteria: DiagnosticCriterionRow[];
  packs: DiagnosticPackRow[];
  tokenAttempts?: TokenUsageRow[];
  priceTable?: PriceTable;
}): DiagnosticsSummary {
  return {
    categoryDistribution: computeCategoryDistribution(input.findings),
    recurrence: computeSameCategoryRecurrence(input.findings),
    dispositionRates: computeFindingDispositionRates(input.findings),
    criterionCoverage: computeCriterionCoverage(input.criteria),
    resolutionLatency: computeResolutionLatency(input.packs),
    tokenCost:
      input.tokenAttempts && input.priceTable
        ? aggregateTokenCost(input.tokenAttempts, input.priceTable)
        : null,
  };
}

