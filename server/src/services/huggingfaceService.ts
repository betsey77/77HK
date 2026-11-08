// CantoneseLLM enhancement service.
// Primary: HuggingFace CantoneseLLMChat (when HF_API_KEY set + network accessible)
// Fallback: DeepSeek-powered Cantonese-native rewrite pass
// Never blocks the main flow — graceful degradation on any error.

import OpenAI from 'openai';
import type { Variants } from '../types/index.js';
import { DEEPSEEK_NON_THINKING, DEFAULT_DEEPSEEK_MODEL } from './modelPolicy.js';

const HF_MODEL_V1 = 'hon9kon9ize/CantoneseLLMChat-v1.0-32B';
const HF_MODEL_V05 = 'hon9kon9ize/CantoneseLLMChat-v0.5';
const TIMEOUT_MS = 15000;

// ============================================================
// Cantonese Native Enhancement Prompt (for DeepSeek fallback)
// ============================================================
const ENHANCE_SYSTEM = `You are a native Hong Kong Cantonese social media copywriter. Your job is to take a draft social media post and rewrite it to sound like it was written by a real Hong Kong person — someone who grew up speaking Cantonese, living in Hong Kong, consuming local media.

## Rules
1. Make it sound NATURAL — like a real HK friend texting or posting, not a brand copywriter
2. Use actual Hong Kong Cantonese expressions, word order, and rhythm
3. Replace any "written Chinese" phrasing with spoken Cantonese equivalents
4. Keep the exact same meaning, facts, and key selling points
5. Don't overdo particles (啦/喇/嘅/咁/呀) — real HK people don't stack them
6. Mix in English the way HK people naturally do (e.g., "check 下", "share 俾 friend", "唔使煩")
7. Maintain brand safety — don't add profanity, politics, or vulgar expressions
8. Output ONLY the rewritten text, no explanations, no markdown

## Examples of natural HK Cantonese phrasing:
- "呢個真係好正" not "這個真的很好"
- "用落超方便" not "使用起來非常方便"
- "平時出街必帶" not "日常外出必備"
- "真心推介俾大家" not "真誠推薦給大家"
- "價錢好合理" not "價格非常合理"
- "唔使諗咁多" not "不用考慮太多"

## Examples of natural HK English mixing:
- "呢個 look 好靚"
- "weekend 去試下"
- "share 俾身邊嘅人"
- "must-have item 嚟㗎"
- "性價比好高，值得入手"`;

const FEATHERLESS_MODEL = 'hon9kon9ize/CantoneseLLMChat-v1.0-32B';
const OPENROUTER_MODEL = 'qwen/qwen3.5-flash-02-23';

export interface EnhancementResult {
  suggestions: Record<string, string>;
  engine: 'featherless-cantonese' | 'cantonese-llm-chat' | 'openrouter-qwen' | 'deepseek-cantonese';
  model: string;
}

export async function enhanceWithCantoneseLLM(
  variants: Variants,
): Promise<EnhancementResult | null> {
  // 1. Try Featherless.ai + CantoneseLLMChat-v1.0-32B (best: real Cantonese model, accessible API)
  const flResult = await tryFeatherlessEnhancement(variants);
  if (flResult) {
    return {
      suggestions: flResult,
      engine: 'featherless-cantonese',
      model: FEATHERLESS_MODEL,
    };
  }

  // 2. Try HuggingFace CantoneseLLMChat (if network becomes available)
  const hfResult = await tryHFEnhancement(variants);
  if (hfResult) {
    return {
      suggestions: hfResult,
      engine: 'cantonese-llm-chat',
      model: process.env.HF_MODEL || HF_MODEL_V05,
    };
  }

  // 3. Try OpenRouter + Qwen
  const orResult = await tryOpenRouterEnhancement(variants);
  if (orResult) {
    return {
      suggestions: orResult,
      engine: 'openrouter-qwen',
      model: OPENROUTER_MODEL,
    };
  }

  // 4. Fallback: DeepSeek with Cantonese native prompt
  const dsResult = await tryDeepSeekEnhancement(variants);
  if (dsResult) {
    return {
      suggestions: dsResult,
      engine: 'deepseek-cantonese',
      model: `${process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL} (Cantonese native prompt)`,
    };
  }

  return null;
}

