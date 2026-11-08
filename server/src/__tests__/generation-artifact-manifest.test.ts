import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_MANIFEST_SCHEMA_VERSION,
  COMPLIANCE_RULESET_ID,
  COMPLIANCE_RULESET_VERSION,
  KNOWLEDGE_CALENDAR_DATASET_ID,
  KNOWLEDGE_CALENDAR_VERSION,
  MODEL_POLICY_VERSION,
  PROMPT_AUDIT_VERSION,
  PROMPT_CANTONESE_LLM_VERSION,
  PROMPT_DIAGNOSE_GENERATE_VERSION,
  PROMPT_SYSTEM_VERSION,
  RULE_W1_CONSTRAINTS_VERSION,
  buildGenerationArtifactManifest,
  canonicalJson,
  createLegacyUnavailableManifest,
  hashCanonical,
  type ArtifactCaptureInput,
} from '../services/generationArtifactManifest.js';

const SENSITIVE_KEYS = [
  'source',
  'email',
  'jwt',
  'apiKey',
  'api_key',
  'authorization',
  'messages',
  'thinking',
  'chainOfThought',
  'rawPrompt',
  'rawResponse',
  'providerPayload',
  'brandRedLines',
  'body',
  'content',
];

function collectKeys(value: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, found);
    return found;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      found.add(key);
      collectKeys(nested, found);
    }
  }
  return found;
}

function baseCaptureInput(overrides: Partial<ArtifactCaptureInput> = {}): ArtifactCaptureInput {
  return {
    generatePromptVariant: 'deepseek',
    resolvedParams: {
      platform: 'all',
      primaryTone: '穩妥',
      toneModifiers: ['简洁'],
      cantoneseLevel: 2,
      englishMixingLevel: 1,
      creativityLevel: 2,
      inputLanguage: 'mandarin',
      copyType: 'social',
      lengthControlEnabled: true,
      copyLengthLevel: 3,
      refresh: false,
      hasBrandName: true,
      hasProductName: true,
      hasBrandRedLines: true,
      productSellingPointCount: 2,
      selectedCaseLibraryIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      referenceCaseIds: ['bookmark-1'],
      calendarEventIds: ['dragon-boat-2026'],
    },
    caseLibrary: {
      requestedIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      resolvedIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      partialUnavailable: false,
      resolvedMeta: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          caseType: 'good',
          title: '港味开场',
          versionOrUpdatedAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    },
    referenceCases: [
      {
        id: 'bookmark-1',
        variantKey: 'ig',
        title: null,
      },
    ],
    calendarEventIds: ['dragon-boat-2026'],
    model: {
      requireRealModel: false,
      hasConfiguredRealModel: true,
      generationTimeoutMs: 25_000,
      qualityScoreTimeoutMs: 8_000,
      postProcessingTimeoutMs: 35_000,
      allowQualityRetry: true,
      defaultModel: 'deepseek-v4-flash',
      thinkingDisabled: true,
      temperature: 0.5,
    },
    ...overrides,
  };
}

