import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '../prompts/systemPrompt.js';
import { buildDiagnoseGeneratePrompt } from '../prompts/diagnoseGenerate.js';
import { buildAuditPrompt, buildSourceScorePrompt, buildConsumerFeedbackPrompt, buildParsePersonasPrompt, buildTranslatePrompt, buildApplySuggestionPrompt } from '../prompts/audit.js';
import { buildReAuditPrompt } from '../prompts/reAudit.js';
import {
  buildBadCaseAnalysisPrompt,
  type BadCaseAnalysisPromptInput,
} from '../prompts/badCaseAnalysis.js';
import { parseJSON } from './parseJson.js';
import { TONE_TEMPERATURE } from '../types/index.js';
import { DEEPSEEK_NON_THINKING, DEFAULT_DEEPSEEK_MODEL } from './modelPolicy.js';
import { observeModelAttempt, type ModelCallContext } from './telemetryService.js';
import type {
  GenerateRequest,
  DiagnoseGenerateResult,
  Variants,
  Audit,
  AuditScores,
  ConsumerPersona,
  ConsumerFeedback,
} from '../types/index.js';

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;

const BAD_CASE_OWNER_TEAMS = new Set([
  'content_prompt',
  'knowledge_rules',
  'model_provider',
  'backend_platform',
  'frontend_experience',
  'unassigned',
]);

export const BAD_CASE_AI_ANALYSIS_VERSION = 'deepseek-1.0.0';

export interface BadCaseAiSuggestion {
  criterionRef: string;
  diagnosis: string;
  remediation: string;
  ownerTeam: string;
  confidence: number;
}

export interface BadCaseAiAnalysisResult {
  provider: 'deepseek';
  model: string;
  analysisVersion: string;
  summary: string;
  suggestions: BadCaseAiSuggestion[];
}

function limitedText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function parseBadCaseAiAnalysis(
  raw: unknown,
  allowedCriterionRefs: Set<string>,
): BadCaseAiAnalysisResult {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid bad case analysis response');
  const value = raw as Record<string, unknown>;
  const summary = limitedText(value.summary, 500);
  if (!summary) throw new Error('Invalid bad case analysis summary');
  const rows = Array.isArray(value.suggestions) ? value.suggestions.slice(0, 8) : [];
  const suggestions: BadCaseAiSuggestion[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const criterionRef = limitedText(item.criterionRef, 200);
    const diagnosis = limitedText(item.diagnosis, 1000);
    const remediation = limitedText(item.remediation, 1500);
    const ownerTeam = limitedText(item.ownerTeam, 40);
    const confidence = typeof item.confidence === 'number' ? item.confidence : NaN;
    if (
      !allowedCriterionRefs.has(criterionRef)
      || !diagnosis
      || !remediation
      || !BAD_CASE_OWNER_TEAMS.has(ownerTeam)
      || !Number.isFinite(confidence)
      || confidence < 0
      || confidence > 1
    ) continue;
    suggestions.push({ criterionRef, diagnosis, remediation, ownerTeam, confidence });
  }
  return {
    provider: 'deepseek',
    model: DEEPSEEK_MODEL,
    analysisVersion: BAD_CASE_AI_ANALYSIS_VERSION,
    summary,
    suggestions,
  };
}

