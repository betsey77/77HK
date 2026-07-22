/**
 * 2.1 Slice E2/E4 — Deterministic review pack assembler.
 *
 * Builds allowlisted upsert input from job snapshots + E1 manifests.
 * No DB I/O. Does not trust request-body actor/owner fields.
 */

import type { GenerationArtifactManifest } from '../types/index.js';
import {
  BAD_CASE_SCORE_THRESHOLD,
  CRITERIA_VERSION,
  evaluateBadCaseCriteria,
  hasCriticalCriteriaFailure,
  readGeneratedTotal,
  type CriteriaJobSnapshot,
  type CriterionEvaluation,
  type EvidenceRef,
} from './badCaseCriteria.js';

export type TriggerKind =
  | 'score_below_threshold'
  | 'generation_failed'
  | 'criteria_failed'
  | 'manual';

export type OwnerTeam =
  | 'content_prompt'
  | 'knowledge_rules'
  | 'model_provider'
  | 'backend_platform'
  | 'frontend_experience'
  | 'unassigned';

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

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type ArtifactRef =
  | {
      type: 'manifest';
      contentHash: string;
      schemaVersion: number;
      availability: 'captured' | 'legacy_unavailable';
    }
  | { type: 'prompt_template'; templateId: string; version: string }
  | { type: 'ruleset'; rulesetId: string; version: string }
  | { type: 'model_policy'; policyVersion: string };

