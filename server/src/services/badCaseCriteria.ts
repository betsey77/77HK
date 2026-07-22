/**
 * 2.1 Slice E4 — Versioned bad-case acceptance criteria engine.
 *
 * Pure domain evaluation. Missing or untyped fields → not_evaluated.
 * Never invents failures without readable evidence.
 */

export const BAD_CASE_SCORE_THRESHOLD = 50 as const;
export const CRITERIA_VERSION = '1.0.0' as const;

export const VARIANT_KEYS = [
  'standardHK',
  'lightCantonese',
  'ig',
  'facebook',
  'shorts',
] as const;

export type VariantKey = (typeof VARIANT_KEYS)[number];

export type CriterionResultStatus = 'pass' | 'fail' | 'not_evaluated';

export type EvidenceRef =
  | { type: 'score_path'; path: string; value: number }
  | { type: 'job_field'; path: string; value: string | boolean | null }
  | { type: 'variant_presence'; keys: Record<VariantKey, boolean> }
  | { type: 'audit_risk'; index: number; level: 'red' | 'amber' }
  | { type: 'audit_issue'; index: number; severity: string; tag?: string }
  | {
      type: 'model_attempt';
      operation: string;
      provider: string;
      model: string;
      status: 'error' | 'success';
      errorClass: string | null;
      attempt: number;
      createdAt: string;
    }
  | { type: 'selling_point'; pointId: string; matchedVariant?: VariantKey | null };

export interface CriterionEvaluation {
  criterionId: string;
  version: string;
  status: CriterionResultStatus;
  critical: boolean;
  actual: string | number | boolean | null;
  expected: string | number | boolean | null;
  evidenceRefs: EvidenceRef[];
}

export interface CriteriaSellingPoint {
  id: string;
  sourceText?: string | null;
  cantoneseText?: string | null;
}

export interface CriteriaAuditSnapshot {
  risks?: Array<{ level: 'red' | 'amber'; description?: string }> | null;
  issues?: Array<{ tag?: string; severity?: string; description?: string }> | null;
}

export interface CriteriaScoresSnapshot {
  generated?: {
    total?: unknown;
    cantoneseNaturalness?: unknown;
    brandSafety?: unknown;
    [key: string]: unknown;
  } | null;
  source?: unknown;
}

export interface CriteriaJobSnapshot {
  id: string;
  ownerId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  deletedAt?: string | null;
  brandRedLines?: string | null;
  productSellingPoints?: CriteriaSellingPoint[] | null;
  variants?: Partial<Record<VariantKey, string>> | null;
  audit?: CriteriaAuditSnapshot | null;
  scores?: CriteriaScoresSnapshot | null;
  errorCode?: string | null;
}

function isFiniteScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function readGeneratedTotal(scores: CriteriaScoresSnapshot | null | undefined): number | null {
  const total = scores?.generated?.total;
  return isFiniteScore(total) ? total : null;
}

function evaluateTotalThreshold(job: CriteriaJobSnapshot): CriterionEvaluation {
  const total = readGeneratedTotal(job.scores ?? null);
  if (total === null) {
    return {
      criterionId: 'score.total_threshold',
      version: CRITERIA_VERSION,
      status: 'not_evaluated',
      critical: true,
      actual: null,
      expected: `>= ${BAD_CASE_SCORE_THRESHOLD}`,
      evidenceRefs: [],
    };
  }
  const pass = total >= BAD_CASE_SCORE_THRESHOLD;
  return {
    criterionId: 'score.total_threshold',
    version: CRITERIA_VERSION,
    status: pass ? 'pass' : 'fail',
    critical: true,
    actual: total,
    expected: `>= ${BAD_CASE_SCORE_THRESHOLD}`,
    evidenceRefs: pass
      ? []
      : [{ type: 'score_path', path: 'scores.generated.total', value: total }],
  };
}

function evaluateGenerationSuccess(job: CriteriaJobSnapshot): CriterionEvaluation {
  if (job.status === 'completed') {
    return {
      criterionId: 'runtime.generation_success',
      version: CRITERIA_VERSION,
      status: 'pass',
      critical: true,
      actual: job.status,
      expected: 'completed',
      evidenceRefs: [],
    };
  }
  if (job.status === 'failed') {
    const evidence: EvidenceRef[] = [
      { type: 'job_field', path: 'status', value: 'failed' },
    ];
    if (job.errorCode) {
      evidence.push({ type: 'job_field', path: 'error_code', value: job.errorCode });
    }
    return {
      criterionId: 'runtime.generation_success',
      version: CRITERIA_VERSION,
      status: 'fail',
      critical: true,
      actual: job.status,
      expected: 'completed',
      evidenceRefs: evidence,
    };
  }
  return {
    criterionId: 'runtime.generation_success',
    version: CRITERIA_VERSION,
    status: 'not_evaluated',
    critical: true,
    actual: job.status,
    expected: 'completed',
    evidenceRefs: [],
  };
}

/**
 * Selling-point reflection is not fully machine-scored in MVP.
 * - No configured points → pass (vacuous).
 * - Points present without a deterministic matcher → not_evaluated (never invent fail).
 */
function evaluateSellingPoints(job: CriteriaJobSnapshot): CriterionEvaluation {
  const points = Array.isArray(job.productSellingPoints) ? job.productSellingPoints : [];
  if (points.length === 0) {
    return {
      criterionId: 'content.selling_points_reflected',
      version: CRITERIA_VERSION,
      status: 'pass',
      critical: false,
      actual: 0,
      expected: 'n/a or reflected',
      evidenceRefs: [],
    };
  }
  return {
    criterionId: 'content.selling_points_reflected',
    version: CRITERIA_VERSION,
    status: 'not_evaluated',
    critical: false,
    actual: points.length,
    expected: 'deterministic match unavailable',
    evidenceRefs: [],
  };
}

