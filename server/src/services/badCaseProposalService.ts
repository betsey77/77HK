/**
 * 2.1 Slice E5 — Bad case artifact proposal (review-only).
 *
 * Pure in-memory builders for allowlisted before/after proposal diffs.
 * No DB, no routes, no source-file writes, no auto-publish, no external models.
 */

import { hashCanonical } from './generationArtifactManifest.js';

// ---------------------------------------------------------------------------
// Schema / error codes
// ---------------------------------------------------------------------------

export const BAD_CASE_PROPOSAL_SCHEMA_VERSION = 1 as const;

export type BadCaseProposalArtifactType =
  | 'prompt'
  | 'rules'
  | 'knowledge'
  | 'model_policy';

export type BadCaseProposalStatus = 'pending_review';

export type BadCaseProposalErrorCode =
  | 'INVALID_INPUT'
  | 'LEGACY_UNAVAILABLE'
  | 'BEFORE_HASH_MISMATCH'
  | 'ARTIFACT_TYPE_MISMATCH'
  | 'EMPTY_PATCH'
  | 'PATH_NOT_ALLOWLISTED'
  | 'VALUE_TYPE_NOT_ALLOWED'
  | 'SENSITIVE_KEY_REJECTED'
  | 'SENSITIVE_VALUE_REJECTED'
  | 'PATCH_APPLY_FAILED'
  | 'DEPTH_OR_SIZE_EXCEEDED'
  | 'NO_EFFECTIVE_CHANGE';

const ERROR_MESSAGES: Record<BadCaseProposalErrorCode, string> = {
  INVALID_INPUT: 'Invalid bad-case proposal input',
  LEGACY_UNAVAILABLE: 'Cannot build proposal from legacy_unavailable artifact',
  BEFORE_HASH_MISMATCH: 'Before snapshot contentHash mismatch',
  ARTIFACT_TYPE_MISMATCH: 'Artifact type does not match before snapshot shape',
  EMPTY_PATCH: 'Proposal patch must contain at least one op',
  PATH_NOT_ALLOWLISTED: 'Proposal path is not allowlisted',
  VALUE_TYPE_NOT_ALLOWED: 'Proposal value type is not allowed',
  SENSITIVE_KEY_REJECTED: 'Sensitive key rejected in proposal payload',
  SENSITIVE_VALUE_REJECTED: 'Sensitive value rejected in proposal payload',
  PATCH_APPLY_FAILED: 'Failed to apply proposal patch',
  DEPTH_OR_SIZE_EXCEEDED: 'Proposal payload exceeds depth or size limits',
  NO_EFFECTIVE_CHANGE: 'Proposal after snapshot equals before',
};

export class BadCaseProposalError extends Error {
  readonly code: BadCaseProposalErrorCode;
  readonly details?: { path?: string; key?: string; reason?: string };

