import { buildDiagnoseGeneratePrompt } from '../prompts/diagnoseGenerate.js';
import { buildAuditPrompt } from '../prompts/audit.js';
import type { GenerateRequest, Variants } from '../types/index.js';

export function buildPrompts(params: GenerateRequest) {
  return {
    diagnoseGenerate: buildDiagnoseGeneratePrompt(params),
    // audit prompt is built after generation since it needs the variants
  };
}

export function buildAuditPromptForVariants(variants: Variants): string {
  return buildAuditPrompt(variants);
}
