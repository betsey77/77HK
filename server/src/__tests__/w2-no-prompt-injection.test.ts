/**
 * W2 boundary: case library body/reason must NOT enter generate prompts or engine params.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  buildCantoneseLLMPrompt,
  buildDiagnoseGeneratePrompt,
} from '../prompts/diagnoseGenerate.js';
import { fallbackGenerate } from '../services/fallbackService.js';
import type { GenerateRequest } from '../types/index.js';

const base: GenerateRequest = {
  source: '新品今日上市，欢迎了解。限时优惠，欢迎选购。',
  platform: 'all',
  tone: '穩妥',
  cantoneseLevel: 4,
  englishMixingLevel: 1,
  useEnhancement: false,
  creativityLevel: 2,
  inputLanguage: 'mandarin',
};

const SECRET_BODY = 'W2_CASE_BODY_MUST_NOT_APPEAR_IN_PROMPT_XYZ';
const SECRET_REASON = 'W2_CASE_REASON_MUST_NOT_APPEAR_IN_PROMPT_ABC';

describe('W2 does not inject case library into generation', () => {
  it('DeepSeek / CantoneseLLM prompts omit case library body/reason even if smuggled on request object', () => {
    const smuggled = {
      ...base,
      caseLibraryEntries: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          caseType: 'good',
          body: SECRET_BODY,
          reason: SECRET_REASON,
        },
      ],
      selectedCaseLibraryIds: ['11111111-1111-4111-8111-111111111111'],
    } as GenerateRequest & {
      caseLibraryEntries: Array<{ id: string; caseType: string; body: string; reason: string }>;
      selectedCaseLibraryIds: string[];
    };

    const deepseek = buildDiagnoseGeneratePrompt(smuggled);
    const cantonese = buildCantoneseLLMPrompt(smuggled);
    expect(deepseek).not.toContain(SECRET_BODY);
    expect(deepseek).not.toContain(SECRET_REASON);
    expect(cantonese).not.toContain(SECRET_BODY);
    expect(cantonese).not.toContain(SECRET_REASON);
  });

  it('rules fallback does not include case library body/reason', async () => {
    const smuggled = {
      ...base,
      caseLibraryEntries: [{ body: SECRET_BODY, reason: SECRET_REASON }],
      selectedCaseLibraryIds: ['x'],
    } as GenerateRequest & { caseLibraryEntries: unknown; selectedCaseLibraryIds: string[] };

    const result = await fallbackGenerate(smuggled);
    const joined = JSON.stringify(result);
    expect(joined).not.toContain(SECRET_BODY);
    expect(joined).not.toContain(SECRET_REASON);
  });

  it('generate route does not map client-supplied case bodies into GenerateRequest', () => {
    const generatePath = path.resolve(process.cwd(), 'src/routes/generate.ts');
    const alt = path.resolve(process.cwd(), 'server/src/routes/generate.ts');
    const file = fs.existsSync(generatePath) ? generatePath : alt;
    const src = fs.readFileSync(file, 'utf8');
    // W3 may accept selectedCaseLibraryIds + resolveCaseLibraryContext, but never client bodies
    expect(src).not.toMatch(/obj\.caseLibraryEntries|body\.caseLibraryEntries/);
    expect(src).toContain('referenceCases');
    // Smuggled bodies field name must not be trusted as prompt input mapping
    expect(src).not.toMatch(/caseLibraryEntries\s*:/);
  });

  it('case library routes do not mount under /api/admin', () => {
    const appPath = path.resolve(process.cwd(), 'src/app.ts');
    const alt = path.resolve(process.cwd(), 'server/src/app.ts');
    const file = fs.existsSync(appPath) ? appPath : alt;
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toContain("caseLibraryRouter");
    expect(src).toMatch(/app\.use\('\/api',\s*caseLibraryRouter\)/);
    expect(src).not.toMatch(/admin.*caseLibrary|caseLibrary.*admin/i);
  });
});