  constructor(
    code: BadCaseProposalErrorCode,
    message?: string,
    details?: BadCaseProposalError['details'],
  ) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = 'BadCaseProposalError';
    this.code = code;
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Captured snapshot shapes (local; do not import mutable shared types)
// ---------------------------------------------------------------------------

export type ProposalJsonScalar = string | number | boolean | null;
export type ProposalAllowedValue = ProposalJsonScalar | ProposalJsonScalar[];

export type ProposalPatchOp =
  | { op: 'replace'; path: string; value: ProposalAllowedValue }
  | { op: 'add'; path: string; value: ProposalAllowedValue }
  | { op: 'remove'; path: string };

export interface ProposalPatch {
  ops: ProposalPatchOp[];
}

export interface PromptTemplateEntryLike {
  templateId: string;
  version: string;
  sectionKeys: string[];
  paramKeys: string[];
}

export interface PromptManifestCapturedLike {
  availability: 'captured';
  templates: PromptTemplateEntryLike[];
  generatePromptVariant: 'deepseek' | 'cantonese_llm' | 'rules_fallback';
}

export interface RuleManifestCapturedLike {
  availability: 'captured';
  rulesetId: string;
  version: string;
  ruleIds: string[];
  w1ConstraintsVersion: string;
  userRedLinesPresent: boolean;
}

export interface KnowledgeItemRefLike {
  entryId: string;
  sourceType: 'case_library' | 'reference_bookmark' | 'calendar_event';
  title?: string | null;
  versionOrUpdatedAt?: string | null;
  caseType?: 'good' | 'bad' | null;
}

export interface KnowledgeManifestCapturedLike {
  availability: 'captured';
  items: KnowledgeItemRefLike[];
  caseLibrary: {
    requestedIds: string[];
    resolvedIds: string[];
    partialUnavailable: boolean;
  };
  referenceCases: {
    ids: string[];
    count: number;
  };
  calendar: {
    datasetId: string;
    datasetVersion: string;
    eventIds: string[];
  };
  sellingPoints: {
    count: number;
  };
}

export interface ModelPolicyManifestCapturedLike {
  availability: 'captured';
  policyVersion: string;
  defaultModel: string;
  requireRealModel: boolean;
  hasConfiguredRealModel: boolean;
  allowQualityRetry: boolean;
  thinkingDisabled: boolean;
  timeouts: {
    generationMs: number;
    qualityScoreMs: number;
    postProcessingMs: number;
  };
  fallbackChain: Array<'self-hosted-cantonese' | 'deepseek' | 'rules'>;
  generatePromptVariant: 'deepseek' | 'cantonese_llm' | 'rules_fallback';
  temperature?: number | null;
}

export type CapturedArtifactBody =
  | PromptManifestCapturedLike
  | RuleManifestCapturedLike
  | KnowledgeManifestCapturedLike
  | ModelPolicyManifestCapturedLike;

export type CapturedArtifactSnapshot =
  | { artifactType: 'prompt'; manifest: PromptManifestCapturedLike }
  | { artifactType: 'rules'; manifest: RuleManifestCapturedLike }
  | { artifactType: 'knowledge'; manifest: KnowledgeManifestCapturedLike }
  | { artifactType: 'model_policy'; manifest: ModelPolicyManifestCapturedLike };

export interface BadCaseProposalBeforeRef {
  contentHash: string;
  snapshot: CapturedArtifactSnapshot;
  generationJobId?: string | null;
  artifactManifestContentHash?: string | null;
}

export interface CreateBadCaseProposalInput {
  findingId: string;
  artifactType: BadCaseProposalArtifactType;
  before: BadCaseProposalBeforeRef;
  afterPatch: ProposalPatch;
  rationale?: string | null;
}

export interface ProposalDiffEntry {
  op: 'replace' | 'add' | 'remove';
  path: string;
  beforeValue?: ProposalAllowedValue;
  afterValue?: ProposalAllowedValue;
}

export interface BadCaseProposal {
  schemaVersion: typeof BAD_CASE_PROPOSAL_SCHEMA_VERSION;
  proposalHash: string;
  findingId: string;
  artifactType: BadCaseProposalArtifactType;
  status: 'pending_review';
  publishable: false;
  autoPublish: false;
  before: {
    contentHash: string;
    snapshot: CapturedArtifactSnapshot;
  };
  after: {
    contentHash: string;
    snapshot: CapturedArtifactSnapshot;
  };
  diff: ProposalDiffEntry[];
  rationale: string | null;
}

// ---------------------------------------------------------------------------
// Sensitive keys / secret-like values
// ---------------------------------------------------------------------------

export const PROPOSAL_SENSITIVE_KEYS: ReadonlySet<string> = new Set([
  'email',
  'useremail',
  'user_email',
  'jwt',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'apikey',
  'api_key',
  'apisecret',
  'api_secret',
  'authorization',
  'cookie',
  'setcookie',
  'set_cookie',
  'password',
  'secret',
  'privatekey',
  'private_key',
  'bearer',
  'source',
  'body',
  'content',
  'text',
  'prompt',
  'response',
  'rawprompt',
  'raw_prompt',
  'rawresponse',
  'raw_response',
  'messages',
  'message',
  'thinking',
  'chainofthought',
  'chain_of_thought',
  'cot',
  'reasoning',
  'renderedprompt',
  'rendered_prompt',
  'systemprompt',
  'system_prompt',
  'usercontent',
  'user_content',
  'providerpayload',
  'provider_payload',
  'providererror',
  'provider_error',
  'rawerror',
  'raw_error',
  'brandredlines',
  'brand_red_lines',
  'env',
  'processenv',
  'process_env',
]);

export const PROPOSAL_SECRET_LIKE_PATTERN =
  /(?:^|[^a-z0-9])(?:bearer\s+|eyJ[a-z0-9_-]{8,}\.|sk-[a-z0-9_-]{8,}|xai-[a-z0-9_-]{8,})/i;

export const PROPOSAL_EMAIL_LIKE_PATTERN =
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

const CREATE_INPUT_KEYS = new Set([
  'findingId',
  'artifactType',
  'before',
  'afterPatch',
  'rationale',
]);

const BEFORE_KEYS = new Set([
  'contentHash',
  'snapshot',
  'generationJobId',
  'artifactManifestContentHash',
]);

const SNAPSHOT_KEYS = new Set(['artifactType', 'manifest']);
const PATCH_KEYS = new Set(['ops']);
const OP_KEYS = new Set(['op', 'path', 'value']);

const ARTIFACT_TYPES: readonly BadCaseProposalArtifactType[] = [
  'prompt',
  'rules',
  'knowledge',
  'model_policy',
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const VERSION_PATTERN = /^(?:\d+\.\d+\.\d+|[a-zA-Z0-9._-]{1,64})$/;
const KEY_ID_PATTERN = /^[a-z0-9_]{1,64}$/;
const MODEL_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,119}$/i;
const FALLBACK_VALUES = new Set(['self-hosted-cantonese', 'deepseek', 'rules']);
const PROMPT_VARIANTS = new Set(['deepseek', 'cantonese_llm', 'rules_fallback']);

const MAX_OPS = 32;
const MAX_PATH_SEGMENTS = 8;
const MAX_STRING_LEN = 500;
const MAX_TITLE_LEN = 200;
const MAX_ARRAY_LEN = 64;

const REMOVABLE_PATHS: Readonly<Record<BadCaseProposalArtifactType, readonly RegExp[]>> = {
  prompt: [/^\/templates\/\d+\/(?:sectionKeys|paramKeys)\/\d+$/],
  rules: [/^\/ruleIds\/\d+$/],
  knowledge: [
    /^\/items\/\d+\/(?:title|versionOrUpdatedAt|caseType)$/,
    /^\/calendar\/eventIds\/\d+$/,
  ],
  model_policy: [/^\/fallbackChain\/\d+$/, /^\/temperature$/],
};

// ---------------------------------------------------------------------------
// Path allowlists (JSON Pointer regexes)
// ---------------------------------------------------------------------------

export const PROPOSAL_PATH_ALLOWLIST: Readonly<
  Record<BadCaseProposalArtifactType, readonly RegExp[]>
> = {
  prompt: [
    /^\/generatePromptVariant$/,
    /^\/templates\/\d+\/version$/,
    /^\/templates\/\d+\/sectionKeys$/,
    /^\/templates\/\d+\/sectionKeys\/\d+$/,
    /^\/templates\/\d+\/sectionKeys\/-$/,
    /^\/templates\/\d+\/paramKeys$/,
    /^\/templates\/\d+\/paramKeys\/\d+$/,
    /^\/templates\/\d+\/paramKeys\/-$/,
  ],
  rules: [
    /^\/version$/,
    /^\/w1ConstraintsVersion$/,
    /^\/ruleIds$/,
    /^\/ruleIds\/\d+$/,
    /^\/ruleIds\/-$/,
    /^\/userRedLinesPresent$/,
    /^\/rulesetId$/,
  ],
  knowledge: [
    /^\/items\/\d+\/title$/,
    /^\/items\/\d+\/versionOrUpdatedAt$/,
    /^\/items\/\d+\/caseType$/,
    /^\/caseLibrary\/requestedIds$/,
    /^\/caseLibrary\/resolvedIds$/,
    /^\/caseLibrary\/partialUnavailable$/,
    /^\/referenceCases\/ids$/,
    /^\/referenceCases\/count$/,
    /^\/calendar\/datasetVersion$/,
    /^\/calendar\/eventIds$/,
    /^\/calendar\/eventIds\/\d+$/,
    /^\/calendar\/eventIds\/-$/,
    /^\/sellingPoints\/count$/,
  ],
  model_policy: [
    /^\/policyVersion$/,
    /^\/defaultModel$/,
    /^\/requireRealModel$/,
    /^\/hasConfiguredRealModel$/,
    /^\/allowQualityRetry$/,
    /^\/thinkingDisabled$/,
    /^\/timeouts\/generationMs$/,
    /^\/timeouts\/qualityScoreMs$/,
    /^\/timeouts\/postProcessingMs$/,
    /^\/fallbackChain$/,
    /^\/fallbackChain\/\d+$/,
    /^\/fallbackChain\/-$/,
    /^\/generatePromptVariant$/,
    /^\/temperature$/,
  ],
};

export function isProposalPathAllowlisted(
  artifactType: BadCaseProposalArtifactType,
  path: string,
): boolean {
  return PROPOSAL_PATH_ALLOWLIST[artifactType].some((re) => re.test(path));
}

// ---------------------------------------------------------------------------
// Sensitive scanners
// ---------------------------------------------------------------------------

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

function isSensitiveKey(key: string): boolean {
  const lower = normalizeKey(key);
  if (PROPOSAL_SENSITIVE_KEYS.has(lower)) return true;
  const compact = lower.replace(/_/g, '');
  for (const forbidden of PROPOSAL_SENSITIVE_KEYS) {
    if (forbidden.replace(/_/g, '') === compact) return true;
  }
  return false;
}

export function assertNoSensitiveKeys(value: unknown, pathPrefix = ''): void {
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoSensitiveKeys(item, `${pathPrefix}/${i}`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        throw new BadCaseProposalError('SENSITIVE_KEY_REJECTED', undefined, {
          key,
          path: pathPrefix || undefined,
        });
      }
      assertNoSensitiveKeys(nested, pathPrefix ? `${pathPrefix}/${key}` : key);
    }
  }
}