/** DeepSeek adds review-only diagnosis to deterministic findings; it never mutates live artifacts. */
export async function analyzeBadCaseWithDeepSeek(
  input: BadCaseAnalysisPromptInput,
  context?: ModelCallContext,
): Promise<BadCaseAiAnalysisResult> {
  const client = getClient();
  const allowedCriterionRefs = new Set(input.findings.map((item) => item.criterionRef));
  const safeInput: BadCaseAnalysisPromptInput = {
    source: limitedText(input.source, 6000),
    variants: Object.fromEntries(
      Object.entries(input.variants)
        .slice(0, 8)
        .map(([key, value]) => [limitedText(key, 40), limitedText(value, 4000)]),
    ),
    criteria: input.criteria.slice(0, 30).map((item) => ({
      criterionRef: limitedText(item.criterionRef, 200),
      result: limitedText(item.result, 40),
      actual: typeof item.actual === 'string' ? limitedText(item.actual, 500) : item.actual,
      expected: typeof item.expected === 'string' ? limitedText(item.expected, 500) : item.expected,
    })),
    findings: input.findings.slice(0, 20).map((item) => ({
      criterionRef: limitedText(item.criterionRef, 200),
      description: limitedText(item.description, 1000),
      category: limitedText(item.category, 60),
      severity: limitedText(item.severity, 20),
      stage: item.stage == null ? null : limitedText(item.stage, 40),
    })),
    modelAttempts: input.modelAttempts.slice(0, 12).map((item) => ({
      operation: limitedText(item.operation, 60),
      provider: limitedText(item.provider, 60),
      model: limitedText(item.model, 120),
      status: limitedText(item.status, 20),
      errorClass: item.errorClass == null ? null : limitedText(item.errorClass, 40),
      latencyMs: Number.isFinite(item.latencyMs) ? Math.max(0, Math.round(item.latencyMs)) : 0,
    })),
  };
  const response = await observeModelAttempt(context, {
    operation: 'audit',
    provider: 'deepseek',
    model: DEEPSEEK_MODEL,
    attempt: 1,
  }, async (captureUsage) => {
    const completion = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      ...DEEPSEEK_NON_THINKING,
      max_tokens: 1800,
      temperature: 0.2,
      messages: [
        { role: 'system', content: '你只输出严格 JSON。所有结论必须可由输入证据审阅。' },
        { role: 'user', content: buildBadCaseAnalysisPrompt(safeInput) },
      ],
    });
    captureUsage(completion.usage);
    return parseJSON(completion.choices[0]?.message?.content ?? '');
  });
  return parseBadCaseAiAnalysis(response, allowedCriterionRefs);
}

function getClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not set');
  }
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com',
    timeout: 25000,
  });
}

export async function diagnoseAndGenerate(
  params: GenerateRequest,
  context?: ModelCallContext,
  attempt = 1,
): Promise<DiagnoseGenerateResult> {
  const client = getClient();
  const effectiveTone = params.primaryTone ?? params.tone;
  const userPrompt = buildDiagnoseGeneratePrompt({
    source: params.source,
    platform: params.platform,
    tone: effectiveTone,
    cantoneseLevel: params.cantoneseLevel,
    englishMixingLevel: params.englishMixingLevel,
    brandName: params.brandName,
    productName: params.productName,
    brandRedLines: params.brandRedLines,
    productSellingPoints: params.productSellingPoints,
    structuredBriefEnabled: params.structuredBriefEnabled,
    creativityLevel: params.creativityLevel ?? 2,
    inputLanguage: params.inputLanguage ?? 'mandarin',
    refresh: params.refresh,
    referenceCases: params.referenceCases,
    calendarEvents: params.calendarEvents,
    copyType: params.copyType,
    customCopyType: params.customCopyType,
    lengthControlEnabled: params.lengthControlEnabled,
    copyLengthLevel: params.copyLengthLevel,
    primaryTone: effectiveTone,
    toneModifiers: params.toneModifiers,
    caseLibraryContext: params.caseLibraryContext,
  });

  const temperature = TONE_TEMPERATURE[effectiveTone] ?? 0.7;

  return observeModelAttempt(context, {
    operation: 'generate',
    provider: 'deepseek',
    model: DEEPSEEK_MODEL,
    attempt,
  }, async (captureUsage) => {
    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      ...DEEPSEEK_NON_THINKING,
      max_tokens: 2200,
      temperature,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });
    captureUsage(response.usage);

    const content = response.choices[0]?.message?.content ?? '';
    return parseJSON(content) as DiagnoseGenerateResult;
  });
}

