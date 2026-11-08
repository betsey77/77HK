import { describe, expect, it } from 'vitest';
import { buildBadCaseAnalysisPrompt } from '../prompts/badCaseAnalysis.js';

describe('buildBadCaseAnalysisPrompt — attribution evidence', () => {
  it('carries the runtime errorCode and forbids provider blame on precondition blocks', () => {
    const prompt = buildBadCaseAnalysisPrompt({
      source: '你好',
      variants: {},
      runtime: {
        status: 'failed',
        errorCode: 'QUOTA_EXHAUSTED',
        generationEngine: null,
      },
      criteria: [{
        criterionRef: 'runtime.generation_success@1.0.0',
        result: 'fail',
        actual: 'failed',
        expected: 'completed',
        evidence: [{
          type: 'job_field',
          path: 'error_code',
          value: 'QUOTA_EXHAUSTED',
        }],
      }],
      findings: [],
      modelAttempts: [],
    });

    expect(prompt).toContain('"errorCode"');
    expect(prompt).toContain('QUOTA_EXHAUSTED');
    expect(prompt).toContain('"path"');
    expect(prompt).toContain('modelAttempts 为空不等于模型故障');
    expect(prompt).toContain('ownerTeam 不得为 model_provider');
  });
});