function isSensitiveStringValue(value: string): boolean {
  if (PROPOSAL_SECRET_LIKE_PATTERN.test(value)) return true;
  if (PROPOSAL_EMAIL_LIKE_PATTERN.test(value)) return true;
  return false;
}

export function assertNoSensitiveValues(value: unknown, pathPrefix = ''): void {
  if (typeof value === 'string') {
    if (isSensitiveStringValue(value)) {
      throw new BadCaseProposalError('SENSITIVE_VALUE_REJECTED', undefined, {
        path: pathPrefix || undefined,
      });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoSensitiveValues(item, `${pathPrefix}/${i}`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      assertNoSensitiveValues(nested, pathPrefix ? `${pathPrefix}/${key}` : key);
    }
  }
}

// ---------------------------------------------------------------------------
// Value / path validation
// ---------------------------------------------------------------------------

function isProposalJsonScalar(value: unknown): value is ProposalJsonScalar {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function isProposalAllowedValue(value: unknown): value is ProposalAllowedValue {
  if (isProposalJsonScalar(value)) return true;
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_LEN) return false;
    return value.every((item) => isProposalJsonScalar(item));
  }
  return false;
}

function pathSegmentCount(path: string): number {
  if (!path.startsWith('/')) return Number.POSITIVE_INFINITY;
  return path.split('/').length - 1;
}