export async function audit(
  variants: Variants,
  brandRedLines?: string,
  context?: ModelCallContext,
): Promise<Audit> {
  const client = getClient();
  const userPrompt = buildAuditPrompt(variants, brandRedLines);

  return observeModelAttempt(context, {
    operation: 'audit',
    provider: 'deepseek',
    model: DEEPSEEK_MODEL,
    attempt: 1,
  }, async (captureUsage) => {
    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      ...DEEPSEEK_NON_THINKING,
      max_tokens: 1400,
      temperature: 0.5,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });
    captureUsage(response.usage);

    const content = response.choices[0]?.message?.content ?? '';
    return parseJSON(content) as Audit;
  });
}

/**
 * Re-audit variants after modification. Takes previous scores so the model
 * makes incremental adjustments instead of re-scoring from scratch.
 */
export async function reAudit(
  variants: Variants,
  previousScores?: AuditScores | null,
  brandRedLines?: string,
  context?: ModelCallContext,
): Promise<Audit> {
  const client = getClient();
  const userPrompt = buildReAuditPrompt(variants, previousScores, brandRedLines);

  return observeModelAttempt(context, {
    operation: 're_audit',
    provider: 'deepseek',
    model: DEEPSEEK_MODEL,
    attempt: 1,
  }, async (captureUsage) => {
    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      ...DEEPSEEK_NON_THINKING,
      max_tokens: 1400,
      temperature: 0.3, // lower temperature for more consistent re-scoring
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });
    captureUsage(response.usage);

    const content = response.choices[0]?.message?.content ?? '';
    return parseJSON(content) as Audit;
  });
}

/**
 * Score the original source text on the five dimensions.
 * Used to show "before vs after" comparison.
 */
export async function scoreSource(
  source: string,
  context?: ModelCallContext,
): Promise<AuditScores | null> {
  const client = getClient();
  const userPrompt = buildSourceScorePrompt(source);

  try {
    return await observeModelAttempt(context, {
      operation: 'score_source',
      provider: 'deepseek',
      model: DEEPSEEK_MODEL,
      attempt: 1,
    }, async (captureUsage) => {
      const response = await client.chat.completions.create({
        model: DEEPSEEK_MODEL,
        ...DEEPSEEK_NON_THINKING,
        max_tokens: 400,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });
      captureUsage(response.usage);

      const content = response.choices[0]?.message?.content ?? '';
      return parseJSON(content) as AuditScores;
    });
  } catch {
    return null;
  }
}

/**
 * Generate simulated consumer feedback based on personas.
 */
export async function generateConsumerFeedback(
  variants: Variants,
  personas: ConsumerPersona[],
  platform: string,
  source?: string,
  brandName?: string,
  productName?: string,
  brandRedLines?: string,
  context?: ModelCallContext,
): Promise<ConsumerFeedback[]> {
  // Use a longer timeout for consumer feedback — the prompt is large and the
  // response (per-persona feedback + suggestions) needs more tokens and time.
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY!,
    baseURL: 'https://api.deepseek.com',
    timeout: 25000,
  });
  const userPrompt = buildConsumerFeedbackPrompt(variants, personas, platform, source, brandName, productName, brandRedLines);

  try {
    return await observeModelAttempt(context, {
      operation: 'consumer_feedback',
      provider: 'deepseek',
      model: DEEPSEEK_MODEL,
      attempt: 1,
    }, async (captureUsage) => {
      const response = await client.chat.completions.create({
        model: DEEPSEEK_MODEL,
        ...DEEPSEEK_NON_THINKING,
        max_tokens: 3000,
        temperature: 0.8,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });
      captureUsage(response.usage);

      const content = response.choices[0]?.message?.content ?? '';
      const parsed = parseJSON(content);
      if (Array.isArray(parsed)) return parsed as ConsumerFeedback[];
      return [];
    });
  } catch {
    return [];
  }
}

