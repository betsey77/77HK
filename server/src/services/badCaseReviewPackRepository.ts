/**
 * 2.1 Slice E2 — Review pack repository boundary.
 *
 * Accepts only allowlisted DTOs. Does not trust request-body actor/owner.
 * Never persists prompts, provider payloads, raw errors, CoT, email, JWT, keys.
 * In-memory store is for pure unit tests; production wiring uses service_role later (E3).
 */

import type { GenerationArtifactManifest } from '../types/index.js';
import type {
  ArtifactRef,
  FindingDraft,
  OwnerTeam,
  TriggerKind,
} from './badCaseReviewPackAssembler.js';
import type { EvidenceRef } from './badCaseCriteria.js';

/** Always forbidden in any persisted JSON (secrets / CoT / credentials). */
const FORBIDDEN_SECRET_KEYS = new Set([
  'rawprompt',
  'raw_prompt',
  'rawresponse',
  'raw_response',
  'providerpayload',
  'provider_payload',
  'thinking',
  'chainofthought',
  'chain_of_thought',
  'email',
  'jwt',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'password',
  'secret',
]);

/**
 * Extra keys banned in freeform event payloads.
 * Not applied to E1 manifests, which legitimately have a `prompt` section object.
 */
const FORBIDDEN_FREEFORM_CONTENT_KEYS = new Set([
  'prompt',
  'messages',
  'source',
  'body',
  'content',
  'raw_error',
  'rawerror',
]);

export type PackStatus =
  | 'open'
  | 'triaging'
  | 'in_progress'
  | 'resolved'
  | 'wont_fix'
  | 'duplicate';

export type AnalysisStatus =
  | 'not_requested'
  | 'pending'
  | 'completed'
  | 'analysis_unavailable';

export interface PackUpsertDto {
  generationJobId: string;
  subjectOwnerId: string;
  /** All matched triggers; primary kind is persisted in trigger_kind column. */
  triggerKinds: TriggerKind[];
  status?: PackStatus;
  ownerTeam?: OwnerTeam;
  assigneeId?: string | null;
  criteriaVersion: string;
  analysisStatus?: AnalysisStatus;
  summary?: string | null;
}

export interface SnapshotUpsertDto {
  generationJobId: string;
  ownerId: string;
  manifest: GenerationArtifactManifest;
}

export interface FindingInsertDto {
  category: FindingDraft['category'];
  severity: FindingDraft['severity'];
  confidence: number;
  stage: string | null;
  variantKey: string | null;
  description: string;
  evidenceRefs: EvidenceRef[];
  criterionRefs: string[];
  artifactRefs: ArtifactRef[];
  recommendedOwnerTeam: OwnerTeam;
  suggestion?: unknown | null;
}

export interface EventInsertDto {
  reviewPackId: string;
  findingId?: string | null;
  eventType:
    | 'pack_created'
    | 'pack_assigned'
    | 'pack_status_changed'
    | 'analysis_requested'
    | 'analysis_completed'
    | 'analysis_failed'
    | 'finding_created'
    | 'finding_reviewed'
    | 'proposal_created'
    | 'note_added';
  actorId?: string | null;
  actorRole?: 'user' | 'admin' | 'super_admin' | 'system' | null;
  fromValue?: Record<string, unknown> | null;
  toValue?: Record<string, unknown> | null;
  reason?: string | null;
  requestId?: string | null;
  payload?: Record<string, unknown>;
}