function validatePathStructure(path: string): void {
  if (typeof path !== 'string' || !path.startsWith('/') || path.includes('//')) {
    throw new BadCaseProposalError('PATH_NOT_ALLOWLISTED', undefined, { path });
  }
  if (pathSegmentCount(path) > MAX_PATH_SEGMENTS) {
    throw new BadCaseProposalError('DEPTH_OR_SIZE_EXCEEDED', undefined, { path });
  }
}

function validateValueForPath(
  artifactType: BadCaseProposalArtifactType,
  path: string,
  value: ProposalAllowedValue,
): void {
  if (typeof value === 'string') {
    const max = path.includes('/title') ? MAX_TITLE_LEN : MAX_STRING_LEN;
    if (value.length > max) {
      throw new BadCaseProposalError('DEPTH_OR_SIZE_EXCEEDED', undefined, { path });
    }
  }
  if (Array.isArray(value) && value.length > MAX_ARRAY_LEN) {
    throw new BadCaseProposalError('DEPTH_OR_SIZE_EXCEEDED', undefined, { path });
  }

  // Path-specific constraints
  if (path.endsWith('/version') || path.endsWith('Version') || path === '/policyVersion' || path === '/w1ConstraintsVersion' || path === '/calendar/datasetVersion') {
    if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
      throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path });
    }
  }
  if (path === '/generatePromptVariant') {
    if (typeof value !== 'string' || !PROMPT_VARIANTS.has(value)) {
      throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path });
    }
  }
  if (path === '/rulesetId') {
    if (value !== 'hk_social_compliance_builtin') {
      throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path });
    }
  }
  if (path === '/userRedLinesPresent' || path === '/caseLibrary/partialUnavailable' ||
      path === '/requireRealModel' || path === '/hasConfiguredRealModel' ||
      path === '/allowQualityRetry' || path === '/thinkingDisabled') {
    if (typeof value !== 'boolean') {
      throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path });
    }
  }
  if (path === '/referenceCases/count' || path === '/sellingPoints/count') {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path });
    }
  }
  if (/\/timeouts\//.test(path)) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 600_000) {
      throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path });
    }
  }
  if (path === '/temperature') {
    if (!(value === null || (typeof value === 'number' && value >= 0 && value <= 2))) {
      throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path });
    }
  }
  if (path === '/defaultModel') {
    if (typeof value !== 'string' || !MODEL_PATTERN.test(value)) {
      throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path });
    }
  }
  if (path.includes('/caseType')) {
    if (!(value === null || value === 'good' || value === 'bad')) {
      throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path });
    }
  }
  if (
    path.includes('sectionKeys') ||
    path.includes('paramKeys') ||
    path.includes('ruleIds')
  ) {
    const check = (s: unknown) => typeof s === 'string' && KEY_ID_PATTERN.test(s);
    if (Array.isArray(value)) {
      if (!value.every(check)) {
        throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path });
      }
    } else if (!check(value)) {
      throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path });
    }
  }
  if (path.includes('fallbackChain')) {
    const check = (s: unknown) => typeof s === 'string' && FALLBACK_VALUES.has(s);
    if (Array.isArray(value)) {
      if (!value.every(check)) {
        throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path });
      }
    } else if (!check(value)) {
      throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path });
    }
  }
  void artifactType;
}