/**
 * Parse unstructured free-text persona descriptions into structured ConsumerPersona[].
 * User can paste any format and DeepSeek extracts + normalizes it.
 */
export async function parsePersonasFromText(
  rawText: string,
  context?: ModelCallContext,
): Promise<ConsumerPersona[]> {
  const client = getClient();
  const userPrompt = buildParsePersonasPrompt(rawText);

  try {
    return await observeModelAttempt(context, {
      operation: 'parse_personas',
      provider: 'deepseek',
      model: DEEPSEEK_MODEL,
      attempt: 1,
    }, async (captureUsage) => {
      const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      ...DEEPSEEK_NON_THINKING,
      max_tokens: 1200,
      temperature: 0.5,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      });
      captureUsage(response.usage);

      const content = response.choices[0]?.message?.content ?? '';
      const parsed = parseJSON(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 1).map((p: Record<string, unknown>) => ({
        id: (p.id as string) ?? 'ai-gen-1',
        name: (p.name as string) ?? '目標消費者',
        ageRange: (p.ageRange as string) ?? '',
        occupation: (p.occupation as string) ?? '',
        habits: (p.habits as string) ?? '',
        apps: (p.apps as string) ?? '',
        notes: (p.notes as string) ?? '',
        }));
      }
      return [];
    });
  } catch {
    return [];
  }
}

/**
 * Translate Cantonese text to Mandarin/standard written Chinese.
 */
export async function translateToMandarin(
  cantoneseText: string,
  context?: ModelCallContext,
): Promise<string> {
  const client = getClient();
  const userPrompt = buildTranslatePrompt(cantoneseText);

  try {
    return await observeModelAttempt(context, {
      operation: 'translate',
      provider: 'deepseek',
      model: DEEPSEEK_MODEL,
      attempt: 1,
    }, async (captureUsage) => {
      const response = await client.chat.completions.create({
        model: DEEPSEEK_MODEL,
        ...DEEPSEEK_NON_THINKING,
        max_tokens: 600,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });
      captureUsage(response.usage);

      return (response.choices[0]?.message?.content ?? cantoneseText).trim();
    });
  } catch {
    return cantoneseText;
  }
}

/** Convert a single factual product selling point into natural Hong Kong Cantonese. */
export async function localizeSellingPoint(
  sourceText: string,
  context?: ModelCallContext,
): Promise<string> {
  const client = getClient();
  return observeModelAttempt(context, {
    operation: 'localize_selling_point',
    provider: 'deepseek',
    model: DEEPSEEK_MODEL,
    attempt: 1,
  }, async (captureUsage) => {
    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      ...DEEPSEEK_NON_THINKING,
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: '你係香港粵語文案編輯。只做忠實本地化，不可新增、刪減或誇大任何產品事實。',
        },
        {
          role: 'user',
          content: `將以下單一產品賣點改寫成自然香港粵語。只輸出一行港話表達，不要解釋、引號、標題或列表符號：\n\n${sourceText}`,
        },
      ],
    });
    captureUsage(response.usage);

    const localized = (response.choices[0]?.message?.content ?? '').trim();
    if (!localized) throw new Error('Selling point localization returned empty content');
    return localized;
  });
}

/**
 * Apply a consumer's modification suggestion to a variant text.
 */
