/**
 * 2.1 Slice E1 — Generation artifact manifest contract.
 *
 * Pure in-memory builders for allowlisted Prompt / Rules / Knowledge / ModelPolicy
 * snapshots. No DB, no routes, no rendered prompts, no secrets, no CoT.
 */

import { createHash } from 'node:crypto';
import type {
  ArtifactLegacyReason,
  GeneratePromptVariant,
  GenerationArtifactManifest,
  KnowledgeItemRef,
  KnowledgeManifestCaptured,
  ModelPolicyManifestCaptured,
  PromptManifestCaptured,
  PromptTemplateManifestEntry,
  RuleManifestCaptured,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Version registry (bump when the bound source changes)
// ---------------------------------------------------------------------------

export const ARTIFACT_MANIFEST_SCHEMA_VERSION = 1 as const;

export const PROMPT_SYSTEM_VERSION = '1.0.0';
export const PROMPT_DIAGNOSE_GENERATE_VERSION = '1.0.0';
export const PROMPT_CANTONESE_LLM_VERSION = '1.0.0';
export const PROMPT_AUDIT_VERSION = '1.0.0';
export const RULE_W1_CONSTRAINTS_VERSION = '1.0.0';

export const COMPLIANCE_RULESET_ID = 'hk_social_compliance_builtin';
export const COMPLIANCE_RULESET_VERSION = '1.0.0';

/** Stable rule IDs aligned with BUILT_IN_RULES categories in complianceRules.ts. */
export const COMPLIANCE_RULE_IDS = [
  'exaggeration',
  'misleading_comparison',
  'false_urgency',
  'medical',
  'finance',
  'political',
  'profanity_discrimination',
  'copyright',
  'pricing',
  'privacy',
  'hk_local_regs',
] as const;

export const KNOWLEDGE_CALENDAR_DATASET_ID = 'hk_calendar';
export const KNOWLEDGE_CALENDAR_VERSION = '2026.2.0';
export const KNOWLEDGE_CASE_LIBRARY_PROMPT_VERSION = '1.0.0';

export const MODEL_POLICY_VERSION = '1.0.0';

export const DEFAULT_FALLBACK_CHAIN = [
  'self-hosted-cantonese',
  'deepseek',
  'rules',
] as const;

// ---------------------------------------------------------------------------
// Static section / param key inventories (whitelist metadata only)
// ---------------------------------------------------------------------------

const SYSTEM_SECTION_KEYS = [
  'core_identity',
  'absolute_rules',
  'brand_tone',
  'minefield_lexicon',
] as const;

const DIAGNOSE_SECTION_KEYS = [
  'task',
  'writing_framework',
  'compliance_redlines',
  'product_selling_points',
  'w1_copy_type',
  'w1_length',
  'w1_tone',
  'refresh',
  'case_library',
  'reference_cases',
  'calendar_events',
  'creativity',
  'diagnosis',
  'generation_params',
  'self_critique',
  'output_json_schema',
] as const;

const CANTONESE_SECTION_KEYS = [
  'task',
  'compliance_redlines',
  'product_selling_points',
  'w1_copy_type',
  'w1_length',
  'w1_tone',
  'refresh',
  'case_library',
  'reference_cases',
  'calendar_events',
  'generation_params',
  'output_json_schema',
] as const;

const AUDIT_SECTION_KEYS = [
  'compliance',
  'variants',
  'score_dimensions',
  'cta',
  'issues',
] as const;

const GENERATE_PARAM_KEYS = [
  'platform',
  'primaryTone',
  'toneModifiers',
  'cantoneseLevel',
  'englishMixingLevel',
  'creativityLevel',
  'inputLanguage',
  'copyType',
  'customCopyType',
  'lengthControlEnabled',
  'copyLengthLevel',
  'refresh',
  'hasBrandName',
  'hasProductName',
  'hasBrandRedLines',
  'productSellingPointCount',
  'selectedCaseLibraryIds',
  'referenceCaseIds',
  'calendarEventIds',
] as const;

// ---------------------------------------------------------------------------
// Capture input (no user body / secrets accepted into the hash payload)
// ---------------------------------------------------------------------------

export interface ArtifactResolvedParams {
  platform: string;
  primaryTone: string;
  toneModifiers: string[];
  cantoneseLevel: number;
  englishMixingLevel: number;
  creativityLevel: number;
  inputLanguage: string;
  copyType: string;
  customCopyType?: string;
  lengthControlEnabled: boolean;
  copyLengthLevel: number;
  refresh?: boolean;
  hasBrandName: boolean;
  hasProductName: boolean;
  hasBrandRedLines: boolean;
  productSellingPointCount: number;
  selectedCaseLibraryIds: string[];
  referenceCaseIds: string[];
  calendarEventIds: string[];
}

export interface ArtifactCaseLibraryInput {
  requestedIds: string[];
  resolvedIds: string[];
  partialUnavailable: boolean;
  resolvedMeta?: Array<{
    id: string;
    caseType?: 'good' | 'bad' | null;
    title?: string | null;
    versionOrUpdatedAt?: string | null;
  }>;
}

export interface ArtifactReferenceCaseInput {
  id: string;
  variantKey?: string;
  title?: string | null;
}

export interface ArtifactModelInput {
  requireRealModel: boolean;
  hasConfiguredRealModel: boolean;
  generationTimeoutMs: number;
  qualityScoreTimeoutMs: number;
  postProcessingTimeoutMs: number;
  allowQualityRetry: boolean;
  defaultModel: string;
  thinkingDisabled: boolean;
  temperature?: number | null;
  fallbackChain?: Array<'self-hosted-cantonese' | 'deepseek' | 'rules'>;
}

export interface ArtifactCaptureInput {
  generatePromptVariant: GeneratePromptVariant;
  resolvedParams: ArtifactResolvedParams;
  caseLibrary: ArtifactCaseLibraryInput;
  referenceCases?: ArtifactReferenceCaseInput[];
  calendarEventIds?: string[];
  model: ArtifactModelInput;
}

// ---------------------------------------------------------------------------
// Canonical JSON + SHA-256
// ---------------------------------------------------------------------------

/**
 * Stable JSON serialization:
 * - object keys sorted lexicographically at every level
 * - array order preserved
 * - undefined omitted; null kept
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError('canonicalJson does not allow NaN or Infinity');
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const entry = obj[key];
    if (entry === undefined) continue;
    sorted[key] = canonicalize(entry);
  }
  return sorted;
}

export function hashCanonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function buildPromptTemplates(
  variant: GeneratePromptVariant,
  paramKeys: string[],
): PromptTemplateManifestEntry[] {
  const system: PromptTemplateManifestEntry = {
    templateId: 'system_prompt',
    version: PROMPT_SYSTEM_VERSION,
    sectionKeys: [...SYSTEM_SECTION_KEYS],
    paramKeys: [],
  };

  const audit: PromptTemplateManifestEntry = {
    templateId: 'audit',
    version: PROMPT_AUDIT_VERSION,
    sectionKeys: [...AUDIT_SECTION_KEYS],
    paramKeys: ['hasBrandRedLines'],
  };

  let generate: PromptTemplateManifestEntry;
  if (variant === 'cantonese_llm') {
    generate = {
      templateId: 'cantonese_llm_generate',
      version: PROMPT_CANTONESE_LLM_VERSION,
      sectionKeys: [...CANTONESE_SECTION_KEYS],
      paramKeys,
    };
  } else if (variant === 'rules_fallback') {
    generate = {
      templateId: 'rules_fallback',
      version: PROMPT_DIAGNOSE_GENERATE_VERSION,
      sectionKeys: ['w1_copy_type', 'w1_length', 'w1_tone', 'case_library', 'compliance_redlines'],
      paramKeys,
    };
  } else {
    generate = {
      templateId: 'diagnose_generate',
      version: PROMPT_DIAGNOSE_GENERATE_VERSION,
      sectionKeys: [...DIAGNOSE_SECTION_KEYS],
      paramKeys,
    };
  }

  return [system, generate, audit];
}

function buildPromptManifest(input: ArtifactCaptureInput): PromptManifestCaptured {
  const paramKeys = GENERATE_PARAM_KEYS.filter((key) => {
    if (key === 'customCopyType') return Boolean(input.resolvedParams.customCopyType);
    return true;
  });

  return {
    availability: 'captured',
    generatePromptVariant: input.generatePromptVariant,
    templates: buildPromptTemplates(input.generatePromptVariant, [...paramKeys]),
  };
}

function buildRuleManifest(input: ArtifactCaptureInput): RuleManifestCaptured {
  return {
    availability: 'captured',
    rulesetId: COMPLIANCE_RULESET_ID,
    version: COMPLIANCE_RULESET_VERSION,
    ruleIds: [...COMPLIANCE_RULE_IDS],
    w1ConstraintsVersion: RULE_W1_CONSTRAINTS_VERSION,
    userRedLinesPresent: Boolean(input.resolvedParams.hasBrandRedLines),
  };
}

function buildKnowledgeManifest(input: ArtifactCaptureInput): KnowledgeManifestCaptured {
  const items: KnowledgeItemRef[] = [];
  const metaById = new Map(
    (input.caseLibrary.resolvedMeta ?? []).map((m) => [m.id.toLowerCase(), m]),
  );

  for (const id of input.caseLibrary.resolvedIds) {
    const meta = metaById.get(id.toLowerCase());
    items.push({
      entryId: id,
      sourceType: 'case_library',
      title: meta?.title ?? null,
      versionOrUpdatedAt: meta?.versionOrUpdatedAt ?? null,
      caseType: meta?.caseType ?? null,
    });
  }

  const referenceCases = input.referenceCases ?? [];
  for (const ref of referenceCases) {
    items.push({
      entryId: ref.id,
      sourceType: 'reference_bookmark',
      title: ref.title ?? null,
      versionOrUpdatedAt: null,
      caseType: null,
    });
  }

  const calendarEventIds = input.calendarEventIds ?? input.resolvedParams.calendarEventIds ?? [];
  for (const eventId of calendarEventIds) {
    items.push({
      entryId: eventId,
      sourceType: 'calendar_event',
      title: null,
      versionOrUpdatedAt: KNOWLEDGE_CALENDAR_VERSION,
      caseType: null,
    });
  }

  return {
    availability: 'captured',
    items,
    caseLibrary: {
      requestedIds: [...input.caseLibrary.requestedIds],
      resolvedIds: [...input.caseLibrary.resolvedIds],
      partialUnavailable: Boolean(input.caseLibrary.partialUnavailable),
    },
    referenceCases: {
      ids: referenceCases.map((r) => r.id),
      count: referenceCases.length,
    },
    calendar: {
      datasetId: KNOWLEDGE_CALENDAR_DATASET_ID,
      datasetVersion: KNOWLEDGE_CALENDAR_VERSION,
      eventIds: [...calendarEventIds],
    },
    sellingPoints: {
      count: input.resolvedParams.productSellingPointCount,
    },
  };
}

function buildModelPolicyManifest(input: ArtifactCaptureInput): ModelPolicyManifestCaptured {
  const m = input.model;
  return {
    availability: 'captured',
    policyVersion: MODEL_POLICY_VERSION,
    defaultModel: m.defaultModel,
    requireRealModel: m.requireRealModel,
    hasConfiguredRealModel: m.hasConfiguredRealModel,
    allowQualityRetry: m.allowQualityRetry,
    thinkingDisabled: m.thinkingDisabled,
    timeouts: {
      generationMs: m.generationTimeoutMs,
      qualityScoreMs: m.qualityScoreTimeoutMs,
      postProcessingMs: m.postProcessingTimeoutMs,
    },
    fallbackChain: m.fallbackChain
      ? [...m.fallbackChain]
      : [...DEFAULT_FALLBACK_CHAIN],
    generatePromptVariant: input.generatePromptVariant,
    temperature: m.temperature ?? null,
  };
}

function hashManifestBody(body: Omit<GenerationArtifactManifest, 'contentHash'>): string {
  return hashCanonical(body);
}

/**
 * Capture the allowlisted artifacts that a generation request will use.
 * Never accepts or stores source text, rendered prompts, keys, or CoT.
 */
export function buildGenerationArtifactManifest(
  input: ArtifactCaptureInput,
): GenerationArtifactManifest {
  const body: Omit<GenerationArtifactManifest, 'contentHash'> = {
    schemaVersion: ARTIFACT_MANIFEST_SCHEMA_VERSION,
    availability: 'captured',
    prompt: buildPromptManifest(input),
    rules: buildRuleManifest(input),
    knowledge: buildKnowledgeManifest(input),
    modelPolicy: buildModelPolicyManifest(input),
  };

  return {
    ...body,
    contentHash: hashManifestBody(body),
  };
}

/**
 * Explicit package for pre-E1 or missing snapshots.
 * Must not read current prompt/rule source files or backfill versions.
 */
export function createLegacyUnavailableManifest(
  reason: ArtifactLegacyReason = 'pre_e1_job',
): GenerationArtifactManifest {
  const body: Omit<GenerationArtifactManifest, 'contentHash'> = {
    schemaVersion: ARTIFACT_MANIFEST_SCHEMA_VERSION,
    availability: 'legacy_unavailable',
    prompt: { availability: 'legacy_unavailable', reason },
    rules: { availability: 'legacy_unavailable', reason },
    knowledge: { availability: 'legacy_unavailable', reason },
    modelPolicy: { availability: 'legacy_unavailable', reason },
  };

  return {
    ...body,
    contentHash: hashManifestBody(body),
  };
}

/** Version registry for audits / E2 wiring. */
export function getCurrentArtifactVersions() {
  return {
    schemaVersion: ARTIFACT_MANIFEST_SCHEMA_VERSION,
    prompt: {
      system: PROMPT_SYSTEM_VERSION,
      diagnoseGenerate: PROMPT_DIAGNOSE_GENERATE_VERSION,
      cantoneseLlm: PROMPT_CANTONESE_LLM_VERSION,
      audit: PROMPT_AUDIT_VERSION,
    },
    rules: {
      complianceRulesetId: COMPLIANCE_RULESET_ID,
      compliance: COMPLIANCE_RULESET_VERSION,
      w1: RULE_W1_CONSTRAINTS_VERSION,
      ruleIds: [...COMPLIANCE_RULE_IDS],
    },
    knowledge: {
      calendarDatasetId: KNOWLEDGE_CALENDAR_DATASET_ID,
      calendar: KNOWLEDGE_CALENDAR_VERSION,
      caseLibraryPrompt: KNOWLEDGE_CASE_LIBRARY_PROMPT_VERSION,
    },
    modelPolicy: MODEL_POLICY_VERSION,
  } as const;
}
