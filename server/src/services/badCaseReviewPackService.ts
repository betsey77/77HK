/**
 * 2.1 Slice E3 — Bad Case review pack trusted service.
 *
 * Super-admin BFF: list/detail/writes + post-generation snapshot/pack hook.
 * Fixed column allowlists. DB/provider errors are sanitized outward.
 * Does not trust client actor/owner/role fields.
 */

import {
  getAdminBadCaseModelAttempts,
  type AdminBadCaseModelAttempts,
  type AdminMetricsRange,
} from './adminMetricsService.js';
import {
  assembleReviewPackUpsert,
  type AssembleReviewPackInput,
  type OwnerTeam,
  type TriggerKind,
} from './badCaseReviewPackAssembler.js';
import {
  evaluateBadCaseCriteria,
  CRITERIA_VERSION,
  readGeneratedTotal,
  type CriteriaJobSnapshot,
  type CriterionEvaluation,
} from './badCaseCriteria.js';
import {
  buildBadCaseProposal,
  BadCaseProposalError,
  hashArtifactSnapshotBody,
  type CreateBadCaseProposalInput,
  type BadCaseProposal,
  type BadCaseProposalArtifactType,
} from './badCaseProposalService.js';
import {
  prepareEventInsert,
  prepareFindingsInsert,
  preparePackUpsert,
  prepareSnapshotUpsert,
  rejectUntrustedActorFields,
  type AnalysisStatus,
  type EventInsertDto,
  type FindingInsertDto,
  type PackStatus,
  type PackUpsertDto,
  type SnapshotUpsertDto,
  InMemoryBadCaseReviewPackRepository,
} from './badCaseReviewPackRepository.js';
import {
  buildGenerationArtifactManifest,
  createLegacyUnavailableManifest,
  type ArtifactCaptureInput,
} from './generationArtifactManifest.js';
import {
  DEFAULT_DEEPSEEK_MODEL,
  getModelRuntimePolicy,
} from './modelPolicy.js';
import {
  buildDiagnosticsSummary,
  FINDING_CATEGORIES,
  type DiagnosticsSummary,
  type DiagnosticCriterionRow,
  type DiagnosticFindingRow,
  type DiagnosticPackRow,
} from './badCaseDiagnosticsService.js';
import type { EvaluationDisposition, FindingCategory } from './badCaseEvaluationService.js';
import { getTrustedSupabase } from './trustedSupabase.js';
import {
  analyzeBadCaseWithDeepSeek,
  BAD_CASE_AI_ANALYSIS_VERSION,
} from './deepseekService.js';
import { classifyModelError } from './telemetryService.js';
import type { GeneratePromptVariant, GenerationArtifactManifest, GenerationEngine } from '../types/index.js';

// ── Errors ────────────────────────────────────────────────────

export type BadCaseReviewPackErrorCode =
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL';

export class BadCaseReviewPackError extends Error {
  readonly status: 400 | 404 | 409 | 429 | 500 | 503;
  readonly code: BadCaseReviewPackErrorCode;

  constructor(
    status: BadCaseReviewPackError['status'],
    code: BadCaseReviewPackErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'BadCaseReviewPackError';
    this.status = status;
    this.code = code;
  }
}

// ── Constants ─────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const OWNER_TEAMS: readonly OwnerTeam[] = [
  'content_prompt',
  'knowledge_rules',
  'model_provider',
  'backend_platform',
  'frontend_experience',
  'unassigned',
];

const PACK_STATUSES: readonly PackStatus[] = [
  'open',
  'triaging',
  'in_progress',
  'resolved',
  'wont_fix',
  'duplicate',
];

const DISPOSITIONS = [
  'confirmed',
  'false_positive',
  'accepted_risk',
  'needs_data',
  'resolved',
] as const;

export type FindingDisposition = (typeof DISPOSITIONS)[number];

const TRIGGER_KINDS: readonly TriggerKind[] = [
  'score_below_threshold',
  'generation_failed',
  'criteria_failed',
  'manual',
];

/** open → triaging|in_progress|wont_fix|duplicate; terminal reopen only to open|triaging|in_progress */
const ALLOWED_STATUS_TRANSITIONS: Record<PackStatus, readonly PackStatus[]> = {
  open: ['triaging', 'in_progress', 'wont_fix', 'duplicate'],
  triaging: ['open', 'in_progress', 'resolved', 'wont_fix', 'duplicate'],
  in_progress: ['triaging', 'resolved', 'wont_fix', 'duplicate'],
  resolved: ['open', 'triaging', 'in_progress'],
  wont_fix: ['open', 'triaging'],
  duplicate: ['open', 'triaging'],
};

const SEVERITY_RANK: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

const ANALYZE_WINDOW_MS = 60_000;
const ANALYZE_MAX_PER_PACK = 3;
const HOOK_TIMEOUT_MS = 400;

const PACK_META_SELECT =
  'id,generation_job_id,subject_owner_id,trigger_kind,status,owner_team,assignee_id,criteria_version,analysis_status,summary,created_at,updated_at,resolved_at';

const PACK_SCOPE_SELECT = 'id,generation_job_id,subject_owner_id';

const JOB_BODY_SELECT = `
  id, owner_id, status,
  source, platform, tone,
  cantonese_level, english_mixing_level, creativity_level, input_language,
  brand_name, product_name, brand_red_lines,
  brief, variants, variant_meta, diagnosis, audit, scores,
  consumer_feedback, generation_engine,
  error_message, error_code,
  created_at, updated_at, completed_at, deleted_at
`.replace(/\s+/g, ' ').trim();

const FINDING_SELECT =
  'id,review_pack_id,category,severity,confidence,stage,variant_key,description,evidence_refs,criterion_refs,artifact_refs,suggestion,recommended_owner_team,disposition,reviewer_comment,reviewed_by,reviewed_at,created_at,updated_at';

const EVENT_SELECT =
  'id,review_pack_id,finding_id,event_type,actor_id,actor_role,from_value,to_value,reason,request_id,payload,created_at';

const SNAPSHOT_SELECT =
  'generation_job_id,owner_id,prompt_manifest,rule_manifest,knowledge_manifest,model_policy_manifest,schema_version,content_hash,availability';

// ── Types ─────────────────────────────────────────────────────

export interface SuperAdminActor {
  actorId: string;
  actorRole: 'super_admin';
}

export interface ReviewPackScopeRow {
  id: string;
  generationJobId: string;
  subjectOwnerId: string;
}

export interface SubjectOwnerView {
  ownerId: string;
  displayName: string | null;
  reviewGroup: string | null;
}

export interface ReviewPackListItem {
  id: string;
  generationJobId: string;
  status: PackStatus;
  triggerKind: string;
  ownerTeam: OwnerTeam | string;
  assigneeId: string | null;
  subjectOwner: SubjectOwnerView;
  score: number | null;
  severity: string | null;
  analysisStatus: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  findingCount?: number;
  criticalFailCount?: number;
}

export interface ReviewPackListResult {
  items: ReviewPackListItem[];
  total: number;
}

export interface ListReviewPacksParams {
  status?: string;
  ownerTeam?: string;
  triggerKind?: string;
  limit?: number;
  offset?: number;
}

export interface ReviewPackDiagnosticsResult extends AdminMetricsRange {
  summary: DiagnosticsSummary;
}