export function validateProposalPatch(
  artifactType: BadCaseProposalArtifactType,
  patch: ProposalPatch,
): void {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new BadCaseProposalError('INVALID_INPUT');
  }
  for (const key of Object.keys(patch)) {
    if (!PATCH_KEYS.has(key)) {
      throw new BadCaseProposalError('INVALID_INPUT');
    }
  }
  if (!Array.isArray(patch.ops)) {
    throw new BadCaseProposalError('INVALID_INPUT');
  }
  if (patch.ops.length === 0) {
    throw new BadCaseProposalError('EMPTY_PATCH');
  }
  if (patch.ops.length > MAX_OPS) {
    throw new BadCaseProposalError('DEPTH_OR_SIZE_EXCEEDED');
  }

  for (const op of patch.ops) {
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      throw new BadCaseProposalError('INVALID_INPUT');
    }
    for (const key of Object.keys(op)) {
      if (!OP_KEYS.has(key)) {
        if (isSensitiveKey(key)) {
          throw new BadCaseProposalError('SENSITIVE_KEY_REJECTED', undefined, { key });
        }
        throw new BadCaseProposalError('INVALID_INPUT');
      }
    }
    if (op.op !== 'replace' && op.op !== 'add' && op.op !== 'remove') {
      throw new BadCaseProposalError('INVALID_INPUT');
    }
    validatePathStructure(op.path);
    if (!isProposalPathAllowlisted(artifactType, op.path)) {
      throw new BadCaseProposalError('PATH_NOT_ALLOWLISTED', undefined, { path: op.path });
    }
    if (op.op === 'remove') {
      if (!REMOVABLE_PATHS[artifactType].some((pattern) => pattern.test(op.path))) {
        throw new BadCaseProposalError('PATH_NOT_ALLOWLISTED', undefined, { path: op.path });
      }
      if ('value' in op && (op as { value?: unknown }).value !== undefined) {
        throw new BadCaseProposalError('INVALID_INPUT');
      }
      continue;
    }
    if (!('value' in op) || !isProposalAllowedValue(op.value)) {
      throw new BadCaseProposalError('VALUE_TYPE_NOT_ALLOWED', undefined, { path: op.path });
    }
    validateValueForPath(artifactType, op.path, op.value);
  }
}

// ---------------------------------------------------------------------------
// JSON Pointer helpers (restricted)
// ---------------------------------------------------------------------------

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function decodePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function readAtPointer(root: unknown, path: string): unknown {
  if (path === '') return root;
  const segments = path.split('/').slice(1).map(decodePointerSegment);
  let current: unknown = root;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') {
      throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, { path });
    }
    if (Array.isArray(current)) {
      const index = segment === '-' ? current.length : Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, { path });
      }
      current = current[index];
    } else {
      const obj = current as Record<string, unknown>;
      if (!(segment in obj)) {
        throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, { path });
      }
      current = obj[segment];
    }
  }
  return current;
}

