/**
 * 2.1 Slice E7 — Evaluation candidate promotion gates.
 *
 * Pure functions only. No DB, no routes, no owner body in shared candidates.
 * Promotion requires humanApproved && redactionApproved && subjectStillReadable.
 */

import { createHash } from 'node:crypto';

export const EVALUATION_CANDIDATE_SCHEMA_VERSION = 1 as const;

export type EvaluationDisposition =
  | 'confirmed'
  | 'false_positive'
  | 'accepted_risk'
  | 'needs_data'
  | 'resolved';

export type FindingCategory =
  | 'input_contract'
  | 'context_resolution'
  | 'prompt_instruction'
  | 'knowledge_retrieval'
  | 'model_transport'
  | 'model_output_schema'
  | 'content_quality'
  | 'compliance'
  | 'persistence'
  | 'ui_presentation'
  | 'evaluation_gap';

export type SeverityMax = 'low' | 'medium' | 'high' | 'critical';

export type ScoreBucket = 'lt50' | '50_69' | '70_84' | '85_100' | 'unknown';

export type SubjectReadabilityReason =
  | 'ok'
  | 'deleted'
  | 'cross_owner'
  | 'scope_denied'
  | 'job_missing'
  | 'body_unavailable';

export interface RedactionStatus {
  approved: boolean;
  redactionVersion: string;
  strippedFieldCount: number;
  remainingPiiKinds: string[];
}

export interface SubjectReadability {
  stillReadable: boolean;
  reason: SubjectReadabilityReason;
}

export interface HumanApproval {
  approved: boolean;
  actorId: string;
  approvedAt: string;
  reason?: string;
}

export interface ActorScope {
  actorId: string;
  actorRole: 'super_admin' | string;
}

export interface PromotionInput {
  reviewPackId: string;
  generationJobId: string;
  subjectOwnerId: string;
  actorScope: ActorScope;
  humanApproval: HumanApproval;
  redaction: RedactionStatus;
  readability: SubjectReadability;
  triggerKind: string;
  categories: FindingCategory[];
  severityMax: SeverityMax;
  criterionIdsFailed: string[];
  promptTemplateId: string | null;
  promptVersion: string | null;
  modelPolicy: {
    provider: string;
    model: string;
    policyVersion: string | null;
  } | null;
  scoreTotal: number | null;
  findingIds: string[];
  /** ISO timestamp supplied by caller (pure function does not read wall clock). */
  now: string;
}

export type PromotionRejectReason =
  | 'human_not_approved'
  | 'redaction_not_approved'
  | 'redaction_pii_remaining'
  | 'redaction_version_missing'
  | 'subject_not_readable'
  | 'subject_deleted'
  | 'subject_cross_owner'
  | 'subject_scope_denied'
  | 'job_missing'
  | 'body_unavailable'
  | 'actor_not_super_admin'
  | 'forbidden_payload_fields'
  | 'empty_standardized_tags'
  | 'invalid_input';

export interface EvaluationCandidate {
  candidateId: string;
  /** De-identified linkage only — never owner body. Named `origin` to avoid `source` (user text) key. */
  origin: {
    reviewPackId: string;
    generationJobId: string;
  };
  tags: {
    categories: FindingCategory[];
    severityMax: SeverityMax;
    triggerKind: string;
    criterionIdsFailed: string[];
    promptTemplateId: string | null;
    promptVersion: string | null;
    modelProvider: string | null;
    model: string | null;
    modelPolicyVersion: string | null;
    scoreBucket: ScoreBucket;
  };
  evidenceRefs: Array<{ kind: 'finding' | 'criterion' | 'artifact'; id: string }>;
  redaction: { version: string; approved: true };
  promotedAt: string;
  schemaVersion: typeof EVALUATION_CANDIDATE_SCHEMA_VERSION;
}

export type PromotionDecision =
  | { status: 'promoted'; candidate: EvaluationCandidate; reasons: [] }
  | { status: 'rejected'; candidate: null; reasons: PromotionRejectReason[] };