export async function applySuggestion(
  variantText: string,
  suggestion: string,
  reason: string,
  brandRedLines?: string,
  originalText?: string,
  appliedSuggestions?: string[],
  context?: ModelCallContext,
): Promise<string | null> {
  const client = getClient();
  const userPrompt = buildApplySuggestionPrompt(variantText, suggestion, reason, brandRedLines, originalText, appliedSuggestions);

  try {
    return await observeModelAttempt(context, {
      operation: 'apply_suggestion',
      provider: 'deepseek',
      model: DEEPSEEK_MODEL,
      attempt: 1,
    }, async (captureUsage) => {
      const response = await client.chat.completions.create({
        model: DEEPSEEK_MODEL,
        ...DEEPSEEK_NON_THINKING,
        max_tokens: 1200,
        temperature: 0.5,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });
      captureUsage(response.usage);

      const content = response.choices[0]?.message?.content ?? '';
      const parsed = parseJSON(content) as { modifiedText?: string };
      return parsed.modifiedText ?? null;
    });
  } catch {
    return null;
  }
}

// ============================================================
// §16.3: 港话度评分器 — Cantonese Naturalness Scorer
// ============================================================

export interface CantoneseNaturalnessScores {
  standardHK: number;
  lightCantonese: number;
  ig: number;
  facebook: number;
  shorts: number;
  average: number;
  remarks: string;
}

/**
 * Rate the Cantonese naturalness of generated variants on a 1-5 scale.
 * Low cost (~300 tokens) — used to decide whether to auto-retry generation.
 */
export async function scoreCantoneseNaturalness(
  variants: Variants,
  context?: ModelCallContext,
  attempt = 1,
): Promise<CantoneseNaturalnessScores | null> {
  const client = getClient();

  const prompt = `你係一個港話質量評審。請對以下五個版本嘅粵語自然度獨立評分（1-5 分）：

**評分標準**：
- 5 = 完全自然，似香港人日常講嘢
- 4 = 大致自然，有極少量唔自然嘅位
- 3 = 部分自然，有幾處明顯唔似香港人講嘅
- 2 = 較多內地腔/書面腔，讀起身怪怪哋
- 1 = 幾乎唔係粵語，大量普通話直譯

**版本 1 - standardHK**：
${variants.standardHK}

**版本 2 - lightCantonese**：
${variants.lightCantonese}

**版本 3 - IG**：
${variants.ig}

**版本 4 - Facebook**：
${variants.facebook}

**版本 5 - Shorts/TK（YouTube Shorts / TikTok）**：
${variants.shorts}

請嚴格按照以下 JSON 格式輸出（只輸出 JSON，唔好加任何其他文字）：

\`\`\`json
{
  "standardHK": 4,
  "lightCantonese": 4,
  "ig": 3,
  "facebook": 4,
  "shorts": 3,
  "remarks": "簡短評語：邊個版本最自然、邊個有乜問題"
}
\`\`\``;

  try {
    return await observeModelAttempt(context, {
      operation: 'score_naturalness',
      provider: 'deepseek',
      model: DEEPSEEK_MODEL,
      attempt,
    }, async (captureUsage) => {
      const response = await client.chat.completions.create({
        model: DEEPSEEK_MODEL,
        ...DEEPSEEK_NON_THINKING,
        max_tokens: 300,
        temperature: 0.3, // Low temp for consistent scoring
        messages: [
          { role: 'system', content: '你係一個香港粵語質量評審。只輸出合法 JSON，唔好加任何其他文字。' },
          { role: 'user', content: prompt },
        ],
      });
      captureUsage(response.usage);

      const content = response.choices[0]?.message?.content ?? '';
      const result = parseJSON(content) as CantoneseNaturalnessScores;

      if (
        typeof result.standardHK !== 'number' ||
        typeof result.lightCantonese !== 'number' ||
        typeof result.ig !== 'number' ||
        typeof result.facebook !== 'number' ||
        typeof result.shorts !== 'number'
      ) {
        throw new Error('Invalid naturalness response');
      }

      result.average = (
        result.standardHK +
        result.lightCantonese +
        result.ig +
        result.facebook +
        result.shorts
      ) / 5;
      result.average = Math.round(result.average * 10) / 10;

      return result;
    });
  } catch (err) {
    console.warn('[CantoneseScorer] Failed:', (err as Error).message);
    return null;
  }
}