function applyOp(root: unknown, op: ProposalPatchOp): ProposalDiffEntry {
  const path = op.path;
  const segments = path.split('/').slice(1).map(decodePointerSegment);
  if (segments.length === 0) {
    throw new BadCaseProposalError('PATH_NOT_ALLOWLISTED', undefined, { path });
  }

  let parent: unknown = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]!;
    if (parent === null || typeof parent !== 'object') {
      throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, { path });
    }
    if (Array.isArray(parent)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= parent.length) {
        throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, { path });
      }
      parent = parent[index];
    } else {
      parent = (parent as Record<string, unknown>)[segment];
    }
  }

  const last = segments[segments.length - 1]!;

  if (op.op === 'remove') {
    if (parent === null || typeof parent !== 'object') {
      throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, { path });
    }
    if (Array.isArray(parent)) {
      const index = Number(last);
      if (!Number.isInteger(index) || index < 0 || index >= parent.length) {
        throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, { path });
      }
      const beforeValue = parent[index] as ProposalAllowedValue;
      parent.splice(index, 1);
      return { op: 'remove', path, beforeValue };
    }
    const obj = parent as Record<string, unknown>;
    if (!(last in obj)) {
      throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, { path });
    }
    const beforeValue = obj[last] as ProposalAllowedValue;
    delete obj[last];
    return { op: 'remove', path, beforeValue };
  }

  if (op.op === 'add') {
    if (parent === null || typeof parent !== 'object') {
      throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, { path });
    }
    if (Array.isArray(parent)) {
      if (last === '-') {
        parent.push(op.value);
        return { op: 'add', path, afterValue: op.value };
      }
      const index = Number(last);
      if (!Number.isInteger(index) || index < 0 || index > parent.length) {
        throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, { path });
      }
      parent.splice(index, 0, op.value);
      return { op: 'add', path, afterValue: op.value };
    }
    (parent as Record<string, unknown>)[last] = op.value;
    return { op: 'add', path, afterValue: op.value };
  }

  // replace
  if (parent === null || typeof parent !== 'object') {
    throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, { path });
  }
  if (Array.isArray(parent)) {
    const index = Number(last);
    if (!Number.isInteger(index) || index < 0 || index >= parent.length) {
      throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, { path });
    }
    const beforeValue = parent[index] as ProposalAllowedValue;
    parent[index] = op.value;
    return { op: 'replace', path, beforeValue, afterValue: op.value };
  }
  const obj = parent as Record<string, unknown>;
  if (!(last in obj)) {
    throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, { path });
  }
  const beforeValue = obj[last] as ProposalAllowedValue;
  obj[last] = op.value;
  return { op: 'replace', path, beforeValue, afterValue: op.value };
}

export function applyAllowlistedPatch<T extends object>(
  artifactType: BadCaseProposalArtifactType,
  beforeBody: T,
  patch: ProposalPatch,
): T {
  validateProposalPatch(artifactType, patch);
  const clone = deepClone(beforeBody);
  for (const op of patch.ops) {
    applyOp(clone, op);
  }

  // Invariants for knowledge referenceCases
  if (
    artifactType === 'knowledge' &&
    clone &&
    typeof clone === 'object' &&
    'referenceCases' in clone
  ) {
    const ref = (clone as unknown as KnowledgeManifestCapturedLike).referenceCases;
    if (ref && Array.isArray(ref.ids) && typeof ref.count === 'number') {
      if (ref.count !== ref.ids.length) {
        throw new BadCaseProposalError('PATCH_APPLY_FAILED', undefined, {
          path: '/referenceCases/count',
          reason: 'count_ids_mismatch',
        });
      }
    }
  }

  return clone;
}

export function hashArtifactSnapshotBody(body: object): string {
  return hashCanonical(body);
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

function assertOnlyKeys(obj: object, allowed: Set<string>): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      if (isSensitiveKey(key)) {
        throw new BadCaseProposalError('SENSITIVE_KEY_REJECTED', undefined, { key });
      }
      throw new BadCaseProposalError('INVALID_INPUT');
    }
  }
}