// ---------------------------------------------------------------------------
// Forbidden body / owner fields
// ---------------------------------------------------------------------------

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'inputtext',
  'input_text',
  'source',
  'body',
  'content',
  'text',
  'variants',
  'rawprompt',
  'raw_prompt',
  'rawresponse',
  'raw_response',
  'prompt',
  'response',
  'messages',
  'thinking',
  'chainofthought',
  'chain_of_thought',
  'email',
  'useremail',
  'user_email',
  'jwt',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'owneremail',
  'owner_email',
  'brandredlines',
  'brand_red_lines',
]);

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  'reviewPackId',
  'generationJobId',
  'subjectOwnerId',
  'actorScope',
  'humanApproval',
  'redaction',
  'readability',
  'triggerKind',
  'categories',
  'severityMax',
  'criterionIdsFailed',
  'promptTemplateId',
  'promptVersion',
  'modelPolicy',
  'scoreTotal',
  'findingIds',
  'now',
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/_/g, '');
}

function keyIsForbidden(key: string): boolean {
  const lower = key.toLowerCase();
  if (FORBIDDEN_PAYLOAD_KEYS.has(lower)) return true;
  const compact = normalizeKey(key);
  for (const forbidden of FORBIDDEN_PAYLOAD_KEYS) {
    if (normalizeKey(forbidden) === compact) return true;
  }
  return false;
}

function scanForbiddenKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) scanForbiddenKeys(item, found);
    return found;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (keyIsForbidden(key)) found.push(key);
      scanForbiddenKeys(nested, found);
    }
  }
  return found;
}

export function assertNoOwnerBodyLeak(value: unknown): void {
  const hits = scanForbiddenKeys(value);
  if (hits.length > 0) {
    throw new Error(`Evaluation candidate contains forbidden owner body fields: ${hits[0]}`);
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if ('subjectOwnerId' in (value as object)) {
      throw new Error('Evaluation candidate must not contain subjectOwnerId');
    }
  }
}