describe('generation artifact manifest contract (E1)', () => {
  describe('schema & hashing', () => {
    it('pins schema version on every captured and legacy manifest', () => {
      const captured = buildGenerationArtifactManifest(baseCaptureInput());
      const legacy = createLegacyUnavailableManifest();

      expect(ARTIFACT_MANIFEST_SCHEMA_VERSION).toBe(1);
      expect(captured.schemaVersion).toBe(ARTIFACT_MANIFEST_SCHEMA_VERSION);
      expect(legacy.schemaVersion).toBe(ARTIFACT_MANIFEST_SCHEMA_VERSION);
      expect(captured.availability).toBe('captured');
      expect(legacy.availability).toBe('legacy_unavailable');
    });

    it('produces the same hash regardless of object key insertion order', () => {
      const a = { b: 1, a: 2, nested: { z: true, m: [1, 2] } };
      const b = { nested: { m: [1, 2], z: true }, a: 2, b: 1 };

      expect(canonicalJson(a)).toBe(canonicalJson(b));
      expect(hashCanonical(a)).toBe(hashCanonical(b));
      expect(hashCanonical(a)).toBe(
        createHash('sha256').update(canonicalJson(a), 'utf8').digest('hex'),
      );
    });

    it('preserves array order in the hash payload', () => {
      const left = hashCanonical({ ids: ['a', 'b'] });
      const right = hashCanonical({ ids: ['b', 'a'] });
      expect(left).not.toBe(right);
    });
  });

  describe('prompt_manifest', () => {
    it('versions dual model prompt paths with non-empty section and param keys', () => {
      const deepseek = buildGenerationArtifactManifest(
        baseCaptureInput({ generatePromptVariant: 'deepseek' }),
      );
      const cantonese = buildGenerationArtifactManifest(
        baseCaptureInput({ generatePromptVariant: 'cantonese_llm' }),
      );

      expect(deepseek.prompt.availability).toBe('captured');
      expect(cantonese.prompt.availability).toBe('captured');
      if (deepseek.prompt.availability !== 'captured') throw new Error('expected captured');
      if (cantonese.prompt.availability !== 'captured') throw new Error('expected captured');

      const deepTemplate = deepseek.prompt.templates.find((t) => t.templateId === 'diagnose_generate');
      const cantoTemplate = cantonese.prompt.templates.find(
        (t) => t.templateId === 'cantonese_llm_generate',
      );
      const systemDeep = deepseek.prompt.templates.find((t) => t.templateId === 'system_prompt');
      const auditDeep = deepseek.prompt.templates.find((t) => t.templateId === 'audit');

      expect(deepTemplate?.version).toBe(PROMPT_DIAGNOSE_GENERATE_VERSION);
      expect(cantoTemplate?.version).toBe(PROMPT_CANTONESE_LLM_VERSION);
      expect(systemDeep?.version).toBe(PROMPT_SYSTEM_VERSION);
      expect(auditDeep?.version).toBe(PROMPT_AUDIT_VERSION);
      expect(deepTemplate?.sectionKeys.length).toBeGreaterThan(0);
      expect(deepTemplate?.paramKeys.length).toBeGreaterThan(0);
      expect(cantoTemplate?.sectionKeys.length).toBeGreaterThan(0);
      expect(deepseek.contentHash).not.toBe(cantonese.contentHash);
    });
  });

  describe('rule_manifest', () => {
    it('pins compliance ruleset and W1 constraint versions without rule body text', () => {
      const manifest = buildGenerationArtifactManifest(baseCaptureInput());
      expect(manifest.rules.availability).toBe('captured');
      if (manifest.rules.availability !== 'captured') throw new Error('expected captured');

      expect(manifest.rules.rulesetId).toBe(COMPLIANCE_RULESET_ID);
      expect(manifest.rules.version).toBe(COMPLIANCE_RULESET_VERSION);
      expect(manifest.rules.w1ConstraintsVersion).toBe(RULE_W1_CONSTRAINTS_VERSION);
      expect(manifest.rules.ruleIds.length).toBeGreaterThan(0);
      expect(manifest.rules.userRedLinesPresent).toBe(true);
      expect(JSON.stringify(manifest.rules)).not.toMatch(/禁止使用無法證實/);
    });
  });

  describe('knowledge_manifest', () => {
    it('records case library, reference cases and calendar ids without full bodies', () => {
      const manifest = buildGenerationArtifactManifest(baseCaptureInput());
      expect(manifest.knowledge.availability).toBe('captured');
      if (manifest.knowledge.availability !== 'captured') throw new Error('expected captured');

      expect(manifest.knowledge.caseLibrary.resolvedIds).toEqual([
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ]);
      expect(manifest.knowledge.calendar.datasetId).toBe(KNOWLEDGE_CALENDAR_DATASET_ID);
      expect(manifest.knowledge.calendar.datasetVersion).toBe(KNOWLEDGE_CALENDAR_VERSION);
      expect(manifest.knowledge.calendar.eventIds).toEqual(['dragon-boat-2026']);
      expect(manifest.knowledge.referenceCases.count).toBe(1);
      expect(manifest.knowledge.items.some((i) => i.sourceType === 'case_library')).toBe(true);
      expect(manifest.knowledge.items.every((i) => !('body' in i) && !('content' in i))).toBe(true);
    });

    it('allows empty knowledge context', () => {
      const manifest = buildGenerationArtifactManifest(
        baseCaptureInput({
          caseLibrary: {
            requestedIds: [],
            resolvedIds: [],
            partialUnavailable: false,
            resolvedMeta: [],
          },
          referenceCases: [],
          calendarEventIds: [],
          resolvedParams: {
            ...baseCaptureInput().resolvedParams,
            selectedCaseLibraryIds: [],
            referenceCaseIds: [],
            calendarEventIds: [],
            productSellingPointCount: 0,
          },
        }),
      );

      expect(manifest.knowledge.availability).toBe('captured');
      if (manifest.knowledge.availability !== 'captured') throw new Error('expected captured');
      expect(manifest.knowledge.items).toEqual([]);
      expect(manifest.knowledge.caseLibrary.resolvedIds).toEqual([]);
      expect(manifest.knowledge.referenceCases.count).toBe(0);
      expect(manifest.knowledge.calendar.eventIds).toEqual([]);
    });
  });

  describe('model_policy_manifest', () => {
    it('captures non-secret policy fields with a pinned policy version', () => {
      const manifest = buildGenerationArtifactManifest(baseCaptureInput());
      expect(manifest.modelPolicy.availability).toBe('captured');
      if (manifest.modelPolicy.availability !== 'captured') throw new Error('expected captured');

      expect(manifest.modelPolicy.policyVersion).toBe(MODEL_POLICY_VERSION);
      expect(manifest.modelPolicy.defaultModel).toBe('deepseek-v4-flash');
      expect(manifest.modelPolicy.requireRealModel).toBe(false);
      expect(manifest.modelPolicy.hasConfiguredRealModel).toBe(true);
      expect(manifest.modelPolicy.allowQualityRetry).toBe(true);
      expect(manifest.modelPolicy.thinkingDisabled).toBe(true);
      expect(manifest.modelPolicy.timeouts.generationMs).toBe(25_000);
      expect(manifest.modelPolicy.fallbackChain.length).toBeGreaterThan(0);
      expect(manifest.modelPolicy.generatePromptVariant).toBe('deepseek');
    });
  });

  describe('legacy_unavailable', () => {
    it('returns a stable legacy package and never backfills current versions as history', () => {
      const a = createLegacyUnavailableManifest();
      const b = createLegacyUnavailableManifest('pre_e1_job');

      expect(a.availability).toBe('legacy_unavailable');
      expect(a.prompt.availability).toBe('legacy_unavailable');
      expect(a.rules.availability).toBe('legacy_unavailable');
      expect(a.knowledge.availability).toBe('legacy_unavailable');
      expect(a.modelPolicy.availability).toBe('legacy_unavailable');
      expect(a.contentHash).toBe(b.contentHash);
      expect(a.contentHash.length).toBe(64);

      // Must not masquerade as a captured current ruleset/prompt package.
      expect(JSON.stringify(a)).not.toContain(COMPLIANCE_RULESET_VERSION);
      expect(JSON.stringify(a)).not.toContain(PROMPT_DIAGNOSE_GENERATE_VERSION);
      if (a.prompt.availability === 'legacy_unavailable') {
        expect(a.prompt.reason).toBe('pre_e1_job');
      }
    });
  });

  describe('privacy allowlist', () => {
    it('never stores sensitive keys or CoT/provider payload fields', () => {
      const manifest = buildGenerationArtifactManifest(baseCaptureInput());
      const keys = collectKeys(manifest);
      for (const forbidden of SENSITIVE_KEYS) {
        expect(keys.has(forbidden)).toBe(false);
      }
      const serialized = JSON.stringify(manifest);
      expect(serialized).not.toMatch(/sk-[a-zA-Z0-9]/);
      expect(serialized).not.toMatch(/Bearer\s+/i);
    });
  });
});