function assertCapturedBody(body: unknown): asserts body is CapturedArtifactBody {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadCaseProposalError('INVALID_INPUT');
  }
  const availability = (body as { availability?: unknown }).availability;
  if (availability === 'legacy_unavailable') {
    throw new BadCaseProposalError('LEGACY_UNAVAILABLE');
  }
  if (availability !== 'captured') {
    throw new BadCaseProposalError('LEGACY_UNAVAILABLE');
  }
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildBadCaseProposal(
  input: CreateBadCaseProposalInput,
): BadCaseProposal {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadCaseProposalError('INVALID_INPUT');
  }

  assertOnlyKeys(input, CREATE_INPUT_KEYS);

  if (typeof input.findingId !== 'string' || !UUID_PATTERN.test(input.findingId)) {
    throw new BadCaseProposalError('INVALID_INPUT');
  }
  if (!ARTIFACT_TYPES.includes(input.artifactType)) {
    throw new BadCaseProposalError('INVALID_INPUT');
  }
  if (!input.before || typeof input.before !== 'object' || Array.isArray(input.before)) {
    throw new BadCaseProposalError('INVALID_INPUT');
  }
  assertOnlyKeys(input.before, BEFORE_KEYS);

  if (
    !input.before.snapshot ||
    typeof input.before.snapshot !== 'object' ||
    Array.isArray(input.before.snapshot)
  ) {
    throw new BadCaseProposalError('INVALID_INPUT');
  }
  assertOnlyKeys(input.before.snapshot, SNAPSHOT_KEYS);

  if (input.before.snapshot.artifactType !== input.artifactType) {
    throw new BadCaseProposalError('ARTIFACT_TYPE_MISMATCH');
  }

  assertCapturedBody(input.before.snapshot.manifest);

  if (
    typeof input.before.contentHash !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(input.before.contentHash)
  ) {
    throw new BadCaseProposalError('INVALID_INPUT');
  }

  // Path/value type checks before deep secret scans so typed failures win.
  validateProposalPatch(input.artifactType, input.afterPatch);

  assertNoSensitiveKeys(input);
  assertNoSensitiveValues(input);

  const beforeBody = input.before.snapshot.manifest;
  const actualHash = hashArtifactSnapshotBody(beforeBody);
  if (actualHash !== input.before.contentHash) {
    throw new BadCaseProposalError('BEFORE_HASH_MISMATCH');
  }

  if (input.rationale !== undefined && input.rationale !== null) {
    if (typeof input.rationale !== 'string' || input.rationale.length > MAX_STRING_LEN) {
      throw new BadCaseProposalError('INVALID_INPUT');
    }
  }

  const afterBody = applyAllowlistedPatch(
    input.artifactType,
    beforeBody,
    input.afterPatch,
  );
  assertNoSensitiveKeys(afterBody);
  assertNoSensitiveValues(afterBody);

  const afterHash = hashArtifactSnapshotBody(afterBody);
  if (afterHash === actualHash) {
    throw new BadCaseProposalError('NO_EFFECTIVE_CHANGE');
  }

  const diff: ProposalDiffEntry[] = [];
  // Re-apply on a fresh clone to collect per-op before/after for the diff view.
  const diffClone = deepClone(beforeBody);
  for (const op of input.afterPatch.ops) {
    const entry = applyOp(diffClone, op);
    diff.push(entry);
  }

  const rationale = input.rationale ?? null;
  const proposalHash = hashCanonical({
    schemaVersion: BAD_CASE_PROPOSAL_SCHEMA_VERSION,
    findingId: input.findingId,
    artifactType: input.artifactType,
    beforeHash: actualHash,
    afterHash,
    ops: input.afterPatch.ops,
    rationale,
  });

  const afterSnapshot = {
    artifactType: input.artifactType,
    manifest: afterBody,
  } as CapturedArtifactSnapshot;

  return {
    schemaVersion: BAD_CASE_PROPOSAL_SCHEMA_VERSION,
    proposalHash,
    findingId: input.findingId,
    artifactType: input.artifactType,
    status: 'pending_review',
    publishable: false,
    autoPublish: false,
    before: {
      contentHash: actualHash,
      snapshot: deepClone(input.before.snapshot),
    },
    after: {
      contentHash: afterHash,
      snapshot: afterSnapshot,
    },
    diff,
    rationale,
  };
}
