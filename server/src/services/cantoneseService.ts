import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '../prompts/systemPrompt.js';
import { buildCantoneseLLMPrompt } from '../prompts/diagnoseGenerate.js';
import { parseJSON } from './parseJson.js';
import { TONE_TEMPERATURE } from '../types/index.js';
import {
  observeModelAttempt,
  type ModelCallContext,
  type ModelCallProvider,
} from './telemetryService.js';
import type { GenerateRequest, DiagnoseGenerateResult } from '../types/index.js';

const FEATHERLESS_MODEL = 'hon9kon9ize/CantoneseLLMChat-v1.0-32B';
const SELF_HOSTED_MODEL = 'cantonese-4b';
const MAX_RETRIES = 0;
const COLD_START_RETRIES = 2; // model_pending_deploy: wait for warm-up
const COLD_START_DELAYS_MS = [15000, 30000]; // 15s, 30s
const RETRY_DELAYS_MS = [2000, 4000, 8000];

function isRetryable(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status;
    if (status === 503 || status === 429) return true;
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code;
    if (code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED') return true;
  }
  return false;
}

/** Errors that mean "don't bother retrying, skip to next client" */
function isFatalError(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    // Subscription expired / free tier doesn't include API access
    if (e.code === 'upgrade_required') return true;
    // Model permanently removed from inference fleet
    if (e.code === 'model_not_deployed') return true;
    if (typeof e.message === 'string' && e.message.includes('not available for inference')) return true;
  }
  return false;
}

/** Cold start: model needs to be loaded onto a GPU — retry with longer delays */
function isColdStart(err: unknown): boolean {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (e.code === 'model_pending_deploy') return true;
    if (typeof e.message === 'string' && e.message.includes('not ready for inference')) return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stripThinking(content: string): string {
  const idx = content.lastIndexOf('</think>');
  if (idx !== -1) return content.slice(idx + 8).trim();
  return content.trim();
}

interface ClientOption {
  client: OpenAI;
  model: string;
  label: string; // for error logging
  provider: ModelCallProvider;
}

function getClients(): ClientOption[] {
  const clients: ClientOption[] = [];

  // Priority 1: Self-hosted (fastest, no network issues — best DX in China)
  const selfHostedUrl = process.env.CANTONESE_API_URL;
  if (selfHostedUrl) {
    const isLocal = selfHostedUrl.includes('localhost') || selfHostedUrl.includes('127.0.0.1');
    clients.push({
      client: new OpenAI({
        apiKey: process.env.CANTONESE_API_KEY || 'not-needed',
        baseURL: selfHostedUrl,
        timeout: isLocal ? 300000 : 60000,
      }),
      model: SELF_HOSTED_MODEL,
      label: 'self-hosted',
      provider: 'cantonese_self_hosted',
    });
  }

  // Priority 2: Featherless CantoneseLLMChat 32B — disabled (subscription not active)
  // To re-enable: set FEATHERLESS_API_KEY env var + uncomment below
  /*
  const featherlessKey = process.env.FEATHERLESS_API_KEY;
  if (featherlessKey) {
    clients.push({
      client: new OpenAI({
        apiKey: featherlessKey,
        baseURL: 'https://api.featherless.ai/v1',
        timeout: 15000,
      }),
      model: FEATHERLESS_MODEL,
      label: 'featherless',
      provider: 'featherless',
    });
  }
  */

  return clients;
}

async function callModel(
  client: OpenAI,
  model: string,
  provider: ModelCallProvider,
  userPrompt: string,
  temperature: number,
  context: ModelCallContext | undefined,
  attempt: number,
): Promise<DiagnoseGenerateResult> {
  return observeModelAttempt(context, {
    operation: 'generate',
    provider,
    model,
    attempt,
  }, async (captureUsage) => {
    const response = await client.chat.completions.create({
      model,
      max_tokens: 2200,
      temperature,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });
    captureUsage(response.usage);

    const raw = response.choices[0]?.message?.content ?? '';
    const content = stripThinking(raw);

    const result = parseJSON(content) as DiagnoseGenerateResult;

    if (
      !result?.diagnosis ||
      !result?.variants ||
      !result.variants.standardHK ||
      !result.variants.lightCantonese ||
      !result.variants.ig ||
      !result.variants.facebook ||
      !result.variants.shorts
    ) {
      throw new Error('Incomplete variants in response');
    }

    return result;
  });
}

export async function generateWithCantoneseLLM(
  params: GenerateRequest,
  context?: ModelCallContext,
): Promise<DiagnoseGenerateResult | null> {
  const clients = getClients();
  if (clients.length === 0) return null;

  const effectiveTone = params.primaryTone ?? params.tone;
  const temperature = TONE_TEMPERATURE[effectiveTone] ?? 0.7;

  const userPrompt = buildCantoneseLLMPrompt({
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

  // Try each available Cantonese client in priority order
  for (const { client, model, label, provider } of clients) {
    let coldStartRetries = 0;
    let regularRetries = 0;
    let providerAttempt = 1;

    while (true) {
      try {
        const result = await callModel(
          client,
          model,
          provider,
          userPrompt,
          temperature,
          context,
          providerAttempt,
        );
        console.log(`[Cantonese] ${label} succeeded`);
        return result;
      } catch (err) {
        // Cold start: model warming up — wait and retry with longer backoff
        if (isColdStart(err) && coldStartRetries < COLD_START_RETRIES) {
          const delay = COLD_START_DELAYS_MS[coldStartRetries] ?? 30000;
          console.warn(`[Cantonese] ${label} cold start (${coldStartRetries + 1}/${COLD_START_RETRIES}), waiting ${delay / 1000}s...`);
          coldStartRetries++;
          await sleep(delay);
          providerAttempt++;
          continue; // retry same client
        }

        // Fatal error (subscription expired / model gone): skip to next client
        if (isFatalError(err)) {
          const errMsg = (err as Record<string, unknown>).code || (err as Error).message;
          console.warn(`[Cantonese] ${label} fatal (${errMsg}), skipping...`);
          break;
        }

        if (!isRetryable(err) || regularRetries >= MAX_RETRIES) {
          console.warn(`[Cantonese] ${label} exhausted retries, trying next...`);
          break;
        }
        const delay = RETRY_DELAYS_MS[regularRetries] ?? 8000;
        regularRetries++;
        await sleep(delay);
        providerAttempt++;
      }
    }
  }

  console.warn('[Cantonese] All Cantonese clients failed, falling back to DeepSeek');
  return null;
}