export interface TraceEvent {
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

export interface ReviewPackDetail extends ReviewPackListItem {
  sample: {
    source: string;
    brandName?: string | null;
    productName?: string | null;
    brief?: unknown;
    sellingPoints?: unknown;
    brandRedlines?: unknown;
    settingsSnapshot?: unknown;
    variants: Record<string, unknown> | null;
    diagnosis?: unknown;
    audit?: unknown;
    scores?: unknown;
    consumerFeedback?: unknown;
    errorMessage?: string | null;
    errorCode?: string | null;
  };
  trace:
    | { status: 'available'; events: TraceEvent[] }
    | { status: 'unavailable' | 'legacy_unavailable'; events: [] };
  criteria: Array<{
    criterionId: string;
    name: string;
    version: string;
    result: 'pass' | 'fail' | 'not_evaluated';
    actual?: unknown;
    expected?: unknown;
    evidenceRefs?: unknown[];
  }>;
  artifacts: {
    status: 'available' | 'legacy_unavailable' | 'partial';
    contentHashes?: Partial<Record<BadCaseProposalArtifactType, string>>;
    prompt?: unknown;
    rules?: unknown;
    knowledge?: unknown;
    modelPolicy?: unknown;
  };
  findings: Array<{
    id: string;
    category: string;
    severity: string;
    confidence: number | null;
    stage: string | null;
    variantKey: string | null;
    description: string;
    evidenceRefs: unknown[];
    criterionRefs: unknown[];
    artifactRefs: unknown[];
    suggestion: unknown | null;
    recommendedOwnerTeam: string | null;
    disposition: FindingDisposition | null;
    reviewerComment: string | null;
    reviewedBy: string | null;
    reviewedAt: string | null;
  }>;
  auditEvents: Array<{
    id: string;
    eventType: string;
    actorId: string | null;
    before: unknown;
    after: unknown;
    reason: string | null;
    requestId: string | null;
    createdAt: string;
  }>;
}

export interface ReviewPackWritePort {
  upsertSnapshot(dto: SnapshotUpsertDto): Promise<void>;
  upsertPack(dto: PackUpsertDto): Promise<{ id: string; created: boolean }>;
  replaceFindings(reviewPackId: string, findings: FindingInsertDto[]): Promise<void>;
  appendEvent(dto: EventInsertDto): Promise<{ id: string }>;
}

export interface AfterGenerationReviewPackInput {
  jobId: string;
  ownerId: string;
  status: 'completed' | 'failed';
  deletedAt?: string | null;
  variants?: CriteriaJobSnapshot['variants'];
  audit?: CriteriaJobSnapshot['audit'];
  scores?: CriteriaJobSnapshot['scores'];
  brandRedLines?: string | null;
  productSellingPoints?: CriteriaJobSnapshot['productSellingPoints'];
  errorCode?: string | null;
  generationEngine?: string | null;
  artifactManifest: GenerationArtifactManifest;
  modelAttempts?: AssembleReviewPackInput['modelAttempts'];
}

// ── Analyze rate limit (process-local) ────────────────────────

const analyzeHits = new Map<string, number[]>();

/** Test-only reset. */
export function __resetAnalyzeRateLimitForTests(): void {
  analyzeHits.clear();
}

function checkAnalyzeRateLimit(actorId: string, packId: string): void {
  const key = `${actorId}:${packId}`;
  const now = Date.now();
  const windowStart = now - ANALYZE_WINDOW_MS;
  const hits = (analyzeHits.get(key) ?? []).filter((t) => t >= windowStart);
  if (hits.length >= ANALYZE_MAX_PER_PACK) {
    throw new BadCaseReviewPackError(429, 'RATE_LIMITED');
  }
  hits.push(now);
  analyzeHits.set(key, hits);
}

// ── Pure helpers ──────────────────────────────────────────────

export function assertUuid(id: unknown, field = 'id'): string {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw new BadCaseReviewPackError(400, 'INVALID_INPUT', `Invalid ${field}`);
  }
  return id;
}

export function assertAllowedStatusTransition(from: PackStatus, to: PackStatus): void {
  if (from === to) return;
  const allowed = ALLOWED_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadCaseReviewPackError(409, 'CONFLICT', 'Illegal status transition');
  }
}

export function isTerminalStatus(status: PackStatus): boolean {
  return status === 'resolved' || status === 'wont_fix' || status === 'duplicate';
}

export function mapEngineToPromptVariant(
  engine: GenerationEngine | string | null | undefined,
): GeneratePromptVariant | null {
  if (engine === 'self-hosted-cantonese') return 'cantonese_llm';
  if (engine === 'deepseek') return 'deepseek';
  if (engine === 'rules') return 'rules_fallback';
  return null;
}

export function projectModelAttemptsToTrace(
  attempts: AdminBadCaseModelAttempts,
): ReviewPackDetail['trace'] {
  if (attempts.status !== 'available') {
    return { status: 'unavailable', events: [] };
  }
  const events: TraceEvent[] = attempts.items.map((item) => ({
    createdAt: item.createdAt,
    operation: item.operation,
    provider: item.provider,
    model: item.model,
    status: item.status,
    errorClass: item.errorClass,
    latencyMs: item.latencyMs,
    attempt: item.attempt,
    promptTokens: item.promptTokens,
    completionTokens: item.completionTokens,
    totalTokens: item.totalTokens,
    cacheHitTokens: item.cacheHitTokens,
    cacheMissTokens: item.cacheMissTokens,
    usageSource: item.usageSource,
  }));
  return { status: 'available', events };
}

export function deriveSeverity(findings: Array<{ severity: string }>): string | null {
  let best: string | null = null;
  let bestRank = 0;
  for (const f of findings) {
    const rank = SEVERITY_RANK[f.severity] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = f.severity;
    }
  }
  return best;
}

/** Hash the allowlisted manifest body exactly as the proposal builder does. */
export function hashReviewPackArtifactManifest(manifest: object): string {
  return hashArtifactSnapshotBody(manifest);
}