export interface PackRow {
  id: string;
  generation_job_id: string;
  subject_owner_id: string;
  trigger_kind: TriggerKind;
  status: PackStatus;
  owner_team: OwnerTeam;
  assignee_id: string | null;
  criteria_version: string;
  analysis_status: AnalysisStatus;
  summary: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface SnapshotRow {
  generation_job_id: string;
  owner_id: string;
  prompt_manifest: unknown;
  rule_manifest: unknown;
  knowledge_manifest: unknown;
  model_policy_manifest: unknown;
  schema_version: number;
  content_hash: string;
  availability: string;
}

export interface FindingRow {
  id: string;
  review_pack_id: string;
  category: string;
  severity: string;
  confidence: number;
  stage: string | null;
  variant_key: string | null;
  description: string;
  evidence_refs: EvidenceRef[];
  criterion_refs: string[];
  artifact_refs: ArtifactRef[];
  suggestion: unknown | null;
  recommended_owner_team: string;
}

export interface EventRow {
  id: string;
  review_pack_id: string;
  finding_id: string | null;
  event_type: string;
  actor_id: string | null;
  actor_role: string | null;
  from_value: Record<string, unknown> | null;
  to_value: Record<string, unknown> | null;
  reason: string | null;
  request_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

function assertUuidLike(value: string, field: string): void {
  if (typeof value !== 'string' || value.trim().length < 4) {
    throw new Error(`invalid ${field}`);
  }
}

function primaryTriggerKind(kinds: TriggerKind[]): TriggerKind {
  const order: TriggerKind[] = [
    'generation_failed',
    'score_below_threshold',
    'criteria_failed',
    'manual',
  ];
  for (const kind of order) {
    if (kinds.includes(kind)) return kind;
  }
  if (kinds.length === 0) throw new Error('triggerKinds required');
  return kinds[0]!;
}

function walkForbiddenKeys(
  value: unknown,
  options: { freeform?: boolean } = {},
  path: string[] = [],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkForbiddenKeys(item, options, [...path, String(i)]));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    const lower = key.toLowerCase();
    if (FORBIDDEN_SECRET_KEYS.has(normalized) || FORBIDDEN_SECRET_KEYS.has(lower)) {
      throw new Error(`forbidden payload key: ${[...path, key].join('.')}`);
    }
    if (
      options.freeform &&
      (FORBIDDEN_FREEFORM_CONTENT_KEYS.has(normalized) ||
        FORBIDDEN_FREEFORM_CONTENT_KEYS.has(lower))
    ) {
      throw new Error(`forbidden payload key: ${[...path, key].join('.')}`);
    }
    walkForbiddenKeys(nested, options, [...path, key]);
  }
}

/**
 * Request bodies must never supply actor/owner authority.
 * Call this at API boundaries before building trusted DTOs (E3).
 */
export function rejectUntrustedActorFields(body: Record<string, unknown>): void {
  const untrusted = ['actorId', 'actor_id', 'actorRole', 'actor_role', 'ownerId', 'owner_id', 'role'];
  for (const key of untrusted) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      throw new Error(`untrusted field rejected: ${key}`);
    }
  }
}

export function preparePackUpsert(dto: PackUpsertDto): Omit<PackRow, 'id' | 'created_at' | 'updated_at' | 'resolved_at'> {
  assertUuidLike(dto.generationJobId, 'generationJobId');
  assertUuidLike(dto.subjectOwnerId, 'subjectOwnerId');
  if (!Array.isArray(dto.triggerKinds) || dto.triggerKinds.length === 0) {
    throw new Error('triggerKinds required');
  }

  return {
    generation_job_id: dto.generationJobId,
    subject_owner_id: dto.subjectOwnerId,
    trigger_kind: primaryTriggerKind(dto.triggerKinds),
    status: dto.status ?? 'open',
    owner_team: dto.ownerTeam ?? 'unassigned',
    assignee_id: dto.assigneeId ?? null,
    criteria_version: dto.criteriaVersion,
    analysis_status: dto.analysisStatus ?? 'not_requested',
    summary: dto.summary ?? null,
  };
}

export function prepareSnapshotUpsert(dto: SnapshotUpsertDto): SnapshotRow {
  assertUuidLike(dto.generationJobId, 'generationJobId');
  assertUuidLike(dto.ownerId, 'ownerId');
  const { manifest } = dto;
  walkForbiddenKeys(manifest);

  return {
    generation_job_id: dto.generationJobId,
    owner_id: dto.ownerId,
    prompt_manifest: manifest.prompt,
    rule_manifest: manifest.rules,
    knowledge_manifest: manifest.knowledge,
    model_policy_manifest: manifest.modelPolicy,
    schema_version: manifest.schemaVersion,
    content_hash: manifest.contentHash,
    availability: manifest.availability,
  };
}