export interface ModelAttemptItem {
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

export type ModelAttemptsSnapshot =
  | { status: 'available'; items: ModelAttemptItem[] }
  | { status: 'unavailable'; items: [] };

export interface ManualFlagInput {
  actorId: string;
  actorRole: 'super_admin';
  reason?: string | null;
}

export interface AssembleReviewPackInput {
  job: CriteriaJobSnapshot & {
    errorMessage?: string | null;
    generationEngine?: string | null;
  };
  artifactManifest: GenerationArtifactManifest;
  modelAttempts?: ModelAttemptsSnapshot;
  manualFlag?: ManualFlagInput | null;
}

export interface FindingDraft {
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: number;
  stage: string | null;
  variantKey: string | null;
  description: string;
  evidenceRefs: EvidenceRef[];
  criterionRefs: string[];
  artifactRefs: ArtifactRef[];
  recommendedOwnerTeam: OwnerTeam;
  suggestion: null;
}

export interface ReviewPackUpsertDraft {
  generationJobId: string;
  subjectOwnerId: string;
  triggerKinds: TriggerKind[];
  status: 'open';
  ownerTeam: OwnerTeam;
  assigneeId: null;
  criteriaVersion: string;
  analysisStatus: 'not_requested';
  summary: string;
}

export interface ReviewEventDraft {
  eventType: 'pack_created';
  actorId: string | null;
  actorRole: 'system' | 'super_admin';
  fromValue: null;
  toValue: Record<string, unknown>;
  reason: string | null;
  requestId: null;
  payload: Record<string, unknown>;
}

export interface AssembleReviewPackResult {
  pack: ReviewPackUpsertDraft;
  findings: FindingDraft[];
  criteria: CriterionEvaluation[];
  event: ReviewEventDraft;
  snapshot: {
    generationJobId: string;
    ownerId: string;
    manifest: GenerationArtifactManifest;
  };
}

function isTerminal(status: string): boolean {
  return status === 'completed' || status === 'failed';
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
  return kinds[0] ?? 'manual';
}

function manifestArtifactRefs(manifest: GenerationArtifactManifest): ArtifactRef[] {
  const refs: ArtifactRef[] = [
    {
      type: 'manifest',
      contentHash: manifest.contentHash,
      schemaVersion: manifest.schemaVersion,
      availability: manifest.availability,
    },
  ];

  if (manifest.prompt.availability === 'captured') {
    for (const template of manifest.prompt.templates) {
      refs.push({
        type: 'prompt_template',
        templateId: template.templateId,
        version: template.version,
      });
    }
  }
  if (manifest.rules.availability === 'captured') {
    refs.push({
      type: 'ruleset',
      rulesetId: manifest.rules.rulesetId,
      version: manifest.rules.version,
    });
  }
  if (manifest.modelPolicy.availability === 'captured') {
    refs.push({
      type: 'model_policy',
      policyVersion: manifest.modelPolicy.policyVersion,
    });
  }
  return refs;
}

function ownerTeamForCriterion(criterionId: string): OwnerTeam {
  if (criterionId.startsWith('compliance.')) return 'knowledge_rules';
  if (criterionId.startsWith('runtime.')) return 'model_provider';
  if (criterionId.startsWith('output.')) return 'backend_platform';
  if (criterionId.startsWith('score.') || criterionId.startsWith('content.')) {
    return 'content_prompt';
  }
  return 'unassigned';
}

function categoryForCriterion(criterionId: string): FindingCategory {
  if (criterionId.startsWith('compliance.')) return 'compliance';
  if (criterionId === 'runtime.generation_success') return 'model_transport';
  if (criterionId === 'output.variants_complete') return 'model_output_schema';
  if (criterionId.startsWith('score.') || criterionId.startsWith('content.')) {
    return 'content_quality';
  }
  return 'evaluation_gap';
}

function stageForCriterion(criterionId: string): string | null {
  if (criterionId.startsWith('compliance.')) return 'audit';
  if (criterionId === 'runtime.generation_success') return 'diagnose_generate';
  if (criterionId === 'output.variants_complete') return 'persisted';
  if (criterionId.startsWith('score.')) return 'audit';
  return 'unknown';
}

function severityFor(evaluation: CriterionEvaluation): FindingSeverity {
  if (evaluation.critical) return 'high';
  return 'medium';
}

function describeFailure(evaluation: CriterionEvaluation): string {
  switch (evaluation.criterionId) {
    case 'score.total_threshold':
      return `港味总分 ${String(evaluation.actual)} 低于阈值 ${BAD_CASE_SCORE_THRESHOLD}`;
    case 'runtime.generation_success':
      return `生成未成功，状态为 ${String(evaluation.actual)}`;
    case 'compliance.redlines_and_risks':
      return '红线/合规检查未通过';
    case 'output.variants_complete':
      return '五平台输出不完整';
    default:
      return `验收标准 ${evaluation.criterionId} 失败`;
  }
}

function buildFindingsFromCriteria(
  evaluations: CriterionEvaluation[],
  manifest: GenerationArtifactManifest,
  modelAttempts?: ModelAttemptsSnapshot,
): FindingDraft[] {
  const artifactRefs = manifestArtifactRefs(manifest);
  const findings: FindingDraft[] = [];

  for (const evaluation of evaluations) {
    if (evaluation.status !== 'fail') continue;
    if (evaluation.evidenceRefs.length === 0) continue;

    const evidenceRefs = [...evaluation.evidenceRefs];

    // Attach a single allowlisted model attempt when runtime failed and attempts exist.
    if (
      evaluation.criterionId === 'runtime.generation_success' &&
      modelAttempts?.status === 'available'
    ) {
      const errorAttempt = modelAttempts.items.find((item) => item.status === 'error');
      if (errorAttempt) {
        evidenceRefs.push({
          type: 'model_attempt',
          operation: errorAttempt.operation,
          provider: errorAttempt.provider,
          model: errorAttempt.model,
          status: 'error',
          errorClass: errorAttempt.errorClass,
          attempt: errorAttempt.attempt,
          createdAt: errorAttempt.createdAt,
        });
      }
    }

    findings.push({
      category: categoryForCriterion(evaluation.criterionId),
      severity: severityFor(evaluation),
      confidence: 1,
      stage: stageForCriterion(evaluation.criterionId),
      variantKey: null,
      description: describeFailure(evaluation),
      evidenceRefs,
      criterionRefs: [`${evaluation.criterionId}@${evaluation.version}`],
      artifactRefs,
      recommendedOwnerTeam: ownerTeamForCriterion(evaluation.criterionId),
      suggestion: null,
    });
  }

  return findings;
}

function buildSummary(kinds: TriggerKind[], evaluations: CriterionEvaluation[]): string {
  const failed = evaluations.filter((e) => e.status === 'fail').map((e) => e.criterionId);
  const parts = [`triggers=${kinds.join(',')}`];
  if (failed.length > 0) parts.push(`failed=${failed.join(',')}`);
  return parts.join('; ').slice(0, 4000);
}

function recommendPackOwnerTeam(findings: FindingDraft[], kinds: TriggerKind[]): OwnerTeam {
  if (findings.length > 0) return findings[0]!.recommendedOwnerTeam;
  if (kinds.includes('generation_failed')) return 'model_provider';
  if (kinds.includes('score_below_threshold')) return 'content_prompt';
  if (kinds.includes('criteria_failed')) return 'knowledge_rules';
  return 'unassigned';
}

/**
 * Decide trigger kinds for a job. Soft-deleted and non-terminal jobs never trigger
 * (including manual flags — only sealed jobs).
 */
export function resolveTriggerKinds(input: AssembleReviewPackInput): TriggerKind[] {
  const { job, manualFlag } = input;
  if (job.deletedAt) return [];
  if (!isTerminal(job.status)) return [];

  const kinds: TriggerKind[] = [];
  if (job.status === 'failed') kinds.push('generation_failed');

  const total = readGeneratedTotal(job.scores ?? null);
  if (total !== null && total < BAD_CASE_SCORE_THRESHOLD) {
    kinds.push('score_below_threshold');
  }

  const evaluations = evaluateBadCaseCriteria(job);
  if (hasCriticalCriteriaFailure(evaluations)) {
    // Avoid pure duplicates when only generation_failed or score already implies criteria fail.
    // Still record criteria_failed when there is a critical fail not solely represented above,
    // or when score/failed already set — product wants criteria_failed as an explicit trigger.
    kinds.push('criteria_failed');
  }

  if (manualFlag?.actorRole === 'super_admin' && manualFlag.actorId) {
    kinds.push('manual');
  }

  // De-dupe while preserving order
  return [...new Set(kinds)];
}

/**
 * Assemble allowlisted pack upsert input, or null when no pack should be created.
 */
export function assembleReviewPackUpsert(
  input: AssembleReviewPackInput,
): AssembleReviewPackResult | null {
  const kinds = resolveTriggerKinds(input);
  if (kinds.length === 0) return null;

  const criteria = evaluateBadCaseCriteria(input.job);
  const findings = buildFindingsFromCriteria(criteria, input.artifactManifest, input.modelAttempts);

  // Manual-only packs may have zero automatic findings; still create the pack shell.
  const pack: ReviewPackUpsertDraft = {
    generationJobId: input.job.id,
    subjectOwnerId: input.job.ownerId,
    triggerKinds: kinds,
    status: 'open',
    ownerTeam: recommendPackOwnerTeam(findings, kinds),
    assigneeId: null,
    criteriaVersion: CRITERIA_VERSION,
    analysisStatus: 'not_requested',
    summary: buildSummary(kinds, criteria),
  };

  const event: ReviewEventDraft = {
    eventType: 'pack_created',
    actorId: input.manualFlag?.actorId ?? null,
    actorRole: input.manualFlag?.actorRole === 'super_admin' ? 'super_admin' : 'system',
    fromValue: null,
    toValue: {
      status: 'open',
      primaryTrigger: primaryTriggerKind(kinds),
    },
    reason: input.manualFlag?.reason ?? null,
    requestId: null,
    payload: {
      triggerKinds: kinds,
      criteriaVersion: CRITERIA_VERSION,
      findingCount: findings.length,
    },
  };

  return {
    pack,
    findings,
    criteria,
    event,
    snapshot: {
      generationJobId: input.job.id,
      ownerId: input.job.ownerId,
      manifest: input.artifactManifest,
    },
  };
}