function isIsoDate(value: string): boolean {
  if (typeof value !== 'string' || value.length < 10) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

function scoreBucket(scoreTotal: number | null): ScoreBucket {
  if (scoreTotal === null || !Number.isFinite(scoreTotal)) return 'unknown';
  if (scoreTotal < 50) return 'lt50';
  if (scoreTotal < 70) return '50_69';
  if (scoreTotal < 85) return '70_84';
  return '85_100';
}

function deterministicCandidateId(
  reviewPackId: string,
  redactionVersion: string,
): string {
  return createHash('sha256')
    .update(`eval-candidate:v1:${reviewPackId}:${redactionVersion}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
}

function collectRejectReasons(input: PromotionInput): PromotionRejectReason[] {
  const reasons: PromotionRejectReason[] = [];

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['invalid_input'];
  }

  for (const key of Object.keys(input)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      if (keyIsForbidden(key)) {
        if (!reasons.includes('forbidden_payload_fields')) {
          reasons.push('forbidden_payload_fields');
        }
      } else if (!reasons.includes('invalid_input')) {
        reasons.push('invalid_input');
      }
    }
  }

  if (scanForbiddenKeys(input).length > 0) {
    if (!reasons.includes('forbidden_payload_fields')) {
      reasons.push('forbidden_payload_fields');
    }
  }

  if (input.actorScope?.actorRole !== 'super_admin') {
    reasons.push('actor_not_super_admin');
  }

  const human = input.humanApproval;
  if (
    !human ||
    human.approved !== true ||
    typeof human.actorId !== 'string' ||
    !UUID_PATTERN.test(human.actorId) ||
    !isIsoDate(human.approvedAt)
  ) {
    reasons.push('human_not_approved');
  }

  const redaction = input.redaction;
  if (!redaction || redaction.approved !== true) {
    reasons.push('redaction_not_approved');
  } else {
    if (
      typeof redaction.redactionVersion !== 'string' ||
      redaction.redactionVersion.length === 0
    ) {
      reasons.push('redaction_version_missing');
    }
    if (
      !Array.isArray(redaction.remainingPiiKinds) ||
      redaction.remainingPiiKinds.length > 0
    ) {
      if (
        Array.isArray(redaction.remainingPiiKinds) &&
        redaction.remainingPiiKinds.length > 0
      ) {
        reasons.push('redaction_pii_remaining');
      } else if (!Array.isArray(redaction.remainingPiiKinds)) {
        reasons.push('redaction_not_approved');
      }
    }
  }

  const readability = input.readability;
  if (!readability || readability.stillReadable !== true || readability.reason !== 'ok') {
    const reason = readability?.reason;
    if (reason === 'deleted') reasons.push('subject_deleted');
    else if (reason === 'cross_owner') reasons.push('subject_cross_owner');
    else if (reason === 'scope_denied') reasons.push('subject_scope_denied');
    else if (reason === 'job_missing') reasons.push('job_missing');
    else if (reason === 'body_unavailable') reasons.push('body_unavailable');
    else reasons.push('subject_not_readable');
  }

  if (!Array.isArray(input.categories) || input.categories.length === 0) {
    reasons.push('empty_standardized_tags');
  }

  if (
    typeof input.reviewPackId !== 'string' ||
    !UUID_PATTERN.test(input.reviewPackId) ||
    typeof input.generationJobId !== 'string' ||
    !UUID_PATTERN.test(input.generationJobId) ||
    !isIsoDate(input.now)
  ) {
    if (!reasons.includes('invalid_input')) reasons.push('invalid_input');
  }

  return reasons;
}

export function buildEvaluationCandidate(input: PromotionInput): EvaluationCandidate {
  const reasons = collectRejectReasons(input);
  if (reasons.length > 0) {
    throw new Error(`Cannot build evaluation candidate: ${reasons.join(',')}`);
  }

  const evidenceRefs: EvaluationCandidate['evidenceRefs'] = [];
  for (const id of input.findingIds ?? []) {
    if (typeof id === 'string' && id.length > 0) {
      evidenceRefs.push({ kind: 'finding', id });
    }
  }
  for (const id of input.criterionIdsFailed ?? []) {
    if (typeof id === 'string' && id.length > 0) {
      evidenceRefs.push({ kind: 'criterion', id });
    }
  }
  if (input.promptTemplateId) {
    evidenceRefs.push({ kind: 'artifact', id: input.promptTemplateId });
  }

  const candidate: EvaluationCandidate = {
    candidateId: deterministicCandidateId(
      input.reviewPackId,
      input.redaction.redactionVersion,
    ),
    origin: {
      reviewPackId: input.reviewPackId,
      generationJobId: input.generationJobId,
    },
    tags: {
      categories: [...input.categories],
      severityMax: input.severityMax,
      triggerKind: input.triggerKind,
      criterionIdsFailed: [...(input.criterionIdsFailed ?? [])],
      promptTemplateId: input.promptTemplateId,
      promptVersion: input.promptVersion,
      modelProvider: input.modelPolicy?.provider ?? null,
      model: input.modelPolicy?.model ?? null,
      modelPolicyVersion: input.modelPolicy?.policyVersion ?? null,
      scoreBucket: scoreBucket(input.scoreTotal),
    },
    evidenceRefs,
    redaction: {
      version: input.redaction.redactionVersion,
      approved: true,
    },
    promotedAt: input.now,
    schemaVersion: EVALUATION_CANDIDATE_SCHEMA_VERSION,
  };

  assertNoOwnerBodyLeak(candidate);
  // Extra guard: subjectOwnerId must never serialize into shared candidate.
  if (JSON.stringify(candidate).includes(input.subjectOwnerId)) {
    throw new Error('Evaluation candidate must not embed subjectOwnerId');
  }

  return candidate;
}

/**
 * Deterministic promotion gate.
 * Only promotes when humanApproved && redactionApproved && subjectStillReadable
 * and no forbidden owner-body fields are present.
 */
export function evaluatePromotion(input: PromotionInput): PromotionDecision {
  const reasons = collectRejectReasons(input);
  if (reasons.length > 0) {
    return { status: 'rejected', candidate: null, reasons };
  }

  const candidate = buildEvaluationCandidate(input);
  return { status: 'promoted', candidate, reasons: [] };
}