function evaluateCompliance(job: CriteriaJobSnapshot): CriterionEvaluation {
  if (!job.audit || typeof job.audit !== 'object') {
    return {
      criterionId: 'compliance.redlines_and_risks',
      version: CRITERIA_VERSION,
      status: 'not_evaluated',
      critical: true,
      actual: null,
      expected: 'no red risks',
      evidenceRefs: [],
    };
  }

  const hasRiskData = Array.isArray(job.audit.risks);
  const hasIssueData = Array.isArray(job.audit.issues);
  const risks = hasRiskData ? job.audit.risks! : [];
  const redIndex = risks.findIndex((r) => r && r.level === 'red');
  if (redIndex >= 0) {
    return {
      criterionId: 'compliance.redlines_and_risks',
      version: CRITERIA_VERSION,
      status: 'fail',
      critical: true,
      actual: 'red_risk',
      expected: 'no red risks',
      evidenceRefs: [{ type: 'audit_risk', index: redIndex, level: 'red' }],
    };
  }

  const brandSafety = job.scores?.generated?.brandSafety;
  if (isFiniteScore(brandSafety)) {
    const pass = brandSafety >= BAD_CASE_SCORE_THRESHOLD;
    return {
      criterionId: 'compliance.redlines_and_risks',
      version: CRITERIA_VERSION,
      status: pass ? 'pass' : 'fail',
      critical: true,
      actual: brandSafety,
      expected: `brandSafety >= ${BAD_CASE_SCORE_THRESHOLD}`,
      evidenceRefs: pass
        ? []
        : [{ type: 'score_path', path: 'scores.generated.brandSafety', value: brandSafety }],
    };
  }

  const issues = hasIssueData ? job.audit.issues! : [];
  const highIndex = issues.findIndex(
    (issue) => issue && String(issue.severity ?? '').toLowerCase() === 'high',
  );
  if (highIndex >= 0) {
    const issue = issues[highIndex]!;
    return {
      criterionId: 'compliance.redlines_and_risks',
      version: CRITERIA_VERSION,
      status: 'fail',
      critical: true,
      actual: 'high_issue',
      expected: 'no high severity compliance issues',
      evidenceRefs: [
        {
          type: 'audit_issue',
          index: highIndex,
          severity: String(issue.severity ?? 'high'),
          tag: issue.tag,
        },
      ],
    };
  }

  if (!hasRiskData && !hasIssueData && !isFiniteScore(brandSafety)) {
    return {
      criterionId: 'compliance.redlines_and_risks',
      version: CRITERIA_VERSION,
      status: 'not_evaluated',
      critical: true,
      actual: null,
      expected: 'no red risks',
      evidenceRefs: [],
    };
  }

  // Audit present, no red/high signals and no brandSafety score → pass lightly.
  return {
    criterionId: 'compliance.redlines_and_risks',
    version: CRITERIA_VERSION,
    status: 'pass',
    critical: true,
    actual: 'clean',
    expected: 'no red risks',
    evidenceRefs: [],
  };
}

function evaluateVariantsComplete(job: CriteriaJobSnapshot): CriterionEvaluation {
  // Avoid double-counting failed jobs that never produced output.
  if (job.status === 'failed') {
    return {
      criterionId: 'output.variants_complete',
      version: CRITERIA_VERSION,
      status: 'not_evaluated',
      critical: true,
      actual: null,
      expected: 'five non-empty variant strings',
      evidenceRefs: [],
    };
  }

  if (job.status !== 'completed') {
    return {
      criterionId: 'output.variants_complete',
      version: CRITERIA_VERSION,
      status: 'not_evaluated',
      critical: true,
      actual: null,
      expected: 'five non-empty variant strings',
      evidenceRefs: [],
    };
  }

  const variants = job.variants;
  if (!variants || typeof variants !== 'object') {
    const keys = Object.fromEntries(VARIANT_KEYS.map((k) => [k, false])) as Record<VariantKey, boolean>;
    return {
      criterionId: 'output.variants_complete',
      version: CRITERIA_VERSION,
      status: 'fail',
      critical: true,
      actual: 'missing_variants',
      expected: 'five non-empty variant strings',
      evidenceRefs: [{ type: 'variant_presence', keys }],
    };
  }

  const keys = {} as Record<VariantKey, boolean>;
  let allPresent = true;
  for (const key of VARIANT_KEYS) {
    const value = variants[key];
    const ok = typeof value === 'string' && value.trim().length > 0;
    keys[key] = ok;
    if (!ok) allPresent = false;
  }

  return {
    criterionId: 'output.variants_complete',
    version: CRITERIA_VERSION,
    status: allPresent ? 'pass' : 'fail',
    critical: true,
    actual: allPresent ? 'complete' : 'incomplete',
    expected: 'five non-empty variant strings',
    evidenceRefs: allPresent ? [] : [{ type: 'variant_presence', keys }],
  };
}

/** Evaluate the pinned minimum acceptance set for a generation job snapshot. */
export function evaluateBadCaseCriteria(job: CriteriaJobSnapshot): CriterionEvaluation[] {
  return [
    evaluateTotalThreshold(job),
    evaluateGenerationSuccess(job),
    evaluateSellingPoints(job),
    evaluateCompliance(job),
    evaluateVariantsComplete(job),
  ];
}

export function hasCriticalCriteriaFailure(evaluations: CriterionEvaluation[]): boolean {
  return evaluations.some((e) => e.critical && e.status === 'fail');
}

