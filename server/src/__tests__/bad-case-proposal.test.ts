import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BAD_CASE_PROPOSAL_SCHEMA_VERSION,
  BadCaseProposalError,
  PROPOSAL_SENSITIVE_KEYS,
  buildBadCaseProposal,
  hashArtifactSnapshotBody,
  isProposalPathAllowlisted,
  type CreateBadCaseProposalInput,
  type PromptManifestCapturedLike,
  type RuleManifestCapturedLike,
} from '../services/badCaseProposalService.js';

const SERVICE_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../services/badCaseProposalService.ts'),
  'utf8',
);

const SENSITIVE_SAMPLE_KEYS = [
  'source',
  'content',
  'body',
  'messages',
  'thinking',
  'chainOfThought',
  'email',
  'jwt',
  'apiKey',
  'api_key',
  'authorization',
  'cookie',
  'rawError',
  'providerPayload',
  'prompt',
  'response',
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

function rulesBody(): RuleManifestCapturedLike {
  return {
    availability: 'captured',
    rulesetId: 'hk_social_compliance_builtin',
    version: '1.0.0',
    ruleIds: ['exaggeration', 'medical'],
    w1ConstraintsVersion: '1.0.0',
    userRedLinesPresent: true,
  };
}

function promptBody(): PromptManifestCapturedLike {
  return {
    availability: 'captured',
    generatePromptVariant: 'deepseek',
    templates: [
      {
        templateId: 'system_prompt',
        version: '1.0.0',
        sectionKeys: ['core_identity'],
        paramKeys: [],
      },
      {
        templateId: 'diagnose_generate',
        version: '1.0.0',
        sectionKeys: ['task', 'diagnosis'],
        paramKeys: ['platform', 'primaryTone'],
      },
    ],
  };
}

function baseRulesInput(
  overrides: Partial<CreateBadCaseProposalInput> = {},
): CreateBadCaseProposalInput {
  const body = rulesBody();
  return {
    findingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    artifactType: 'rules',
    before: {
      contentHash: hashArtifactSnapshotBody(body),
      snapshot: { artifactType: 'rules', manifest: body },
    },
    afterPatch: {
      ops: [{ op: 'replace', path: '/version', value: '1.0.1' }],
    },
    rationale: 'Bump ruleset after confirmed compliance miss',
    ...overrides,
  };
}

describe('badCaseProposalService (E5)', () => {
  describe('legacy_unavailable guard', () => {
    it('refuses to fabricate a before snapshot from legacy_unavailable', () => {
      const input: CreateBadCaseProposalInput = {
        findingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        artifactType: 'rules',
        before: {
          contentHash: 'deadbeef',
          snapshot: {
            artifactType: 'rules',
            manifest: { availability: 'legacy_unavailable', reason: 'pre_e1_job' } as never,
          },
        },
        afterPatch: {
          ops: [{ op: 'replace', path: '/version', value: '1.0.1' }],
        },
      };

      expect(() => buildBadCaseProposal(input)).toThrow(BadCaseProposalError);
      try {
        buildBadCaseProposal(input);
      } catch (err) {
        expect(err).toBeInstanceOf(BadCaseProposalError);
        expect((err as BadCaseProposalError).code).toBe('LEGACY_UNAVAILABLE');
      }
    });
  });

  describe('path allowlist & value types', () => {
    it('rejects non-allowlisted paths', () => {
      const input = baseRulesInput({
        afterPatch: {
          ops: [{ op: 'replace', path: '/body', value: 'secret rule text' }],
        },
      });
      expect(() => buildBadCaseProposal(input)).toThrowError(/not allowlisted/i);
      try {
        buildBadCaseProposal(input);
      } catch (err) {
        expect((err as BadCaseProposalError).code).toBe('PATH_NOT_ALLOWLISTED');
      }
    });

    it('rejects object values even on otherwise valid paths', () => {
      const input = baseRulesInput({
        afterPatch: {
          ops: [
            {
              op: 'replace',
              path: '/version',
              value: { messages: ['system'] } as never,
            },
          ],
        },
      });
      expect(() => buildBadCaseProposal(input)).toThrow(BadCaseProposalError);
      try {
        buildBadCaseProposal(input);
      } catch (err) {
        expect((err as BadCaseProposalError).code).toBe('VALUE_TYPE_NOT_ALLOWED');
      }
    });

    it('rejects knowledge content paths that would hold owner body', () => {
      expect(isProposalPathAllowlisted('knowledge', '/items/0/content')).toBe(false);
      expect(isProposalPathAllowlisted('knowledge', '/items/0/body')).toBe(false);
      expect(isProposalPathAllowlisted('knowledge', '/items/0/title')).toBe(true);
    });

    it('does not allow removing required manifest fields', () => {
      const input = baseRulesInput({
        afterPatch: { ops: [{ op: 'remove', path: '/version' }] },
      });

      expect(() => buildBadCaseProposal(input)).toThrow(BadCaseProposalError);
      try {
        buildBadCaseProposal(input);
      } catch (err) {
        expect((err as BadCaseProposalError).code).toBe('PATH_NOT_ALLOWLISTED');
      }
    });
  });

  describe('sensitive key rejection (static + runtime)', () => {
    it('exports a non-empty sensitive key set covering auth, body, CoT and provider fields', () => {
      for (const key of SENSITIVE_SAMPLE_KEYS) {
        const normalized = key.toLowerCase().replace(/_/g, '');
        const hit = [...PROPOSAL_SENSITIVE_KEYS].some(
          (k) => k.toLowerCase().replace(/_/g, '') === normalized || k.toLowerCase() === key.toLowerCase(),
        );
        expect(hit, `missing sensitive key coverage for ${key}`).toBe(true);
      }
    });

    it('runtime-rejects nested sensitive keys in the patch payload', () => {
      const input = baseRulesInput({
        afterPatch: {
          ops: [
            {
              op: 'replace',
              path: '/version',
              value: '1.0.1',
            },
          ],
        },
      });
      // Inject a forbidden sibling key via unknown top-level field.
      const poisoned = {
        ...input,
        apiKey: 'sk-should-never-pass',
      } as CreateBadCaseProposalInput;

      expect(() => buildBadCaseProposal(poisoned)).toThrow(BadCaseProposalError);
      try {
        buildBadCaseProposal(poisoned);
      } catch (err) {
        const code = (err as BadCaseProposalError).code;
        expect(['SENSITIVE_KEY_REJECTED', 'INVALID_INPUT']).toContain(code);
      }
    });

    it('runtime-rejects secret-like string values', () => {
      const body = rulesBody();
      const input = baseRulesInput({
        before: {
          contentHash: hashArtifactSnapshotBody(body),
          snapshot: { artifactType: 'rules', manifest: body },
        },
        afterPatch: {
          ops: [{ op: 'replace', path: '/version', value: 'sk-abc1234567890xyz' }],
        },
      });
      // version path is allowlisted but secret-like value must still fail
      expect(() => buildBadCaseProposal(input)).toThrow(BadCaseProposalError);
      try {
        buildBadCaseProposal(input);
      } catch (err) {
        expect((err as BadCaseProposalError).code).toBe('SENSITIVE_VALUE_REJECTED');
      }
    });
  });

  describe('hash integrity & empty patch', () => {
    it('rejects before contentHash mismatch', () => {
      const input = baseRulesInput({
        before: {
          contentHash: '0'.repeat(64),
          snapshot: { artifactType: 'rules', manifest: rulesBody() },
        },
      });
      expect(() => buildBadCaseProposal(input)).toThrow(BadCaseProposalError);
      try {
        buildBadCaseProposal(input);
      } catch (err) {
        expect((err as BadCaseProposalError).code).toBe('BEFORE_HASH_MISMATCH');
      }
    });

    it('rejects empty patch ops', () => {
      const input = baseRulesInput({ afterPatch: { ops: [] } });
      expect(() => buildBadCaseProposal(input)).toThrow(BadCaseProposalError);
      try {
        buildBadCaseProposal(input);
      } catch (err) {
        expect((err as BadCaseProposalError).code).toBe('EMPTY_PATCH');
      }
    });

    it('rejects no-effective-change patches', () => {
      const input = baseRulesInput({
        afterPatch: {
          ops: [{ op: 'replace', path: '/version', value: '1.0.0' }],
        },
      });
      expect(() => buildBadCaseProposal(input)).toThrow(BadCaseProposalError);
      try {
        buildBadCaseProposal(input);
      } catch (err) {
        expect((err as BadCaseProposalError).code).toBe('NO_EFFECTIVE_CHANGE');
      }
    });
  });

  describe('successful pending proposal', () => {
    it('builds a reviewable non-publishable diff for allowlisted rules version bump', () => {
      const proposal = buildBadCaseProposal(baseRulesInput());

      expect(proposal.schemaVersion).toBe(BAD_CASE_PROPOSAL_SCHEMA_VERSION);
      expect(proposal.status).toBe('pending_review');
      expect(proposal.publishable).toBe(false);
      expect(proposal.autoPublish).toBe(false);
      expect(proposal.artifactType).toBe('rules');
      expect(proposal.diff).toHaveLength(1);
      expect(proposal.diff[0]).toMatchObject({
        op: 'replace',
        path: '/version',
        beforeValue: '1.0.0',
        afterValue: '1.0.1',
      });
      expect(proposal.after.contentHash).not.toBe(proposal.before.contentHash);
      expect(proposal.after.snapshot.manifest.availability).toBe('captured');
      if (proposal.after.snapshot.manifest.availability === 'captured') {
        expect(
          (proposal.after.snapshot.manifest as { version?: string }).version,
        ).toBe('1.0.1');
      }

      const keys = collectKeys(proposal);
      for (const forbidden of SENSITIVE_SAMPLE_KEYS) {
        expect(keys.has(forbidden)).toBe(false);
      }
    });

    it('supports prompt template version bump without storing prompt body text', () => {
      const body = promptBody();
      const proposal = buildBadCaseProposal({
        findingId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        artifactType: 'prompt',
        before: {
          contentHash: hashArtifactSnapshotBody(body),
          snapshot: { artifactType: 'prompt', manifest: body },
        },
        afterPatch: {
          ops: [{ op: 'replace', path: '/templates/1/version', value: '1.0.1' }],
        },
      });

      expect(proposal.publishable).toBe(false);
      expect(proposal.status).toBe('pending_review');
      expect(JSON.stringify(proposal)).not.toMatch(/你是一位|system:|user:/i);
      expect(proposal.diff[0]?.path).toBe('/templates/1/version');
    });
  });

  describe('module isolation (no auto-publish surface)', () => {
    it('does not import network, fs write, openai, or publish helpers', () => {
      expect(SERVICE_SRC).not.toMatch(/\bwriteFile\b/);
      expect(SERVICE_SRC).not.toMatch(/\bopenai\b/i);
      expect(SERVICE_SRC).not.toMatch(/\bfetch\s*\(/);
      expect(SERVICE_SRC).not.toMatch(/function\s+publish/i);
      expect(SERVICE_SRC).not.toMatch(/autoPublish\s*:\s*true/);
      expect(SERVICE_SRC).not.toMatch(/publishable\s*:\s*true/);
    });
  });
});

