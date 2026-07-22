/**
 * E6 client for Bad Case review-pack APIs.
 * Backend may be unavailable; callers must show honest empty/error states.
 */
import { apiUrl } from './apiBase';
import { supabase } from './supabase';

export type OwnerTeam =
  | 'content_prompt'
  | 'knowledge_rules'
  | 'model_provider'
  | 'backend_platform'
  | 'frontend_experience'
  | 'unassigned';

export type FindingDisposition =
  | 'confirmed'
  | 'false_positive'
  | 'accepted_risk'
  | 'needs_data'
  | 'resolved';

export type ReviewPackStatus =
  | 'open'
  | 'triaging'
  | 'in_progress'
  | 'resolved'
  | 'wont_fix'
  | 'duplicate';

export type CriterionResult = 'pass' | 'fail' | 'not_evaluated';

export type TraceStatus = 'available' | 'unavailable' | 'legacy_unavailable';
export type ProposalArtifactType = 'prompt' | 'rules' | 'knowledge' | 'model_policy';

export interface SubjectOwner {
  ownerId: string;
  displayName: string | null;
  reviewGroup: string | null;
}

export interface BadCaseReviewPackListItem {
  id: string;
  generationJobId: string;
  status: ReviewPackStatus;
  triggerKind: string;
  ownerTeam: OwnerTeam | string;
  assigneeId: string | null;
  subjectOwner: SubjectOwner;
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

export interface BadCaseReviewPackListResponse {
  items: BadCaseReviewPackListItem[];
  total: number;
}

export interface BadCaseFinding {
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
  recommendedOwnerTeam: OwnerTeam | string | null;
  disposition: FindingDisposition | null;
  reviewerComment: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

export interface BadCaseReviewAuditEvent {
  id: string;
  eventType: string;
  actorId: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  requestId: string | null;
  createdAt: string;
}

export interface BadCaseCriterion {
  criterionId: string;
  name: string;
  version: string;
  scope?: string;
  result: CriterionResult;
  actual?: unknown;
  expected?: unknown;
  evidenceRefs?: unknown[];
  regressionNote?: string | null;
}

export interface BadCaseReviewPackDetail extends BadCaseReviewPackListItem {
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
    | { status: 'available'; events: Array<Record<string, unknown>> }
    | { status: 'unavailable' | 'legacy_unavailable'; events: [] };
  criteria: BadCaseCriterion[];
  artifacts: {
    status: 'available' | 'legacy_unavailable' | 'partial';
    contentHashes?: Partial<Record<ProposalArtifactType, string>>;
    prompt?: unknown;
    rules?: unknown;
    knowledge?: unknown;
    modelPolicy?: unknown;
  };
  findings: BadCaseFinding[];
  auditEvents: BadCaseReviewAuditEvent[];
}

export interface BadCaseAnalysisResponse {
  id: string;
  analysisStatus: 'not_requested' | 'pending' | 'completed' | 'analysis_unavailable';
  idempotent?: boolean;
  findingCount?: number;
  criteriaVersion?: string;
  analysisVersion?: string;
  provider?: string;
  model?: string;
  suggestionCount?: number;
  failureClass?: string;
}

export interface ListReviewPacksQuery {
  status?: string;
  ownerTeam?: string;
  triggerKind?: string;
  limit?: number;
  offset?: number;
}

export interface AssignReviewPackBody {
  ownerTeam: string;
  assigneeId?: string | null;
  reason?: string;
}

export interface UpdateReviewPackStatusBody {
  status: ReviewPackStatus;
  reason?: string;
}

export interface ReviewFindingBody {
  disposition: FindingDisposition | string;
  reviewerComment?: string | null;
}

export interface FindingProposalBody {
  artifactType: ProposalArtifactType;
  before: {
    contentHash: string;
    snapshot: { artifactType: ProposalArtifactType; manifest: unknown };
    generationJobId?: string | null;
  };
  afterPatch: {
    ops: Array<
      | { op: 'replace' | 'add'; path: string; value: string | number | boolean | null | Array<string | number | boolean | null> }
      | { op: 'remove'; path: string }
    >;
  };
  rationale?: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`invalid review pack response: missing ${field}`);
  }
  return value;
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return null;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function parseArtifactContentHashes(value: unknown): Partial<Record<ProposalArtifactType, string>> | undefined {
  if (!isRecord(value)) return undefined;
  const result: Partial<Record<ProposalArtifactType, string>> = {};
  for (const key of ['prompt', 'rules', 'knowledge', 'model_policy'] as const) {
    const hash = value[key];
    if (typeof hash === 'string' && /^[a-f0-9]{64}$/i.test(hash)) result[key] = hash;
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return headers;
}

function mapHttpError(status: number, fallback: string): Error {
  if (status === 403) return new Error('FORBIDDEN');
  if (status === 404) return new Error('NOT_FOUND');
  if (status === 409) return new Error('CONFLICT');
  if (status === 429) return new Error('RATE_LIMITED');
  if (status === 400) return new Error('BAD_REQUEST');
  return new Error(fallback);
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const headers = await authHeaders();
  return fetch(apiUrl(path), {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });
}

function parseSubjectOwner(raw: unknown): SubjectOwner {
  if (!isRecord(raw)) {
    throw new Error('invalid review pack response: missing subjectOwner');
  }
  return {
    ownerId: asString(raw.ownerId, 'subjectOwner.ownerId'),
    displayName: asNullableString(raw.displayName),
    reviewGroup: asNullableString(raw.reviewGroup),
  };
}

function parseListItem(raw: unknown): BadCaseReviewPackListItem {
  if (!isRecord(raw)) {
    throw new Error('invalid review pack response: item is not an object');
  }
  return {
    id: asString(raw.id, 'id'),
    generationJobId: asString(raw.generationJobId, 'generationJobId'),
    status: parseReviewPackStatus(raw.status),
    triggerKind: typeof raw.triggerKind === 'string' ? raw.triggerKind : 'unknown',
    ownerTeam: typeof raw.ownerTeam === 'string' ? raw.ownerTeam : 'unassigned',
    assigneeId: asNullableString(raw.assigneeId),
    subjectOwner: parseSubjectOwner(raw.subjectOwner),
    score: asNullableNumber(raw.score),
    severity: asNullableString(raw.severity),
    analysisStatus: typeof raw.analysisStatus === 'string' ? raw.analysisStatus : 'pending',
    summary: asNullableString(raw.summary),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    resolvedAt: asNullableString(raw.resolvedAt),
    findingCount: asNullableNumber(raw.findingCount) ?? undefined,
    criticalFailCount: asNullableNumber(raw.criticalFailCount) ?? undefined,
  };
}

function parseTrace(raw: unknown): BadCaseReviewPackDetail['trace'] {
  if (!isRecord(raw)) {
    return { status: 'unavailable', events: [] };
  }
  const status = raw.status;
  const events = Array.isArray(raw.events) ? raw.events.filter(isRecord) : [];
  if (status === 'available') {
    return { status: 'available', events };
  }
  if (status === 'legacy_unavailable') {
    return { status: 'legacy_unavailable', events: [] };
  }
  // Missing or unknown status must not look like a successful empty timeline.
  return { status: 'unavailable', events: [] };
}

function parseCriterionResult(value: unknown): CriterionResult {
  if (value === 'pass' || value === 'fail' || value === 'not_evaluated') return value;
  return 'not_evaluated';
}

function parseDisposition(value: unknown): FindingDisposition | null {
  if (
    value === 'confirmed'
    || value === 'false_positive'
    || value === 'accepted_risk'
    || value === 'needs_data'
    || value === 'resolved'
  ) {
    return value;
  }
  return null;
}

function parseReviewPackStatus(value: unknown): ReviewPackStatus {
  if (
    value === 'open'
    || value === 'triaging'
    || value === 'in_progress'
    || value === 'resolved'
    || value === 'wont_fix'
    || value === 'duplicate'
  ) {
    return value;
  }
  throw new Error('invalid review pack response: status');
}

function parseFinding(raw: unknown): BadCaseFinding {
  if (!isRecord(raw)) {
    throw new Error('invalid review pack response: finding is not an object');
  }
  return {
    id: asString(raw.id, 'finding.id'),
    category: typeof raw.category === 'string' ? raw.category : 'unknown',
    severity: typeof raw.severity === 'string' ? raw.severity : 'unknown',
    confidence: asNullableNumber(raw.confidence),
    stage: asNullableString(raw.stage),
    variantKey: asNullableString(raw.variantKey),
    description: typeof raw.description === 'string' ? raw.description : '',
    evidenceRefs: Array.isArray(raw.evidenceRefs) ? raw.evidenceRefs : [],
    criterionRefs: Array.isArray(raw.criterionRefs) ? raw.criterionRefs : [],
    artifactRefs: Array.isArray(raw.artifactRefs) ? raw.artifactRefs : [],
    suggestion: raw.suggestion ?? null,
    recommendedOwnerTeam: asNullableString(raw.recommendedOwnerTeam),
    disposition: parseDisposition(raw.disposition),
    reviewerComment: asNullableString(raw.reviewerComment),
    reviewedBy: asNullableString(raw.reviewedBy),
    reviewedAt: asNullableString(raw.reviewedAt),
  };
}

function parseDetail(raw: unknown): BadCaseReviewPackDetail {
  const base = parseListItem(raw);
  if (!isRecord(raw)) {
    throw new Error('invalid review pack response: detail is not an object');
  }
  const sampleRaw = isRecord(raw.sample) ? raw.sample : {};
  const artifactsRaw = isRecord(raw.artifacts) ? raw.artifacts : { status: 'legacy_unavailable' };
  const artifactStatus =
    artifactsRaw.status === 'available' || artifactsRaw.status === 'partial' || artifactsRaw.status === 'legacy_unavailable'
      ? artifactsRaw.status
      : 'legacy_unavailable';

  const criteria = Array.isArray(raw.criteria)
    ? raw.criteria.filter(isRecord).map((item) => ({
      criterionId: typeof item.criterionId === 'string' ? item.criterionId : 'unknown',
      name: typeof item.name === 'string' ? item.name : '未命名标准',
      version: typeof item.version === 'string' ? item.version : '0',
      scope: typeof item.scope === 'string' ? item.scope : undefined,
      result: parseCriterionResult(item.result),
      actual: item.actual,
      expected: item.expected,
      evidenceRefs: Array.isArray(item.evidenceRefs) ? item.evidenceRefs : undefined,
      regressionNote: asNullableString(item.regressionNote),
    }))
    : [];

  const findings = Array.isArray(raw.findings)
    ? raw.findings.map(parseFinding)
    : [];

  const auditEvents = Array.isArray(raw.auditEvents)
    ? raw.auditEvents.filter(isRecord).map((item, index) => ({
      id: typeof item.id === 'string' ? item.id : `audit-${index}`,
      eventType: typeof item.eventType === 'string' ? item.eventType : 'unknown',
      actorId: asNullableString(item.actorId),
      before: item.before ?? null,
      after: item.after ?? null,
      reason: asNullableString(item.reason),
      requestId: asNullableString(item.requestId),
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
    }))
    : [];

  return {
    ...base,
    sample: {
      source: typeof sampleRaw.source === 'string' ? sampleRaw.source : '',
      brandName: asNullableString(sampleRaw.brandName),
      productName: asNullableString(sampleRaw.productName),
      brief: sampleRaw.brief,
      sellingPoints: sampleRaw.sellingPoints,
      brandRedlines: sampleRaw.brandRedlines,
      settingsSnapshot: sampleRaw.settingsSnapshot,
      variants: isRecord(sampleRaw.variants) ? sampleRaw.variants : (sampleRaw.variants as Record<string, unknown> | null) ?? null,
      diagnosis: sampleRaw.diagnosis,
      audit: sampleRaw.audit,
      scores: sampleRaw.scores,
      consumerFeedback: sampleRaw.consumerFeedback,
      errorMessage: asNullableString(sampleRaw.errorMessage),
      errorCode: asNullableString(sampleRaw.errorCode),
    },
    trace: parseTrace(raw.trace),
    criteria,
    artifacts: {
      status: artifactStatus,
      contentHashes: parseArtifactContentHashes(artifactsRaw.contentHashes),
      prompt: artifactsRaw.prompt,
      rules: artifactsRaw.rules,
      knowledge: artifactsRaw.knowledge,
      modelPolicy: artifactsRaw.modelPolicy,
    },
    findings,
    auditEvents,
  };
}

function buildListQuery(query: ListReviewPacksQuery = {}): string {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.ownerTeam) params.set('ownerTeam', query.ownerTeam);
  if (query.triggerKind) params.set('triggerKind', query.triggerKind);
  if (typeof query.limit === 'number') params.set('limit', String(query.limit));
  if (typeof query.offset === 'number') params.set('offset', String(query.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listBadCaseReviewPacks(
  query: ListReviewPacksQuery = {},
): Promise<BadCaseReviewPackListResponse> {
  const response = await request(`/admin/bad-case-review-packs${buildListQuery(query)}`);
  if (!response.ok) throw mapHttpError(response.status, 'Failed to load review packs');
  const raw: unknown = await response.json();
  if (!isRecord(raw) || !Array.isArray(raw.items)) {
    throw new Error('invalid review pack response: list shape');
  }
  return {
    items: raw.items.map(parseListItem),
    total: typeof raw.total === 'number' ? raw.total : raw.items.length,
  };
}

export async function getBadCaseReviewPack(id: string): Promise<BadCaseReviewPackDetail> {
  const response = await request(`/admin/bad-case-review-packs/${encodeURIComponent(id)}`);
  if (!response.ok) throw mapHttpError(response.status, 'Failed to load review pack detail');
  const raw: unknown = await response.json();
  return parseDetail(raw);
}

export async function assignBadCaseReviewPack(
  id: string,
  body: AssignReviewPackBody,
): Promise<unknown> {
  const response = await request(`/admin/bad-case-review-packs/${encodeURIComponent(id)}/assign`, {
    method: 'POST',
    body: JSON.stringify({
      ownerTeam: body.ownerTeam,
      assigneeId: body.assigneeId ?? null,
      reason: body.reason,
    }),
  });
  if (!response.ok) throw mapHttpError(response.status, 'Failed to assign review pack');
  return response.json().catch(() => ({ ok: true }));
}

export async function updateBadCaseReviewPackStatus(
  id: string,
  body: UpdateReviewPackStatusBody,
): Promise<unknown> {
  const response = await request(`/admin/bad-case-review-packs/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    body: JSON.stringify({
      status: body.status,
      reason: body.reason,
    }),
  });
  if (!response.ok) throw mapHttpError(response.status, 'Failed to update review pack status');
  return response.json().catch(() => ({ ok: true }));
}

export async function reviewBadCaseFinding(
  findingId: string,
  body: ReviewFindingBody,
): Promise<unknown> {
  const response = await request(`/admin/bad-case-findings/${encodeURIComponent(findingId)}/review`, {
    method: 'POST',
    body: JSON.stringify({
      disposition: body.disposition,
      reviewerComment: body.reviewerComment ?? null,
    }),
  });
  if (!response.ok) throw mapHttpError(response.status, 'Failed to review finding');
  return response.json().catch(() => ({ ok: true }));
}

export async function requestBadCaseAnalysis(id: string): Promise<BadCaseAnalysisResponse> {
  const response = await request(`/admin/bad-case-review-packs/${encodeURIComponent(id)}/analyze`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!response.ok) throw mapHttpError(response.status, 'Failed to request analysis');
  return response.json().catch(() => ({
    id,
    analysisStatus: 'pending' as const,
  }));
}

export async function requestBadCaseFindingProposal(
  findingId: string,
  body: FindingProposalBody,
): Promise<unknown> {
  const response = await request(`/admin/bad-case-findings/${encodeURIComponent(findingId)}/proposal`, {
    method: 'POST',
    body: JSON.stringify({
      artifactType: body.artifactType,
      before: body.before,
      afterPatch: body.afterPatch,
      rationale: body.rationale ?? null,
    }),
  });
  if (!response.ok) throw mapHttpError(response.status, 'Failed to create proposal');
  return response.json().catch(() => ({ ok: true }));
}

/** Map API error codes to user-facing Chinese copy. Never pass through raw server bodies. */
export function userFacingReviewPackError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  switch (code) {
    case 'FORBIDDEN':
      return '无超级管理员权限';
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

export function userFacingMutationError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  switch (code) {
    case 'FORBIDDEN':
      return '无超级管理员权限';
    case 'NOT_FOUND':
      return '资源不存在或不可用';
    case 'CONFLICT':
      return '状态冲突，请刷新后重试';
    case 'RATE_LIMITED':
      return '操作过于频繁，请稍后再试';
    case 'BAD_REQUEST':
      return '输入无效，请检查后重试';
    default:
      return '保存失败，请重试';
  }
}