export function prepareFindingsInsert(
  reviewPackId: string,
  findings: FindingInsertDto[],
): Array<Omit<FindingRow, 'id'>> {
  assertUuidLike(reviewPackId, 'reviewPackId');
  return findings.map((finding, index) => {
    if (!Array.isArray(finding.evidenceRefs) || finding.evidenceRefs.length === 0) {
      throw new Error(`finding[${index}] requires evidence refs`);
    }
    if (!Array.isArray(finding.criterionRefs) || finding.criterionRefs.length === 0) {
      throw new Error(`finding[${index}] requires criterion refs`);
    }
    if (!Array.isArray(finding.artifactRefs) || finding.artifactRefs.length === 0) {
      throw new Error(`finding[${index}] requires artifact refs`);
    }
    if (typeof finding.confidence !== 'number' || finding.confidence < 0 || finding.confidence > 1) {
      throw new Error(`finding[${index}] invalid confidence`);
    }
    walkForbiddenKeys(finding.evidenceRefs);
    walkForbiddenKeys(finding.artifactRefs);
    if (finding.suggestion != null) walkForbiddenKeys(finding.suggestion);

    return {
      review_pack_id: reviewPackId,
      category: finding.category,
      severity: finding.severity,
      confidence: finding.confidence,
      stage: finding.stage,
      variant_key: finding.variantKey,
      description: finding.description.slice(0, 4000),
      evidence_refs: finding.evidenceRefs,
      criterion_refs: finding.criterionRefs,
      artifact_refs: finding.artifactRefs,
      suggestion: finding.suggestion ?? null,
      recommended_owner_team: finding.recommendedOwnerTeam,
    };
  });
}

export function prepareEventInsert(dto: EventInsertDto): Omit<EventRow, 'id' | 'created_at'> {
  assertUuidLike(dto.reviewPackId, 'reviewPackId');
  const payload = dto.payload ?? {};
  walkForbiddenKeys(payload, { freeform: true });
  if (dto.fromValue) walkForbiddenKeys(dto.fromValue, { freeform: true });
  if (dto.toValue) walkForbiddenKeys(dto.toValue, { freeform: true });

  return {
    review_pack_id: dto.reviewPackId,
    finding_id: dto.findingId ?? null,
    event_type: dto.eventType,
    actor_id: dto.actorId ?? null,
    actor_role: dto.actorRole ?? null,
    from_value: dto.fromValue ?? null,
    to_value: dto.toValue ?? null,
    reason: dto.reason ?? null,
    request_id: dto.requestId ?? null,
    payload,
  };
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Pure in-memory repository for unit tests and local dry-runs. */
export class InMemoryBadCaseReviewPackRepository {
  private packs = new Map<string, PackRow>();
  private packsByJob = new Map<string, string>();
  private findings = new Map<string, FindingRow[]>();
  private events = new Map<string, EventRow[]>();
  private snapshots = new Map<string, SnapshotRow>();

  async upsertPack(dto: PackUpsertDto): Promise<{ id: string }> {
    const prepared = preparePackUpsert(dto);
    const existingId = this.packsByJob.get(prepared.generation_job_id);
    const now = new Date().toISOString();

    if (existingId) {
      const prev = this.packs.get(existingId)!;
      const next: PackRow = {
        ...prev,
        ...prepared,
        id: existingId,
        created_at: prev.created_at,
        updated_at: now,
        resolved_at: prev.resolved_at,
      };
      this.packs.set(existingId, next);
      return { id: existingId };
    }

    const id = newId();
    const row: PackRow = {
      id,
      ...prepared,
      created_at: now,
      updated_at: now,
      resolved_at: null,
    };
    this.packs.set(id, row);
    this.packsByJob.set(prepared.generation_job_id, id);
    this.findings.set(id, []);
    this.events.set(id, []);
    return { id };
  }

  async upsertSnapshot(dto: SnapshotUpsertDto): Promise<void> {
    const row = prepareSnapshotUpsert(dto);
    this.snapshots.set(row.generation_job_id, row);
  }

  async replaceFindings(reviewPackId: string, findings: FindingInsertDto[]): Promise<void> {
    if (!this.packs.has(reviewPackId)) throw new Error('pack not found');
    const rows = prepareFindingsInsert(reviewPackId, findings).map((row) => ({
      id: newId(),
      ...row,
    }));
    this.findings.set(reviewPackId, rows);
  }

  async appendEvent(dto: EventInsertDto): Promise<{ id: string }> {
    if (!this.packs.has(dto.reviewPackId)) throw new Error('pack not found');
    const prepared = prepareEventInsert(dto);
    const id = newId();
    const row: EventRow = {
      id,
      ...prepared,
      created_at: new Date().toISOString(),
    };
    const list = this.events.get(dto.reviewPackId) ?? [];
    list.push(row);
    this.events.set(dto.reviewPackId, list);
    return { id };
  }

  listPacks(): PackRow[] {
    return [...this.packs.values()];
  }

  listFindings(packId: string): FindingRow[] {
    return [...(this.findings.get(packId) ?? [])];
  }

  listEvents(packId: string): EventRow[] {
    return [...(this.events.get(packId) ?? [])];
  }

  getSnapshot(jobId: string): SnapshotRow | undefined {
    return this.snapshots.get(jobId);
  }
}