function criterionName(id: string): string {
  const names: Record<string, string> = {
    'score.total_threshold': '总分阈值',
    'runtime.generation_success': '生成成功',
    'compliance.redlines_and_risks': '红线与合规',
    'output.variants_complete': '五平台完整性',
  };
  return names[id] ?? id;
}
function projectCriteria(evaluations: CriterionEvaluation[]): ReviewPackDetail['criteria'] {
  return evaluations.map((e) => ({
    criterionId: e.criterionId,
    name: criterionName(e.criterionId),
    version: e.version,
    result: e.status,
    actual: e.actual,
    expected: e.expected,
    evidenceRefs: e.evidenceRefs,
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function classifyDbError(err: unknown): BadCaseReviewPackError {
  const msg = err instanceof Error ? err.message : String(err);
  if (/relation .* does not exist|42P01|schema cache|Could not find the table/i.test(msg)) {
    return new BadCaseReviewPackError(503, 'SERVICE_UNAVAILABLE');
  }
  if (err instanceof BadCaseReviewPackError) return err;
  return new BadCaseReviewPackError(500, 'INTERNAL');
}

function sanitizeLogCategory(category: string, jobId: string): void {
  // Fixed categories only — never log raw provider/DB messages.
  console.error(`[review_pack] category=${category} jobId=${jobId}`);
}

// ── Body parsers ──────────────────────────────────────────────

const ASSIGN_KEYS = new Set(['ownerTeam', 'assigneeId', 'reason']);
const STATUS_KEYS = new Set(['status', 'reason']);
const REVIEW_KEYS = new Set(['disposition', 'reviewerComment']);
const PROPOSAL_KEYS = new Set([
  'artifactType',
  'before',
  'afterPatch',
  'rationale',
  'note',
]);

function assertOnlyKeys(body: Record<string, unknown>, allowed: Set<string>): void {
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      throw new BadCaseReviewPackError(400, 'INVALID_INPUT', `Unexpected field: ${key}`);
    }
  }
}

function rejectUntrustedFields(body: Record<string, unknown>): void {
  try {
    rejectUntrustedActorFields(body);
  } catch {
    throw new BadCaseReviewPackError(400, 'INVALID_INPUT');
  }
}

export function parseAssignBody(raw: unknown): {
  ownerTeam: OwnerTeam;
  assigneeId: string | null;
  reason: string | null;
} {
  if (!isRecord(raw)) throw new BadCaseReviewPackError(400, 'INVALID_INPUT');
  rejectUntrustedFields(raw);
  assertOnlyKeys(raw, ASSIGN_KEYS);
  const ownerTeam = raw.ownerTeam;
  if (typeof ownerTeam !== 'string' || !OWNER_TEAMS.includes(ownerTeam as OwnerTeam)) {
    throw new BadCaseReviewPackError(400, 'INVALID_INPUT', 'Invalid ownerTeam');
  }
  let assigneeId: string | null = null;
  if (raw.assigneeId != null) {
    if (typeof raw.assigneeId !== 'string' || !UUID_RE.test(raw.assigneeId)) {
      throw new BadCaseReviewPackError(400, 'INVALID_INPUT', 'Invalid assigneeId');
    }
    assigneeId = raw.assigneeId;
  }
  const reason =
    raw.reason == null ? null : typeof raw.reason === 'string' ? raw.reason.slice(0, 2000) : null;
  if (raw.reason != null && typeof raw.reason !== 'string') {
    throw new BadCaseReviewPackError(400, 'INVALID_INPUT');
  }
  return { ownerTeam: ownerTeam as OwnerTeam, assigneeId, reason };
}

export function parseStatusBody(raw: unknown): { status: PackStatus; reason: string | null } {
  if (!isRecord(raw)) throw new BadCaseReviewPackError(400, 'INVALID_INPUT');
  rejectUntrustedFields(raw);
  assertOnlyKeys(raw, STATUS_KEYS);
  const status = raw.status;
  if (typeof status !== 'string' || !PACK_STATUSES.includes(status as PackStatus)) {
    throw new BadCaseReviewPackError(400, 'INVALID_INPUT', 'Invalid status');
  }
  const reason =
    raw.reason == null ? null : typeof raw.reason === 'string' ? raw.reason.slice(0, 2000) : null;
  if (raw.reason != null && typeof raw.reason !== 'string') {
    throw new BadCaseReviewPackError(400, 'INVALID_INPUT');
  }
  return { status: status as PackStatus, reason };
}

export function parseFindingReviewBody(raw: unknown): {
  disposition: FindingDisposition;
  reviewerComment: string | null;
} {
  if (!isRecord(raw)) throw new BadCaseReviewPackError(400, 'INVALID_INPUT');
  rejectUntrustedFields(raw);
  assertOnlyKeys(raw, REVIEW_KEYS);
  const disposition = raw.disposition;
  if (typeof disposition !== 'string' || !DISPOSITIONS.includes(disposition as FindingDisposition)) {
    throw new BadCaseReviewPackError(400, 'INVALID_INPUT', 'Invalid disposition');
  }
  const reviewerComment =
    raw.reviewerComment == null
      ? null
      : typeof raw.reviewerComment === 'string'
        ? raw.reviewerComment.slice(0, 4000)
        : null;
  if (raw.reviewerComment != null && typeof raw.reviewerComment !== 'string') {
    throw new BadCaseReviewPackError(400, 'INVALID_INPUT');
  }
  return { disposition: disposition as FindingDisposition, reviewerComment };
}

export function parseProposalBody(raw: unknown): CreateBadCaseProposalInput & { findingId: string } {
  if (!isRecord(raw)) throw new BadCaseReviewPackError(400, 'INVALID_INPUT');
  rejectUntrustedFields(raw);
  assertOnlyKeys(raw, PROPOSAL_KEYS);

  // note-only or missing required E5 fields → 400
  const hasNoteOnly =
    typeof raw.note === 'string' &&
    raw.artifactType == null &&
    raw.before == null &&
    raw.afterPatch == null;
  if (hasNoteOnly) {
    throw new BadCaseReviewPackError(400, 'INVALID_INPUT', 'Proposal requires artifactType, before, afterPatch');
  }
  if (raw.artifactType == null || raw.before == null || raw.afterPatch == null) {
    throw new BadCaseReviewPackError(400, 'INVALID_INPUT', 'Proposal requires artifactType, before, afterPatch');
  }

  return {
    findingId: '', // filled by caller
    artifactType: raw.artifactType as CreateBadCaseProposalInput['artifactType'],
    before: raw.before as CreateBadCaseProposalInput['before'],
    afterPatch: raw.afterPatch as CreateBadCaseProposalInput['afterPatch'],
    rationale:
      typeof raw.rationale === 'string'
        ? raw.rationale
        : typeof raw.note === 'string'
          ? raw.note
          : null,
  };
}

// ── Trusted repository (fixed column allowlists) ──────────────

function mapPackRow(row: Record<string, unknown>): {
  id: string;
  generationJobId: string;
  subjectOwnerId: string;
  triggerKind: string;
  status: PackStatus;
  ownerTeam: string;
  assigneeId: string | null;
  criteriaVersion: string;
  analysisStatus: string;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
} {
  return {
    id: String(row.id),
    generationJobId: String(row.generation_job_id),
    subjectOwnerId: String(row.subject_owner_id),
    triggerKind: String(row.trigger_kind),
    status: row.status as PackStatus,
    ownerTeam: String(row.owner_team),
    assigneeId: row.assignee_id == null ? null : String(row.assignee_id),
    criteriaVersion: String(row.criteria_version),
    analysisStatus: String(row.analysis_status),
    summary: row.summary == null ? null : String(row.summary),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    resolvedAt: row.resolved_at == null ? null : String(row.resolved_at),
  };
}

export async function getReviewPackScope(packId: string): Promise<ReviewPackScopeRow | null> {
  try {
    const db = getTrustedSupabase();
    const { data, error } = await db
      .from('bad_case_review_packs')
      .select(PACK_SCOPE_SELECT)
      .eq('id', packId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as { id: string; generation_job_id: string; subject_owner_id: string };
    return {
      id: row.id,
      generationJobId: row.generation_job_id,
      subjectOwnerId: row.subject_owner_id,
    };
  } catch (err) {
    throw classifyDbError(err);
  }
}

export async function isReviewPackVisible(scope: ReviewPackScopeRow): Promise<boolean> {
  try {
    const db = getTrustedSupabase();
    const { data, error } = await db
      .from('generation_jobs')
      .select('id,owner_id,deleted_at')
      .eq('id', scope.generationJobId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return false;
    const row = data as { id: string; owner_id: string; deleted_at: string | null };
    if (row.deleted_at) return false;
    if (row.owner_id !== scope.subjectOwnerId) return false;
    return true;
  } catch (err) {
    throw classifyDbError(err);
  }
}

async function loadSubjectOwner(ownerId: string): Promise<SubjectOwnerView> {
  try {
    const db = getTrustedSupabase();
    const { data, error } = await db
      .from('profiles')
      .select('id,display_name,review_group')
      .eq('id', ownerId)
      .maybeSingle();
    if (error || !data) {
      return { ownerId, displayName: null, reviewGroup: null };
    }
    const row = data as { id: string; display_name?: string | null; review_group?: string | null };
    return {
      ownerId,
      displayName: typeof row.display_name === 'string' ? row.display_name : null,
      reviewGroup: typeof row.review_group === 'string' ? row.review_group : null,
    };
  } catch {
    return { ownerId, displayName: null, reviewGroup: null };
  }
}

export async function listReviewPacksMeta(
  params: ListReviewPacksParams = {},
): Promise<ReviewPackListResult> {
  try {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const offset = Math.max(params.offset ?? 0, 0);

    if (params.status && !PACK_STATUSES.includes(params.status as PackStatus)) {
      throw new BadCaseReviewPackError(400, 'INVALID_INPUT', 'Invalid status filter');
    }
    if (params.ownerTeam && !OWNER_TEAMS.includes(params.ownerTeam as OwnerTeam)) {
      throw new BadCaseReviewPackError(400, 'INVALID_INPUT', 'Invalid ownerTeam filter');
    }
    if (params.triggerKind && !TRIGGER_KINDS.includes(params.triggerKind as TriggerKind)) {
      throw new BadCaseReviewPackError(400, 'INVALID_INPUT', 'Invalid triggerKind filter');
    }

    const db = getTrustedSupabase();
    let query = db
      .from('bad_case_review_packs')
      .select(PACK_META_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.status) query = query.eq('status', params.status);
    if (params.ownerTeam) query = query.eq('owner_team', params.ownerTeam);
    if (params.triggerKind) query = query.eq('trigger_kind', params.triggerKind);

    const { data, error, count } = await query;
    if (error) throw error;

    const rows = (data ?? []) as Record<string, unknown>[];
    const items: ReviewPackListItem[] = [];

    for (const raw of rows) {
      const pack = mapPackRow(raw);
      // Soft-deleted jobs excluded
      const visible = await isReviewPackVisible({
        id: pack.id,
        generationJobId: pack.generationJobId,
        subjectOwnerId: pack.subjectOwnerId,
      });
      if (!visible) continue;

      const { data: jobMeta } = await db
        .from('generation_jobs')
        .select('scores')
        .eq('id', pack.generationJobId)
        .is('deleted_at', null)
        .maybeSingle();
      const scores = (jobMeta as { scores?: unknown } | null)?.scores as CriteriaJobSnapshot['scores'];
      const score = readGeneratedTotal(scores ?? null);

      const { data: findingRows } = await db
        .from('bad_case_findings')
        .select('severity')
        .eq('review_pack_id', pack.id);
      const findings = (findingRows ?? []) as Array<{ severity: string }>;
      const severity = deriveSeverity(findings);
      const criticalFailCount = findings.filter(
        (f) => f.severity === 'critical' || f.severity === 'high',
      ).length;

      const subjectOwner = await loadSubjectOwner(pack.subjectOwnerId);

      items.push({
        id: pack.id,
        generationJobId: pack.generationJobId,
        status: pack.status,
        triggerKind: pack.triggerKind,
        ownerTeam: pack.ownerTeam,
        assigneeId: pack.assigneeId,
        subjectOwner,
        score,
        severity,
        analysisStatus: pack.analysisStatus,
        summary: pack.summary,
        createdAt: pack.createdAt,
        updatedAt: pack.updatedAt,
        resolvedAt: pack.resolvedAt,
        findingCount: findings.length,
        criticalFailCount,
      });
    }

    return { items, total: typeof count === 'number' ? count : items.length };
  } catch (err) {
    if (err instanceof BadCaseReviewPackError) throw err;
    throw classifyDbError(err);
  }
}

function diagnosticsUtcBounds(range: AdminMetricsRange): { start: string; endExclusive: string } {
  const start = new Date(`${range.from}T00:00:00+08:00`);
  const end = new Date(`${range.to}T00:00:00+08:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), endExclusive: end.toISOString() };
}

/**
 * Global, de-identified diagnostic aggregates for super-admin routes.
 * The route owns role verification; this service never returns owner/sample bodies.
 */
export async function getReviewPackDiagnostics(
  range: AdminMetricsRange,
): Promise<ReviewPackDiagnosticsResult> {
  try {
    const db = getTrustedSupabase();
    const { start, endExclusive } = diagnosticsUtcBounds(range);
    const { data: packData, error: packError } = await db
      .from('bad_case_review_packs')
      .select('id,generation_job_id,subject_owner_id,status,created_at,resolved_at')
      .gte('created_at', start)
      .lt('created_at', endExclusive)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (packError) throw packError;

    const rawPacks = (packData ?? []) as Array<Record<string, unknown>>;
    if (rawPacks.length === 0) {
      return {
        ...range,
        summary: buildDiagnosticsSummary({ findings: [], criteria: [], packs: [] }),
      };
    }

    const jobIds = [...new Set(rawPacks.map((row) => String(row.generation_job_id)))];
    const { data: jobData, error: jobError } = await db
      .from('generation_jobs')
      .select('id,owner_id,status,deleted_at,brand_red_lines,brief,variants,audit,scores,error_code')
      .in('id', jobIds)
      .is('deleted_at', null);
    if (jobError) throw jobError;

    const jobsById = new Map(
      ((jobData ?? []) as Array<Record<string, unknown>>).map((row) => [String(row.id), row]),
    );
    const packs = rawPacks.filter((row) => {
      const job = jobsById.get(String(row.generation_job_id));
      return job && String(job.owner_id) === String(row.subject_owner_id);
    });
    const packIds = packs.map((row) => String(row.id));
    if (packIds.length === 0) {
      return {
        ...range,
        summary: buildDiagnosticsSummary({ findings: [], criteria: [], packs: [] }),
      };
    }

    const [{ data: findingData, error: findingError }, { data: eventData, error: eventError }] =
      await Promise.all([
        db
          .from('bad_case_findings')
          .select('id,review_pack_id,category,disposition,reviewed_at,created_at')
          .in('review_pack_id', packIds),
        db
          .from('bad_case_review_events')
          .select('review_pack_id,event_type,created_at')
          .in('review_pack_id', packIds)
          .eq('event_type', 'pack_assigned'),
      ]);
    if (findingError) throw findingError;
    if (eventError) throw eventError;

    const findings: DiagnosticFindingRow[] = [];
    for (const row of (findingData ?? []) as Array<Record<string, unknown>>) {
      const category = String(row.category) as FindingCategory;
      if (!FINDING_CATEGORIES.includes(category)) continue;
      const disposition = row.disposition == null
        ? null
        : String(row.disposition) as EvaluationDisposition;
      findings.push({
        findingId: String(row.id),
        reviewPackId: String(row.review_pack_id),
        category,
        disposition,
        reviewedAt: row.reviewed_at == null ? null : String(row.reviewed_at),
        createdAt: String(row.created_at),
      });
    }

    const firstAssignedByPack = new Map<string, string>();
    for (const row of (eventData ?? []) as Array<Record<string, unknown>>) {
      const packId = String(row.review_pack_id);
      const createdAt = String(row.created_at);
      const previous = firstAssignedByPack.get(packId);
      if (!previous || createdAt < previous) firstAssignedByPack.set(packId, createdAt);
    }

    const categoriesByPack = new Map<string, FindingCategory[]>();
    for (const finding of findings) {
      const categories = categoriesByPack.get(finding.reviewPackId) ?? [];
      categories.push(finding.category);
      categoriesByPack.set(finding.reviewPackId, categories);
    }

    const diagnosticPacks: DiagnosticPackRow[] = packs.map((row) => {
      const reviewPackId = String(row.id);
      return {
        reviewPackId,
        generationJobId: String(row.generation_job_id),
        createdAt: String(row.created_at),
        firstAssignedAt: firstAssignedByPack.get(reviewPackId) ?? null,
        resolvedAt: row.resolved_at == null ? null : String(row.resolved_at),
        status: String(row.status),
        categories: categoriesByPack.get(reviewPackId) ?? [],
      };
    });

    const criteria: DiagnosticCriterionRow[] = [];
    for (const pack of diagnosticPacks) {
      const job = jobsById.get(pack.generationJobId);
      if (!job) continue;
      for (const result of evaluateBadCaseCriteria(jobRowToCriteriaSnapshot(job))) {
        criteria.push({
          reviewPackId: pack.reviewPackId,
          criterionId: result.criterionId,
          result: result.status,
        });
      }
    }

    return {
      ...range,
      summary: buildDiagnosticsSummary({
        findings,
        criteria,
        packs: diagnosticPacks,
      }),
    };
  } catch (err) {
    if (err instanceof BadCaseReviewPackError) throw err;
    throw classifyDbError(err);
  }
}

export async function loadReviewPackDetailBody(
  scope: ReviewPackScopeRow,
): Promise<ReviewPackDetail | null> {
  try {
    if (!(await isReviewPackVisible(scope))) return null;

    const db = getTrustedSupabase();
    const { data: packRaw, error: packErr } = await db
      .from('bad_case_review_packs')
      .select(PACK_META_SELECT)
      .eq('id', scope.id)
      .maybeSingle();
    if (packErr) throw packErr;
    if (!packRaw) return null;
    const pack = mapPackRow(packRaw as unknown as Record<string, unknown>);

    const { data: jobRaw, error: jobErr } = await db
      .from('generation_jobs')
      .select(JOB_BODY_SELECT)
      .eq('id', scope.generationJobId)
      .is('deleted_at', null)
      .maybeSingle();
    if (jobErr) throw jobErr;
    if (!jobRaw) return null;
    const job = jobRaw as unknown as Record<string, unknown>;
    if (String(job.owner_id) !== scope.subjectOwnerId) return null;

    const { data: snapshotRaw } = await db
      .from('generation_artifact_snapshots')
      .select(SNAPSHOT_SELECT)
      .eq('generation_job_id', scope.generationJobId)
      .maybeSingle();

    const { data: findingRows, error: findErr } = await db
      .from('bad_case_findings')
      .select(FINDING_SELECT)
      .eq('review_pack_id', scope.id)
      .order('created_at', { ascending: true });
    if (findErr) throw findErr;

    const { data: eventRows, error: eventErr } = await db
      .from('bad_case_review_events')
      .select(EVENT_SELECT)
      .eq('review_pack_id', scope.id)
      .order('created_at', { ascending: true });
    if (eventErr) throw eventErr;

    const modelAttempts = await getAdminBadCaseModelAttempts(scope.generationJobId);
    const trace = projectModelAttemptsToTrace(modelAttempts);

    const criteriaJob = jobRowToCriteriaSnapshot(job);
    const criteria = projectCriteria(evaluateBadCaseCriteria(criteriaJob));

    const findings = ((findingRows ?? []) as Record<string, unknown>[]).map((f) => ({
      id: String(f.id),
      category: String(f.category ?? 'unknown'),
      severity: String(f.severity ?? 'unknown'),
      confidence: typeof f.confidence === 'number' ? f.confidence : null,
      stage: f.stage == null ? null : String(f.stage),
      variantKey: f.variant_key == null ? null : String(f.variant_key),
      description: typeof f.description === 'string' ? f.description : '',
      evidenceRefs: Array.isArray(f.evidence_refs) ? f.evidence_refs : [],
      criterionRefs: Array.isArray(f.criterion_refs) ? f.criterion_refs : [],
      artifactRefs: Array.isArray(f.artifact_refs) ? f.artifact_refs : [],
      suggestion: f.suggestion ?? null,
      recommendedOwnerTeam: f.recommended_owner_team == null ? null : String(f.recommended_owner_team),
      disposition:
        typeof f.disposition === 'string' && DISPOSITIONS.includes(f.disposition as FindingDisposition)
          ? (f.disposition as FindingDisposition)
          : null,
      reviewerComment: f.reviewer_comment == null ? null : String(f.reviewer_comment),
      reviewedBy: f.reviewed_by == null ? null : String(f.reviewed_by),
      reviewedAt: f.reviewed_at == null ? null : String(f.reviewed_at),
    }));

    const auditEvents = ((eventRows ?? []) as Record<string, unknown>[]).map((e) => ({
      id: String(e.id),
      eventType: String(e.event_type ?? 'unknown'),
      actorId: e.actor_id == null ? null : String(e.actor_id),
      before: e.from_value ?? null,
      after: e.to_value ?? null,
      reason: e.reason == null ? null : String(e.reason),
      requestId: e.request_id == null ? null : String(e.request_id),
      createdAt: String(e.created_at ?? ''),
    }));

    const subjectOwner = await loadSubjectOwner(pack.subjectOwnerId);
    const scores = job.scores as CriteriaJobSnapshot['scores'];
    const score = readGeneratedTotal(scores ?? null);
    const severity = deriveSeverity(findings);

    let artifacts: ReviewPackDetail['artifacts'];
    if (!snapshotRaw) {
      artifacts = { status: 'legacy_unavailable' };
    } else {
      const snap = snapshotRaw as Record<string, unknown>;
      const availability = String(snap.availability ?? 'legacy_unavailable');
      const prompt = snap.prompt_manifest;
      const rules = snap.rule_manifest;
      const knowledge = snap.knowledge_manifest;
      const modelPolicy = snap.model_policy_manifest;
      artifacts = {
        status: availability === 'captured' ? 'available' : 'legacy_unavailable',
        ...(availability === 'captured'
          ? {
              contentHashes: {
                prompt: hashReviewPackArtifactManifest(prompt as object),
                rules: hashReviewPackArtifactManifest(rules as object),
                knowledge: hashReviewPackArtifactManifest(knowledge as object),
                model_policy: hashReviewPackArtifactManifest(modelPolicy as object),
              },
            }
          : {}),
        prompt,
        rules,
        knowledge,
        modelPolicy,
      };
    }

    const brief = isRecord(job.brief) ? job.brief : null;
    const sellingPoints =
      brief && Array.isArray(brief.productSellingPoints)
        ? brief.productSellingPoints
        : brief && isRecord(brief.workbenchSettings) && Array.isArray(brief.workbenchSettings.productSellingPoints)
          ? brief.workbenchSettings.productSellingPoints
          : undefined;

    return {
      id: pack.id,
      generationJobId: pack.generationJobId,
      status: pack.status,
      triggerKind: pack.triggerKind,
      ownerTeam: pack.ownerTeam,
      assigneeId: pack.assigneeId,
      subjectOwner,
      score,
      severity,
      analysisStatus: pack.analysisStatus,
      summary: pack.summary,
      createdAt: pack.createdAt,
      updatedAt: pack.updatedAt,
      resolvedAt: pack.resolvedAt,
      findingCount: findings.length,
      criticalFailCount: findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length,
      sample: {
        source: typeof job.source === 'string' ? job.source : '',
        brandName: job.brand_name == null ? null : String(job.brand_name),
        productName: job.product_name == null ? null : String(job.product_name),
        brief: job.brief ?? undefined,
        sellingPoints,
        brandRedlines: job.brand_red_lines == null ? null : String(job.brand_red_lines),
        settingsSnapshot: brief?.workbenchSettings,
        variants: isRecord(job.variants) ? (job.variants as Record<string, unknown>) : null,
        diagnosis: job.diagnosis ?? undefined,
        audit: job.audit ?? undefined,
        scores: job.scores ?? undefined,
        consumerFeedback: job.consumer_feedback ?? undefined,
        errorMessage: job.error_message == null ? null : String(job.error_message),
        errorCode: job.error_code == null ? null : String(job.error_code),
      },
      trace,
      criteria,
      artifacts,
      findings,
      auditEvents,
    };
  } catch (err) {
    if (err instanceof BadCaseReviewPackError) throw err;
    throw classifyDbError(err);
  }
}

function jobRowToCriteriaSnapshot(job: Record<string, unknown>): CriteriaJobSnapshot {
  const brief = isRecord(job.brief) ? job.brief : null;
  let productSellingPoints: CriteriaJobSnapshot['productSellingPoints'] = null;
  if (brief && Array.isArray(brief.productSellingPoints)) {
    productSellingPoints = brief.productSellingPoints as CriteriaJobSnapshot['productSellingPoints'];
  }
  return {
    id: String(job.id),
    ownerId: String(job.owner_id),
    status: String(job.status),
    deletedAt: job.deleted_at == null ? null : String(job.deleted_at),
    brandRedLines: job.brand_red_lines == null ? null : String(job.brand_red_lines),
    productSellingPoints,
    variants: (job.variants as CriteriaJobSnapshot['variants']) ?? null,
    audit: (job.audit as CriteriaJobSnapshot['audit']) ?? null,
    scores: (job.scores as CriteriaJobSnapshot['scores']) ?? null,
    errorCode: job.error_code == null ? null : String(job.error_code),
  };
}

// ── Writes ────────────────────────────────────────────────────

async function loadPackRow(packId: string) {
  const db = getTrustedSupabase();
  const { data, error } = await db
    .from('bad_case_review_packs')
    .select(PACK_META_SELECT)
    .eq('id', packId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapPackRow(data as Record<string, unknown>);
}

async function appendTrustedEvent(dto: EventInsertDto): Promise<void> {
  const prepared = prepareEventInsert(dto);
  const db = getTrustedSupabase();
  const { error } = await db.from('bad_case_review_events').insert({
    review_pack_id: prepared.review_pack_id,
    finding_id: prepared.finding_id,
    event_type: prepared.event_type,
    actor_id: prepared.actor_id,
    actor_role: prepared.actor_role,
    from_value: prepared.from_value,
    to_value: prepared.to_value,
    reason: prepared.reason,
    request_id: prepared.request_id,
    payload: prepared.payload,
  });
  if (error) throw error;
}

export async function assignReviewPack(
  actor: SuperAdminActor,
  packId: string,
  rawBody: unknown,
  requestId?: string | null,
): Promise<{ id: string; ownerTeam: string; assigneeId: string | null }> {
  const id = assertUuid(packId);
  const input = parseAssignBody(rawBody);
  try {
    const scope = await getReviewPackScope(id);
    if (!scope || !(await isReviewPackVisible(scope))) {
      throw new BadCaseReviewPackError(404, 'NOT_FOUND');
    }
    const prev = await loadPackRow(id);
    if (!prev) throw new BadCaseReviewPackError(404, 'NOT_FOUND');

    const db = getTrustedSupabase();
    const { error } = await db
      .from('bad_case_review_packs')
      .update({
        owner_team: input.ownerTeam,
        assignee_id: input.assigneeId,
      })
      .eq('id', id);
    if (error) throw error;

    await appendTrustedEvent({
      reviewPackId: id,
      eventType: 'pack_assigned',
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      fromValue: { ownerTeam: prev.ownerTeam, assigneeId: prev.assigneeId },
      toValue: { ownerTeam: input.ownerTeam, assigneeId: input.assigneeId },
      reason: input.reason,
      requestId: requestId ?? null,
      payload: {},
    });

    return { id, ownerTeam: input.ownerTeam, assigneeId: input.assigneeId };
  } catch (err) {
    if (err instanceof BadCaseReviewPackError) throw err;
    throw classifyDbError(err);
  }
}

export async function transitionReviewPackStatus(
  actor: SuperAdminActor,
  packId: string,
  rawBody: unknown,
  requestId?: string | null,
): Promise<{ id: string; status: PackStatus; resolvedAt: string | null }> {
  const id = assertUuid(packId);
  const input = parseStatusBody(rawBody);
  try {
    const scope = await getReviewPackScope(id);
    if (!scope || !(await isReviewPackVisible(scope))) {
      throw new BadCaseReviewPackError(404, 'NOT_FOUND');
    }
    const prev = await loadPackRow(id);
    if (!prev) throw new BadCaseReviewPackError(404, 'NOT_FOUND');

    assertAllowedStatusTransition(prev.status, input.status);

    const now = new Date().toISOString();
    let resolvedAt: string | null = prev.resolvedAt;
    if (isTerminalStatus(input.status)) {
      resolvedAt = now;
    } else if (isTerminalStatus(prev.status) && !isTerminalStatus(input.status)) {
      resolvedAt = null;
    }

    const db = getTrustedSupabase();
    const { error } = await db
      .from('bad_case_review_packs')
      .update({
        status: input.status,
        resolved_at: resolvedAt,
      })
      .eq('id', id);
    if (error) throw error;

    if (prev.status !== input.status) {
      await appendTrustedEvent({
        reviewPackId: id,
        eventType: 'pack_status_changed',
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        fromValue: { status: prev.status },
        toValue: { status: input.status, resolvedAt },
        reason: input.reason,
        requestId: requestId ?? null,
        payload: {},
      });
    }

    return { id, status: input.status, resolvedAt };
  } catch (err) {
    if (err instanceof BadCaseReviewPackError) throw err;
    throw classifyDbError(err);
  }
}

export async function reviewFinding(
  actor: SuperAdminActor,
  findingId: string,
  rawBody: unknown,
  requestId?: string | null,
): Promise<{ id: string; disposition: FindingDisposition; reviewedBy: string; reviewedAt: string }> {
  const id = assertUuid(findingId, 'findingId');
  const input = parseFindingReviewBody(rawBody);
  try {
    const db = getTrustedSupabase();
    const { data: finding, error } = await db
      .from('bad_case_findings')
      .select('id,review_pack_id,disposition,reviewer_comment')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!finding) throw new BadCaseReviewPackError(404, 'NOT_FOUND');

    const packId = String((finding as { review_pack_id: string }).review_pack_id);
    const scope = await getReviewPackScope(packId);
    if (!scope || !(await isReviewPackVisible(scope))) {
      throw new BadCaseReviewPackError(404, 'NOT_FOUND');
    }

    const reviewedAt = new Date().toISOString();
    const prevDisposition = (finding as { disposition?: string | null }).disposition ?? null;
    const prevComment = (finding as { reviewer_comment?: string | null }).reviewer_comment ?? null;

    const { error: updErr } = await db
      .from('bad_case_findings')
      .update({
        disposition: input.disposition,
        reviewer_comment: input.reviewerComment,
        reviewed_by: actor.actorId,
        reviewed_at: reviewedAt,
      })
      .eq('id', id);
    if (updErr) throw updErr;

    await appendTrustedEvent({
      reviewPackId: packId,
      findingId: id,
      eventType: 'finding_reviewed',
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      fromValue: { disposition: prevDisposition, reviewerComment: prevComment },
      toValue: { disposition: input.disposition, reviewerComment: input.reviewerComment },
      reason: null,
      requestId: requestId ?? null,
      payload: {},
    });

    return {
      id,
      disposition: input.disposition,
      reviewedBy: actor.actorId,
      reviewedAt,
    };
  } catch (err) {
    if (err instanceof BadCaseReviewPackError) throw err;
    throw classifyDbError(err);
  }
}

export async function requestPackAnalysis(
  actor: SuperAdminActor,
  packId: string,
  requestId?: string | null,
): Promise<{
  id: string;
  analysisStatus: AnalysisStatus;
  idempotent?: boolean;
  findingCount?: number;
  criteriaVersion?: string;
  analysisVersion?: string;
  provider?: string;
  model?: string;
  suggestionCount?: number;
  failureClass?: string;
}> {
  const id = assertUuid(packId);
  checkAnalyzeRateLimit(actor.actorId, id);
  try {
    const scope = await getReviewPackScope(id);
    if (!scope || !(await isReviewPackVisible(scope))) {
      throw new BadCaseReviewPackError(404, 'NOT_FOUND');
    }
    const prev = await loadPackRow(id);
    if (!prev) throw new BadCaseReviewPackError(404, 'NOT_FOUND');

    const db = getTrustedSupabase();

    // Old `completed` rows were deterministic-only. Treat a versioned DeepSeek
    // completion event as the idempotency marker so they can be upgraded once.
    if (prev.analysisStatus === 'completed' && prev.criteriaVersion === CRITERIA_VERSION) {
      const { data: latestCompletion, error: completionErr } = await db
        .from('bad_case_review_events')
        .select('payload')
        .eq('review_pack_id', id)
        .eq('event_type', 'analysis_completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (completionErr) throw completionErr;
      const payload = latestCompletion && typeof latestCompletion === 'object'
        ? (latestCompletion as { payload?: Record<string, unknown> }).payload
        : null;
      if (payload?.analysisVersion === BAD_CASE_AI_ANALYSIS_VERSION) {
        return {
          id,
          analysisStatus: 'completed',
          idempotent: true,
          criteriaVersion: prev.criteriaVersion,
          analysisVersion: BAD_CASE_AI_ANALYSIS_VERSION,
          provider: 'deepseek',
          model: typeof payload.model === 'string' ? payload.model : undefined,
          suggestionCount: typeof payload.suggestionCount === 'number'
            ? payload.suggestionCount
            : undefined,
        };
      }
    }

    // If already pending, return without re-running (idempotent)
    if (prev.analysisStatus === 'pending') {
      return { id, analysisStatus: 'pending', idempotent: true };
    }

    await db
      .from('bad_case_review_packs')
      .update({ analysis_status: 'pending' })
      .eq('id', id);

    await appendTrustedEvent({
      reviewPackId: id,
      eventType: 'analysis_requested',
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      fromValue: { analysisStatus: prev.analysisStatus },
      toValue: { analysisStatus: 'pending' },
      reason: null,
      requestId: requestId ?? null,
      payload: {},
    });

    // Rebuild deterministic evidence first, then ask DeepSeek to add review-only
    // diagnoses bound to those criterion refs. DeepSeek never mutates live artifacts.
    try {
      const { data: jobRaw, error: jobErr } = await db
        .from('generation_jobs')
        .select(JOB_BODY_SELECT)
        .eq('id', scope.generationJobId)
        .is('deleted_at', null)
        .maybeSingle();
      if (jobErr || !jobRaw) throw jobErr ?? new Error('job missing');

      const { data: snapRaw } = await db
        .from('generation_artifact_snapshots')
        .select(SNAPSHOT_SELECT)
        .eq('generation_job_id', scope.generationJobId)
        .maybeSingle();

      let manifest: GenerationArtifactManifest;
      if (snapRaw) {
        const snap = snapRaw as Record<string, unknown>;
        const availability =
          snap.availability === 'captured' ? 'captured' : 'legacy_unavailable';
        if (availability === 'captured') {
          const body = {
            schemaVersion: Number(snap.schema_version) || 1,
            availability: 'captured' as const,
            prompt: snap.prompt_manifest,
            rules: snap.rule_manifest,
            knowledge: snap.knowledge_manifest,
            modelPolicy: snap.model_policy_manifest,
          };
          manifest = {
            ...body,
            contentHash: String(snap.content_hash),
          } as GenerationArtifactManifest;
        } else {
          manifest = createLegacyUnavailableManifest('snapshot_missing');
        }
      } else {
        manifest = createLegacyUnavailableManifest('snapshot_missing');
      }

      const job = jobRowToCriteriaSnapshot(jobRaw as unknown as Record<string, unknown>);
      const modelAttempts = await getAdminBadCaseModelAttempts(scope.generationJobId);
      const draft = assembleReviewPackUpsert({
        job: { ...job, generationEngine: (jobRaw as { generation_engine?: string }).generation_engine },
        artifactManifest: manifest,
        modelAttempts:
          modelAttempts.status === 'available'
            ? { status: 'available', items: modelAttempts.items }
            : { status: 'unavailable', items: [] },
        manualFlag: null,
      });

      // No DELETE grant on findings: upsert by criterion_refs key; preserve human disposition.
      const { data: existingFindings } = await db
        .from('bad_case_findings')
        .select(FINDING_SELECT)
        .eq('review_pack_id', id);
      const existingByKey = new Map<string, Record<string, unknown>>();
      for (const f of (existingFindings ?? []) as Array<Record<string, unknown>>) {
        const refs = Array.isArray(f.criterion_refs) ? f.criterion_refs : [];
        const key = refs.map(String).sort().join('|');
        if (key) existingByKey.set(key, f);
      }

      const newFindings = draft?.findings ?? [];
      let findingCount = existingByKey.size;

      for (const f of newFindings) {
        const key = f.criterionRefs.slice().sort().join('|');
        const prevFinding = existingByKey.get(key);
        if (prevFinding) {
          const { error: updFindErr } = await db
            .from('bad_case_findings')
            .update({
              category: f.category,
              severity: f.severity,
              confidence: f.confidence,
              stage: f.stage,
              variant_key: f.variantKey,
              description: f.description.slice(0, 4000),
              evidence_refs: f.evidenceRefs,
              criterion_refs: f.criterionRefs,
              artifact_refs: f.artifactRefs,
              recommended_owner_team: f.recommendedOwnerTeam,
              // preserve disposition / reviewer_* columns
            })
            .eq('id', String(prevFinding.id));
          if (updFindErr) throw updFindErr;
        } else {
          const prepared = prepareFindingsInsert(id, [
            {
              category: f.category,
              severity: f.severity,
              confidence: f.confidence,
              stage: f.stage,
              variantKey: f.variantKey,
              description: f.description,
              evidenceRefs: f.evidenceRefs,
              criterionRefs: f.criterionRefs,
              artifactRefs: f.artifactRefs,
              recommendedOwnerTeam: f.recommendedOwnerTeam,
              suggestion: f.suggestion,
            },
          ]);
          const { error: insErr } = await db.from('bad_case_findings').insert(prepared);
          if (insErr) throw insErr;
          findingCount += 1;
        }
      }

      const { data: analysisFindings, error: analysisFindingsErr } = await db
        .from('bad_case_findings')
        .select(FINDING_SELECT)
        .eq('review_pack_id', id);
      if (analysisFindingsErr) throw analysisFindingsErr;
      const findingRows = (analysisFindings ?? []) as Array<Record<string, unknown>>;
      findingCount = findingRows.length;
      const findingByCriterion = new Map<string, Record<string, unknown>>();
      for (const row of findingRows) {
        for (const ref of Array.isArray(row.criterion_refs) ? row.criterion_refs : []) {
          findingByCriterion.set(String(ref), row);
        }
      }

      const rawJob = jobRaw as unknown as Record<string, unknown>;
      const rawVariants = isRecord(rawJob.variants) ? rawJob.variants : {};
      const aiResult = await analyzeBadCaseWithDeepSeek({
        source: typeof rawJob.source === 'string' ? rawJob.source : '',
        variants: Object.fromEntries(
          Object.entries(rawVariants)
            .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        ),
        criteria: (draft?.criteria ?? []).map((criterion) => ({
          criterionRef: `${criterion.criterionId}@${criterion.version}`,
          result: criterion.status,
          actual: criterion.actual,
          expected: criterion.expected,
        })),
        findings: findingRows.flatMap((row) => {
          const ref = Array.isArray(row.criterion_refs) ? String(row.criterion_refs[0] ?? '') : '';
          if (!ref) return [];
          return [{
            criterionRef: ref,
            description: String(row.description ?? ''),
            category: String(row.category ?? ''),
            severity: String(row.severity ?? ''),
            stage: row.stage == null ? null : String(row.stage),
          }];
        }),
        modelAttempts: modelAttempts.status === 'available'
          ? modelAttempts.items.map((item) => ({
              operation: item.operation,
              provider: item.provider,
              model: item.model,
              status: item.status,
              errorClass: item.errorClass,
              latencyMs: item.latencyMs,
            }))
          : [],
      }, {
        jobId: scope.generationJobId,
        requestId: /^[0-9a-f-]{36}$/i.test(requestId ?? '')
          ? String(requestId)
          : crypto.randomUUID(),
      });

      for (const suggestion of aiResult.suggestions) {
        const target = findingByCriterion.get(suggestion.criterionRef);
        if (!target?.id) continue;
        const { error: suggestionErr } = await db
          .from('bad_case_findings')
          .update({
            suggestion: {
              provider: aiResult.provider,
              model: aiResult.model,
              analysisVersion: aiResult.analysisVersion,
              diagnosis: suggestion.diagnosis,
              remediation: suggestion.remediation,
              confidence: suggestion.confidence,
              ownerTeam: suggestion.ownerTeam,
              reviewRequired: true,
            },
          })
          .eq('id', String(target.id));
        if (suggestionErr) throw suggestionErr;
      }

      const deterministicSummary = draft?.pack.summary ?? prev.summary ?? '';
      const summary = `${deterministicSummary}; DeepSeek=${aiResult.summary}`.slice(0, 4000);
      await db
        .from('bad_case_review_packs')
        .update({
          analysis_status: 'completed',
          criteria_version: CRITERIA_VERSION,
          summary,
        })
        .eq('id', id);

      await appendTrustedEvent({
        reviewPackId: id,
        eventType: 'analysis_completed',
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        fromValue: { analysisStatus: 'pending' },
        toValue: {
          analysisStatus: 'completed',
          findingCount,
          criteriaVersion: CRITERIA_VERSION,
          analysisVersion: aiResult.analysisVersion,
        },
        reason: null,
        requestId: requestId ?? null,
        payload: {
          provider: aiResult.provider,
          model: aiResult.model,
          analysisVersion: aiResult.analysisVersion,
          suggestionCount: aiResult.suggestions.length,
        },
      });

      return {
        id,
        analysisStatus: 'completed',
        findingCount,
        criteriaVersion: CRITERIA_VERSION,
        analysisVersion: aiResult.analysisVersion,
        provider: aiResult.provider,
        model: aiResult.model,
        suggestionCount: aiResult.suggestions.length,
      };
    } catch (analysisError) {
      const failureClass = classifyModelError(analysisError);
      await db
        .from('bad_case_review_packs')
        .update({ analysis_status: 'analysis_unavailable' })
        .eq('id', id);
      try {
        await appendTrustedEvent({
          reviewPackId: id,
          eventType: 'analysis_failed',
          actorId: actor.actorId,
          actorRole: actor.actorRole,
          fromValue: { analysisStatus: 'pending' },
          toValue: { analysisStatus: 'analysis_unavailable' },
          reason: null,
          requestId: requestId ?? null,
          payload: { failureClass },
        });
      } catch {
        // ignore secondary event failure
      }
      return { id, analysisStatus: 'analysis_unavailable', failureClass };
    }
  } catch (err) {
    if (err instanceof BadCaseReviewPackError) throw err;
    throw classifyDbError(err);
  }
}

export async function createFindingProposal(
  actor: SuperAdminActor,
  findingId: string,
  rawBody: unknown,
  requestId?: string | null,
): Promise<BadCaseProposal> {
  const id = assertUuid(findingId, 'findingId');
  const partial = parseProposalBody(rawBody);
  const input: CreateBadCaseProposalInput = { ...partial, findingId: id };

  try {
    const db = getTrustedSupabase();
    const { data: finding, error } = await db
      .from('bad_case_findings')
      .select('id,review_pack_id,suggestion')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!finding) throw new BadCaseReviewPackError(404, 'NOT_FOUND');

    const packId = String((finding as { review_pack_id: string }).review_pack_id);
    const scope = await getReviewPackScope(packId);
    if (!scope || !(await isReviewPackVisible(scope))) {
      throw new BadCaseReviewPackError(404, 'NOT_FOUND');
    }

    const { data: snapshotRaw, error: snapshotError } = await db
      .from('generation_artifact_snapshots')
      .select(SNAPSHOT_SELECT)
      .eq('generation_job_id', scope.generationJobId)
      .maybeSingle();
    if (snapshotError) throw snapshotError;
    if (!snapshotRaw || String((snapshotRaw as { availability?: unknown }).availability) !== 'captured') {
      throw new BadCaseReviewPackError(409, 'CONFLICT', 'Artifact snapshot unavailable');
    }
    const snapshot = snapshotRaw as unknown as Record<string, unknown>;
    const manifestByType: Record<BadCaseProposalArtifactType, unknown> = {
      prompt: snapshot.prompt_manifest,
      rules: snapshot.rule_manifest,
      knowledge: snapshot.knowledge_manifest,
      model_policy: snapshot.model_policy_manifest,
    };
    const trustedSnapshot = {
      artifactType: input.artifactType,
      manifest: manifestByType[input.artifactType],
    } as CreateBadCaseProposalInput['before']['snapshot'];
    const trustedContentHash = hashReviewPackArtifactManifest(
      trustedSnapshot.manifest as object,
    );
    if (
      input.before.contentHash !== trustedContentHash
      || input.before.snapshot.artifactType !== input.artifactType
      || hashReviewPackArtifactManifest(input.before.snapshot.manifest as object) !== trustedContentHash
    ) {
      throw new BadCaseReviewPackError(409, 'CONFLICT', 'Artifact snapshot changed');
    }
    input.before = {
      contentHash: trustedContentHash,
      snapshot: trustedSnapshot,
      generationJobId: scope.generationJobId,
      artifactManifestContentHash:
        typeof snapshot.content_hash === 'string' ? snapshot.content_hash : null,
    };

    let proposal: BadCaseProposal;
    try {
      proposal = buildBadCaseProposal(input);
    } catch (e) {
      if (e instanceof BadCaseProposalError) {
        throw new BadCaseReviewPackError(400, 'INVALID_INPUT', e.code);
      }
      throw e;
    }

    // Only pending_review; never publish
    if (proposal.status !== 'pending_review' || proposal.publishable !== false) {
      throw new BadCaseReviewPackError(500, 'INTERNAL');
    }

    const { error: updErr } = await db
      .from('bad_case_findings')
      .update({
        suggestion: {
          proposalHash: proposal.proposalHash,
          status: proposal.status,
          publishable: false,
          autoPublish: false,
          artifactType: proposal.artifactType,
          diff: proposal.diff,
          rationale: proposal.rationale,
        },
      })
      .eq('id', id);
    if (updErr) throw updErr;

    await appendTrustedEvent({
      reviewPackId: packId,
      findingId: id,
      eventType: 'proposal_created',
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      fromValue: null,
      toValue: {
        proposalHash: proposal.proposalHash,
        status: 'pending_review',
        publishable: false,
        artifactType: proposal.artifactType,
      },
      reason: proposal.rationale,
      requestId: requestId ?? null,
      payload: {
        proposalHash: proposal.proposalHash,
        status: 'pending_review',
        publishable: false,
      },
    });

    return proposal;
  } catch (err) {
    if (err instanceof BadCaseReviewPackError) throw err;
    if (err instanceof BadCaseProposalError) {
      throw new BadCaseReviewPackError(400, 'INVALID_INPUT', err.code);
    }
    throw classifyDbError(err);
  }
}

// ── Trusted write port for generation hook ────────────────────

export function createTrustedReviewPackWritePort(): ReviewPackWritePort {
  return {
    async upsertSnapshot(dto) {
      const prepared = prepareSnapshotUpsert(dto);
      const db = getTrustedSupabase();
      const { error } = await db.from('generation_artifact_snapshots').upsert(
        {
          generation_job_id: prepared.generation_job_id,
          owner_id: prepared.owner_id,
          prompt_manifest: prepared.prompt_manifest,
          rule_manifest: prepared.rule_manifest,
          knowledge_manifest: prepared.knowledge_manifest,
          model_policy_manifest: prepared.model_policy_manifest,
          schema_version: prepared.schema_version,
          content_hash: prepared.content_hash,
          availability: prepared.availability,
        },
        { onConflict: 'generation_job_id' },
      );
      if (error) throw error;
    },
    async upsertPack(dto) {
      const prepared = preparePackUpsert(dto);
      const db = getTrustedSupabase();
      const { data: existing } = await db
        .from('bad_case_review_packs')
        .select('id')
        .eq('generation_job_id', prepared.generation_job_id)
        .maybeSingle();
      if (existing && (existing as { id: string }).id) {
        const id = (existing as { id: string }).id;
        const { error } = await db
          .from('bad_case_review_packs')
          .update({
            subject_owner_id: prepared.subject_owner_id,
            trigger_kind: prepared.trigger_kind,
            status: prepared.status,
            owner_team: prepared.owner_team,
            assignee_id: prepared.assignee_id,
            criteria_version: prepared.criteria_version,
            analysis_status: prepared.analysis_status,
            summary: prepared.summary,
          })
          .eq('id', id);
        if (error) throw error;
        return { id, created: false };
      }
      const { data, error } = await db
        .from('bad_case_review_packs')
        .insert({
          generation_job_id: prepared.generation_job_id,
          subject_owner_id: prepared.subject_owner_id,
          trigger_kind: prepared.trigger_kind,
          status: prepared.status,
          owner_team: prepared.owner_team,
          assignee_id: prepared.assignee_id,
          criteria_version: prepared.criteria_version,
          analysis_status: prepared.analysis_status,
          summary: prepared.summary,
        })
        .select('id')
        .single();
      if (error) throw error;
      return { id: String((data as { id: string }).id), created: true };
    },
    async replaceFindings(reviewPackId, findings) {
      // Migration grants insert/update only (no DELETE). Idempotent: skip if rows exist.
      const db = getTrustedSupabase();
      const { data: existing, error: readErr } = await db
        .from('bad_case_findings')
        .select('id')
        .eq('review_pack_id', reviewPackId)
        .limit(1);
      if (readErr) throw readErr;
      if (existing && existing.length > 0) return;
      if (findings.length === 0) return;
      const prepared = prepareFindingsInsert(reviewPackId, findings);
      const { error } = await db.from('bad_case_findings').insert(prepared);
      if (error) throw error;
    },
    async appendEvent(dto) {
      const prepared = prepareEventInsert(dto);
      const db = getTrustedSupabase();
      const { data, error } = await db
        .from('bad_case_review_events')
        .insert({
          review_pack_id: prepared.review_pack_id,
          finding_id: prepared.finding_id,
          event_type: prepared.event_type,
          actor_id: prepared.actor_id,
          actor_role: prepared.actor_role,
          from_value: prepared.from_value,
          to_value: prepared.to_value,
          reason: prepared.reason,
          request_id: prepared.request_id,
          payload: prepared.payload,
        })
        .select('id')
        .single();
      if (error) throw error;
      return { id: String((data as { id: string }).id) };
    },
  };
}

export function createInMemoryReviewPackWritePort(
  repo: InMemoryBadCaseReviewPackRepository = new InMemoryBadCaseReviewPackRepository(),
): ReviewPackWritePort & { repo: InMemoryBadCaseReviewPackRepository } {
  return {
    repo,
    async upsertSnapshot(dto) {
      await repo.upsertSnapshot(dto);
    },
    async upsertPack(dto) {
      const before = repo.listPacks().find((p) => p.generation_job_id === dto.generationJobId);
      const result = await repo.upsertPack(dto);
      return { id: result.id, created: !before };
    },
    async replaceFindings(reviewPackId, findings) {
      await repo.replaceFindings(reviewPackId, findings);
    },
    async appendEvent(dto) {
      return repo.appendEvent(dto);
    },
  };
}

/**
 * Best-effort post-generation snapshot + conditional pack create.
 * Never throws to the generation caller.
 */
export async function afterGenerationPersistReviewPack(
  input: AfterGenerationReviewPackInput,
  deps?: { port?: ReviewPackWritePort; timeoutMs?: number },
): Promise<{ ok: boolean; action?: string }> {
  const timeoutMs = deps?.timeoutMs ?? HOOK_TIMEOUT_MS;
  const port = deps?.port ?? createTrustedReviewPackWritePort();

  const run = async (): Promise<{ ok: boolean; action?: string }> => {
    try {
      if (input.status !== 'completed' && input.status !== 'failed') {
        return { ok: true, action: 'skipped' };
      }
      if (input.deletedAt) {
        return { ok: true, action: 'skipped' };
      }

      await port.upsertSnapshot({
        generationJobId: input.jobId,
        ownerId: input.ownerId,
        manifest: input.artifactManifest,
      });

      const draft = assembleReviewPackUpsert({
        job: {
          id: input.jobId,
          ownerId: input.ownerId,
          status: input.status,
          deletedAt: input.deletedAt ?? null,
          brandRedLines: input.brandRedLines ?? null,
          productSellingPoints: input.productSellingPoints ?? null,
          variants: input.variants ?? null,
          audit: input.audit ?? null,
          scores: input.scores ?? null,
          errorCode: input.errorCode ?? null,
          generationEngine: input.generationEngine ?? null,
        },
        artifactManifest: input.artifactManifest,
        modelAttempts: input.modelAttempts ?? { status: 'unavailable', items: [] },
        manualFlag: null,
      });

      if (!draft) {
        return { ok: true, action: 'snapshot_only' };
      }

      const { id: packId, created } = await port.upsertPack({
        generationJobId: draft.pack.generationJobId,
        subjectOwnerId: draft.pack.subjectOwnerId,
        triggerKinds: draft.pack.triggerKinds,
        status: draft.pack.status,
        ownerTeam: draft.pack.ownerTeam,
        assigneeId: draft.pack.assigneeId,
        criteriaVersion: draft.pack.criteriaVersion,
        analysisStatus: draft.pack.analysisStatus,
        summary: draft.pack.summary,
      });

      await port.replaceFindings(
        packId,
        draft.findings.map((f) => ({
          category: f.category,
          severity: f.severity,
          confidence: f.confidence,
          stage: f.stage,
          variantKey: f.variantKey,
          description: f.description,
          evidenceRefs: f.evidenceRefs,
          criterionRefs: f.criterionRefs,
          artifactRefs: f.artifactRefs,
          recommendedOwnerTeam: f.recommendedOwnerTeam,
          suggestion: f.suggestion,
        })),
      );

      if (created) {
        await port.appendEvent({
          reviewPackId: packId,
          eventType: draft.event.eventType,
          actorId: draft.event.actorId,
          actorRole: draft.event.actorRole,
          fromValue: draft.event.fromValue,
          toValue: draft.event.toValue,
          reason: draft.event.reason,
          requestId: draft.event.requestId,
          payload: draft.event.payload,
        });
      }

      return { ok: true, action: 'pack_upserted' };
    } catch {
      sanitizeLogCategory('review_pack.upsert_failed', input.jobId);
      return { ok: false, action: 'failed' };
    }
  };

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<{ ok: boolean; action?: string }>((resolve) => {
        timeoutHandle = setTimeout(() => {
          sanitizeLogCategory('review_pack.timeout', input.jobId);
          resolve({ ok: false, action: 'timeout' });
        }, timeoutMs);
      }),
    ]);
  } catch {
    sanitizeLogCategory('review_pack.unexpected', input.jobId);
    return { ok: false, action: 'failed' };
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
}

/**
 * Build E1 manifest for a finished generation, or explicit snapshot_missing.
 */
export function buildManifestForGeneration(options: {
  generationEngine?: string | null;
  captureInput?: ArtifactCaptureInput | null;
}): GenerationArtifactManifest {
  const variant = mapEngineToPromptVariant(options.generationEngine);
  if (variant && options.captureInput) {
    return buildGenerationArtifactManifest({
      ...options.captureInput,
      generatePromptVariant: variant,
    });
  }
  return createLegacyUnavailableManifest('snapshot_missing');
}

export function buildCaptureInputFromGenerateContext(ctx: {
  params: {
    platform: string;
    tone: string;
    toneModifiers?: string[];
    cantoneseLevel: number;
    englishMixingLevel: number;
    creativityLevel: number;
    inputLanguage: string;
    copyType?: string;
    customCopyType?: string;
    lengthControlEnabled?: boolean;
    copyLengthLevel?: number;
    refresh?: boolean;
    brandName?: string;
    productName?: string;
    brandRedLines?: string;
    productSellingPoints?: unknown[];
    referenceCases?: Array<{ id?: string; title?: string | null; variantKey?: string }>;
    calendarEvents?: Array<{ id?: string }>;
  };
  caseResolve: {
    requestedIds: string[];
    entries: Array<{
      id: string;
      caseType?: 'good' | 'bad' | null;
      title?: string | null;
      updatedAt?: string | null;
    }>;
    partialUnavailable: boolean;
  };
  generationEngine: string;
}): ArtifactCaptureInput | null {
  const variant = mapEngineToPromptVariant(ctx.generationEngine);
  if (!variant) return null;
  const policy = getModelRuntimePolicy();
  const params = ctx.params;
  const refCases = params.referenceCases ?? [];
  const calendarIds = (params.calendarEvents ?? [])
    .map((e) => e.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  return {
    generatePromptVariant: variant,
    resolvedParams: {
      platform: params.platform,
      primaryTone: params.tone,
      toneModifiers: params.toneModifiers ?? [],
      cantoneseLevel: params.cantoneseLevel,
      englishMixingLevel: params.englishMixingLevel,
      creativityLevel: params.creativityLevel,
      inputLanguage: params.inputLanguage,
      copyType: params.copyType ?? 'product',
      customCopyType: params.customCopyType,
      lengthControlEnabled: params.lengthControlEnabled ?? false,
      copyLengthLevel: params.copyLengthLevel ?? 3,
      refresh: params.refresh,
      hasBrandName: Boolean(params.brandName),
      hasProductName: Boolean(params.productName),
      hasBrandRedLines: Boolean(params.brandRedLines),
      productSellingPointCount: Array.isArray(params.productSellingPoints)
        ? params.productSellingPoints.length
        : 0,
      selectedCaseLibraryIds: [...ctx.caseResolve.requestedIds],
      referenceCaseIds: refCases
        .map((r) => r.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
      calendarEventIds: calendarIds,
    },
    caseLibrary: {
      requestedIds: [...ctx.caseResolve.requestedIds],
      resolvedIds: ctx.caseResolve.entries.map((e) => e.id),
      partialUnavailable: ctx.caseResolve.partialUnavailable,
      resolvedMeta: ctx.caseResolve.entries.map((e) => ({
        id: e.id,
        caseType: e.caseType ?? null,
        title: e.title ?? null,
        versionOrUpdatedAt: e.updatedAt ?? null,
      })),
    },
    referenceCases: refCases
      .filter((r): r is { id: string; title?: string | null; variantKey?: string } => typeof r.id === 'string')
      .map((r) => ({
        id: r.id,
        variantKey: r.variantKey,
        title: r.title ?? null,
      })),
    calendarEventIds: calendarIds,
    model: {
      requireRealModel: policy.requireRealModel,
      hasConfiguredRealModel: policy.hasConfiguredRealModel,
      generationTimeoutMs: policy.generationTimeoutMs,
      qualityScoreTimeoutMs: policy.qualityScoreTimeoutMs,
      postProcessingTimeoutMs: policy.postProcessingTimeoutMs,
      allowQualityRetry: policy.allowQualityRetry,
      defaultModel: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
      thinkingDisabled: true,
      temperature: null,
    },
  };
}
