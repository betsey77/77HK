import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '../prompts/systemPrompt.js';
import { buildDiagnoseGeneratePrompt } from '../prompts/diagnoseGenerate.js';
import { buildAuditPrompt, buildSourceScorePrompt, buildConsumerFeedbackPrompt, buildParsePersonasPrompt, buildTranslatePrompt, buildApplySuggestionPrompt } from '../prompts/audit.js';
import { buildReAuditPrompt } from '../prompts/reAudit.js';
import { parseJSON } from './parseJson.js';
import { TONE_TEMPERATURE } from '../types/index.js';
import type {
  GenerateRequest,
  DiagnoseGenerateResult,
  Variants,
  Audit,
  AuditScores,
  ConsumerPersona,
  ConsumerFeedback,
} from '../types/index.js';

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

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
): Promise<DiagnoseGenerateResult> {
  const client = getClient();
  const userPrompt = buildDiagnoseGeneratePrompt({
    source: params.source,
    platform: params.platform,
    tone: params.tone,
    cantoneseLevel: params.cantoneseLevel,
    englishMixingLevel: params.englishMixingLevel,
    brandName: params.brandName,
    productName: params.productName,
    brandRedLines: params.brandRedLines,
    structuredBriefEnabled: params.structuredBriefEnabled,
    creativityLevel: params.creativityLevel ?? 2,
    inputLanguage: params.inputLanguage ?? 'mandarin',
    refresh: params.refresh,
    referenceCases: params.referenceCases,
    calendarEvents: params.calendarEvents,
  });

  const temperature = TONE_TEMPERATURE[params.tone] ?? 0.7;

  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    max_tokens: 2200,
    temperature,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? '';
  return parseJSON(content) as DiagnoseGenerateResult;
}

export async function audit(variants: Variants, brandRedLines?: string): Promise<Audit> {
  const client = getClient();
  const userPrompt = buildAuditPrompt(variants, brandRedLines);

  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    max_tokens: 1400,
    temperature: 0.5,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? '';
  return parseJSON(content) as Audit;
}

/**
 * Re-audit variants after modification. Takes previous scores so the model
 * makes incremental adjustments instead of re-scoring from scratch.
 */
export async function reAudit(
  variants: Variants,
  previousScores?: AuditScores | null,
  brandRedLines?: string,
): Promise<Audit> {
  const client = getClient();
  const userPrompt = buildReAuditPrompt(variants, previousScores, brandRedLines);

  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    max_tokens: 1400,
    temperature: 0.3, // lower temperature for more consistent re-scoring
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? '';
  return parseJSON(content) as Audit;
}

/**
 * Score the original source text on the five dimensions.
 * Used to show "before vs after" comparison.
 */
export async function scoreSource(source: string): Promise<AuditScores | null> {
  const client = getClient();
  const userPrompt = buildSourceScorePrompt(source);

  try {
    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 400,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? '';
    return parseJSON(content) as AuditScores;
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
    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 3000,
      temperature: 0.8,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? '';
    const parsed = parseJSON(content);
    if (Array.isArray(parsed)) return parsed as ConsumerFeedback[];
    return [];
  } catch {
    return [];
  }
}

/**
 * Parse unstructured free-text persona descriptions into structured ConsumerPersona[].
 * User can paste any format and DeepSeek extracts + normalizes it.
 */
export async function parsePersonasFromText(rawText: string): Promise<ConsumerPersona[]> {
  const client = getClient();
  const userPrompt = buildParsePersonasPrompt(rawText);

  try {
    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 1200,
      temperature: 0.5,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? '';
    const parsed = parseJSON(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((p: Record<string, unknown>, i: number) => ({
        id: (p.id as string) ?? `ai-gen-${i + 1}`,
        name: (p.name as string) ?? `消費者 ${i + 1}`,
        ageRange: (p.ageRange as string) ?? '',
        occupation: (p.occupation as string) ?? '',
        habits: (p.habits as string) ?? '',
        apps: (p.apps as string) ?? '',
        notes: (p.notes as string) ?? '',
      }));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Translate Cantonese text to Mandarin/standard written Chinese.
 */
export async function translateToMandarin(cantoneseText: string): Promise<string> {
  const client = getClient();
  const userPrompt = buildTranslatePrompt(cantoneseText);

  try {
    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 600,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    return (response.choices[0]?.message?.content ?? cantoneseText).trim();
  } catch {
    return cantoneseText;
  }
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
): Promise<string | null> {
  const client = getClient();
  const userPrompt = buildApplySuggestionPrompt(variantText, suggestion, reason, brandRedLines, originalText, appliedSuggestions);

  try {
    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 1200,
      temperature: 0.5,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? '';
    const parsed = parseJSON(content) as { modifiedText?: string };
    return parsed.modifiedText ?? null;
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
export async function scoreCantoneseNaturalness(variants: Variants): Promise<CantoneseNaturalnessScores | null> {
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

**版本 5 - Shorts**：
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
    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      max_tokens: 300,
      temperature: 0.3, // Low temp for consistent scoring
      messages: [
        { role: 'system', content: '你係一個香港粵語質量評審。只輸出合法 JSON，唔好加任何其他文字。' },
        { role: 'user', content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? '';
    const result = parseJSON(content) as CantoneseNaturalnessScores;

    if (
      typeof result.standardHK !== 'number' ||
      typeof result.lightCantonese !== 'number' ||
      typeof result.ig !== 'number' ||
      typeof result.facebook !== 'number' ||
      typeof result.shorts !== 'number'
    ) {
      return null;
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
  } catch (err) {
    console.warn('[CantoneseScorer] Failed:', (err as Error).message);
    return null;
  }
}