// ============================================================
// Featherless.ai + CantoneseLLMChat-v1.0-32B (best: real Cantonese model)
// ============================================================
async function tryFeatherlessEnhancement(variants: Variants): Promise<Record<string, string> | null> {
  const apiKey = process.env.FEATHERLESS_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.featherless.ai/v1',
  });

  const variantEntries = Object.entries(variants) as Array<[string, string]>;
  const enhanced: Record<string, string> = {};

  const results = await Promise.allSettled(
    variantEntries.map(async ([key, text]) => {
      try {
        const response = await client.chat.completions.create({
          model: FEATHERLESS_MODEL,
          max_tokens: 2048,
          temperature: 0.7,
          messages: [
            { role: 'system', content: ENHANCE_SYSTEM },
            { role: 'user', content: `Rewrite this social media post to sound like a native Hong Kong Cantonese speaker wrote it:\n\n${text}` },
          ],
        });
        const result = response.choices[0]?.message?.content?.trim();
        if (result) enhanced[key] = result;
      } catch { /* skip this variant */ }
    }),
  );

  const anySuccess = results.some((r) => r.status === 'fulfilled');
  return anySuccess && Object.keys(enhanced).length > 0 ? enhanced : null;
}

// ============================================================
// HuggingFace CantoneseLLMChat
// ============================================================
async function tryHFEnhancement(variants: Variants): Promise<Record<string, string> | null> {
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) return null;

  // Try v0.5 (smaller, faster) first, then v1.0-32B
  const model = process.env.HF_MODEL || HF_MODEL_V05;

  const variantEntries = Object.entries(variants) as Array<[string, string]>;
  const suggestions: Record<string, string> = {};

  const results = await Promise.allSettled(
    variantEntries.map(async ([key, text]) => {
      const enhanced = await callHFAPI(apiKey, text, model);
      if (enhanced) suggestions[key] = enhanced;
    }),
  );

  const anySuccess = results.some((r) => r.status === 'fulfilled');
  return anySuccess ? suggestions : null;
}

async function callHFAPI(apiKey: string, text: string, model: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: `<|system|>You are a Hong Kong Cantonese copy editor. Rewrite the following social media copy to sound more natural in Hong Kong Cantonese. Output only the rewritten text, no explanations.</s><|user|>${text}</s><|assistant|>`,
          parameters: { max_new_tokens: 1024, temperature: 0.7 },
        }),
        signal: controller.signal,
      },
    );

    clearTimeout(timeout);
    if (!response.ok) return null;

    const data = (await response.json()) as Array<{ generated_text?: string }>;
    const generated = data[0]?.generated_text ?? null;
    if (!generated) return null;

    const idx = generated.lastIndexOf('<|assistant|>');
    return idx !== -1 ? generated.slice(idx + '<|assistant|>'.length).trim() : generated;
  } catch {
    return null;
  }
}

// ============================================================
// OpenRouter + Qwen — Accessible Cantonese-capable model
// ============================================================
async function tryOpenRouterEnhancement(variants: Variants): Promise<Record<string, string> | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const variantEntries = Object.entries(variants) as Array<[string, string]>;
  const enhanced: Record<string, string> = {};

  const results = await Promise.allSettled(
    variantEntries.map(async ([key, text]) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            max_tokens: 2048,
            temperature: 0.8,
            messages: [
              { role: 'system', content: ENHANCE_SYSTEM },
              { role: 'user', content: `Rewrite this social media post to sound like a native Hong Kong Cantonese speaker wrote it:\n\n${text}` },
            ],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);
        if (!response.ok) return;

        const data = await response.json() as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const result = data.choices?.[0]?.message?.content?.trim();
        if (result) enhanced[key] = result;
      } catch { /* skip this variant */ }
    }),
  );

  const anySuccess = results.some((r) => r.status === 'fulfilled');
  return anySuccess && Object.keys(enhanced).length > 0 ? enhanced : null;
}

// ============================================================
// DeepSeek Fallback — Cantonese Native Enhancement Pass
// ============================================================
async function tryDeepSeekEnhancement(variants: Variants): Promise<Record<string, string> | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com',
  });

  const variantEntries = Object.entries(variants) as Array<[string, string]>;
  const enhanced: Record<string, string> = {};

  const results = await Promise.allSettled(
    variantEntries.map(async ([key, text]) => {
      try {
        const response = await client.chat.completions.create({
          model: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
          ...DEEPSEEK_NON_THINKING,
          max_tokens: 2048,
          temperature: 0.8,
          messages: [
            { role: 'system', content: ENHANCE_SYSTEM },
            { role: 'user', content: `Rewrite this social media post to sound like a native Hong Kong Cantonese speaker wrote it:\n\n${text}` },
          ],
        });
        const result = response.choices[0]?.message?.content?.trim();
        if (result) enhanced[key] = result;
      } catch { /* skip this variant */ }
    }),
  );

  const anySuccess = results.some((r) => r.status === 'fulfilled');
  return anySuccess && Object.keys(enhanced).length > 0 ? enhanced : null;
}
