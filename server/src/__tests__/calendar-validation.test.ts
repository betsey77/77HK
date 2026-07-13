/**
 * Calendar 5-platform coverage validation tests.
 *
 * Covers:
 * - Prompt contract: verify buildCalendarEventsSection includes the mandatory instruction
 * - Validation function: bounded, no-retries, no-quota-cost
 * - No-event case: returns all-clear without false positives
 * - All 3 engine paths: coverage check runs after generation (unit-tested via validateCalendarCoverage)
 * - Prompt output verification for DeepSeek and Cantonese LLM paths
 * - Fallback engine coverage contract
 */
import { describe, it, expect } from 'vitest';
import { validateCalendarCoverage, ensureCalendarCoverage, VARIANT_KEYS } from '../services/calendarValidation.js';
import { buildDiagnoseGeneratePrompt, buildCantoneseLLMPrompt, buildCalendarEventsSection } from '../prompts/diagnoseGenerate.js';
import { fallbackGenerate } from '../services/fallbackService.js';
import type { CalendarEvent, GenerateRequest } from '../types/index.js';

describe('validateCalendarCoverage — bounded, no-retries', () => {
  const sampleEvents = [
    { angles: ['暑假活动', '亲子时光'], narrativeHooks: ['放暑假啦！', '暑假唔知去边？'] },
  ];

  it('returns all-covered when no events are provided (no false alarm)', () => {
    const result = validateCalendarCoverage(
      { standardHK: '...', lightCantonese: '...', ig: '...', facebook: '...', shorts: '...' },
      undefined,
    );
    expect(result.allCovered).toBe(true);
    expect(result.missedVariants).toEqual([]);
    for (const key of VARIANT_KEYS) {
      expect(result.variantCoverage[key]).toBe(true);
    }
  });

  it('returns all-covered when events array is empty', () => {
    const result = validateCalendarCoverage(
      { standardHK: '...', lightCantonese: '...', ig: '...', facebook: '...', shorts: '...' },
      [],
    );
    expect(result.allCovered).toBe(true);
  });

  it('detects full 5-platform coverage', () => {
    const result = validateCalendarCoverage(
      {
        standardHK: '暑假活动精彩纷呈，带小朋友来体验亲子时光吧！',
        lightCantonese: '放暑假啦！亲子时光等紧你哋～',
        ig: '📸 暑假唔知去边？亲子时光打卡攻略来咗！',
        facebook: '暑假活动正式开始，为期两周的亲子时光不容错过。',
        shorts: '放暑假啦✨亲子时光就系而家！',
      },
      sampleEvents,
    );
    expect(result.allCovered).toBe(true);
    expect(result.missedVariants).toEqual([]);
    expect(result.variantCoverage).toEqual({
      standardHK: true,
      lightCantonese: true,
      ig: true,
      facebook: true,
      shorts: true,
    });
  });

  it('reports missed variants when coverage is incomplete', () => {
    const result = validateCalendarCoverage(
      {
        standardHK: '暑假活动！',
        lightCantonese: '欢迎来玩',
        ig: '打卡',
        facebook: '亲子时光',
        shorts: '放暑假啦',
      },
      sampleEvents,
    );
    // lightCantonese has "欢迎来玩" — no keyword from sampleEvents
    // ig has "打卡" — no keyword
    expect(result.allCovered).toBe(false);
    expect(result.missedVariants).toContain('lightCantonese');
    expect(result.missedVariants).toContain('ig');
  });

  it('substring matching catches angle fragments (≥3 chars only)', () => {
    const events = [
      { angles: ['国庆节'], narrativeHooks: [] },
    ];
    // "国庆节" is 3 chars — full keyword match
    // 2-char fragments like "国庆" alone won't match (prevents false positives)
    const result = validateCalendarCoverage(
      {
        standardHK: '庆祝国庆节快乐',  // contains full "国庆节"
        lightCantonese: '国庆节快乐',
        ig: '国庆节',
        facebook: '欢度国庆节',
        shorts: '庆祝国庆节！',
      },
      events,
    );
    expect(result.allCovered).toBe(true);
  });

  it('rejects 2-char false-positive matches', () => {
    const events = [
      { angles: ['国庆节'], narrativeHooks: [] },
    ];
    // "庆祝国庆" only has 2-char "国庆" which is too short for a confident match
    const result = validateCalendarCoverage(
      {
        standardHK: '庆祝国庆',
        lightCantonese: '国庆快乐',
        ig: '国庆',
        facebook: '欢度佳节',
        shorts: '快乐时光',
      },
      events,
    );
    expect(result.allCovered).toBe(false);
  });

  it('respects boundary — no infinite loop, no model call', () => {
    // This is a contract test: the function must return immediately
    // without any async operations or external calls.
    const start = Date.now();
    const result = validateCalendarCoverage(
      {
        standardHK: 'text '.repeat(1000),
        lightCantonese: 'text '.repeat(1000),
        ig: 'text '.repeat(1000),
        facebook: 'text '.repeat(1000),
        shorts: 'text '.repeat(1000),
      },
      [
        { angles: Array.from({ length: 100 }, (_, i) => `angle-${i}`), narrativeHooks: [] },
      ],
    );
    const elapsed = Date.now() - start;
    // Must complete in under 50ms even with large inputs (bounded).
    // In practice, this is typically <5ms.
    expect(elapsed).toBeLessThan(50);
    expect(result.allCovered).toBe(false);
  });

  it('empty variants object returns all missed', () => {
    const result = validateCalendarCoverage(
      {} as Record<string, string>,
      sampleEvents,
    );
    expect(result.allCovered).toBe(false);
    expect(result.missedVariants).toEqual([...VARIANT_KEYS]);
  });

  it('handles missing variant keys gracefully', () => {
    const result = validateCalendarCoverage(
      { standardHK: '暑假活动' } as Record<string, string>,
      sampleEvents,
    );
    expect(result.allCovered).toBe(false);
    expect(result.variantCoverage.standardHK).toBe(true);
    for (const key of ['lightCantonese', 'ig', 'facebook', 'shorts']) {
      expect(result.variantCoverage[key]).toBe(false);
    }
  });
});

describe('Calendar contract — prompt instruction presence', () => {
  // The prompt builder (buildCalendarEventsSection in diagnoseGenerate.ts)
  // must include the mandatory instruction text. This validates via a static
  // string check to prevent accidental deletion of the requirement.
  it('prompt contains mandatory 5-platform instruction', () => {
    // This is a documentation-adjacent contract test.
    // The actual instruction lives in diagnoseGenerate.ts:buildCalendarEventsSection.
    // We verify the expected instruction keywords are present in the codebase.
    const requiredPhrases = [
      '你必須將上述話題融入文案創作',
      '每個版本至少融入',
      '平台特性結合',
    ];

    // Read the file and verify the phrases exist
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../prompts/diagnoseGenerate.ts'),
      'utf-8',
    );

    for (const phrase of requiredPhrases) {
      expect(content).toContain(phrase);
    }
  });
});

// ============================================================
// Slice B: Prompt output verification — both prompt builders
// ============================================================

const SAMPLE_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'ev-1',
    date: '2026-07-15',
    title: 'Summer Sale',
    titleZh: '暑假大促销',
    applicableIndustries: ['零售', '餐饮'],
    angles: ['暑假活动正式开始', '夏日亲子时光'],
    narrativeHooks: ['放暑假啦！', '暑假唔知去边？', '亲子打卡攻略'],
    sensitivityNote: undefined,
  },
];

const BASE_PARAMS = {
  source: '新品上线推广',
  platform: 'all' as const,
  tone: '活潑' as const,
  cantoneseLevel: 4,
  englishMixingLevel: 1,
  creativityLevel: 2,
  inputLanguage: 'mandarin' as const,
};

describe('Calendar prompt — buildCalendarEventsSection output', () => {
  it('returns empty string when no events provided', () => {
    expect(buildCalendarEventsSection(undefined)).toBe('');
    expect(buildCalendarEventsSection([])).toBe('');
  });

  it('includes the mandatory 🚨 instruction when events are provided', () => {
    const section = buildCalendarEventsSection(SAMPLE_CALENDAR_EVENTS);
    expect(section).toContain('你必須將上述話題融入文案創作');
    expect(section).toContain('每個版本至少融入');
    expect(section).toContain('平台特性結合');
  });

  it('includes all 5 platform directives', () => {
    const section = buildCalendarEventsSection(SAMPLE_CALENDAR_EVENTS);
    expect(section).toContain('IG');
    expect(section).toContain('Facebook');
    expect(section).toContain('Shorts');
  });

  it('includes event title and hooks', () => {
    const section = buildCalendarEventsSection(SAMPLE_CALENDAR_EVENTS);
    expect(section).toContain('暑假大促销');
    expect(section).toContain('放暑假啦');
    expect(section).toContain('暑假唔知去边');
  });

  it('includes sensitivity note instruction', () => {
    const section = buildCalendarEventsSection(SAMPLE_CALENDAR_EVENTS);
    expect(section).toContain('敏感度提醒');
  });
});

describe('Calendar prompt — DeepSeek prompt builder includes calendar section', () => {
  it('includes calendar section when events are provided', () => {
    const prompt = buildDiagnoseGeneratePrompt({
      ...BASE_PARAMS,
      calendarEvents: SAMPLE_CALENDAR_EVENTS,
    });
    expect(prompt).toContain('話題日曆借勢建議');
    expect(prompt).toContain('你必須將上述話題融入文案創作');
  });

  it('does NOT include calendar section when no events', () => {
    const prompt = buildDiagnoseGeneratePrompt({
      ...BASE_PARAMS,
      calendarEvents: undefined,
    });
    expect(prompt).not.toContain('話題日曆借勢建議');
    expect(prompt).not.toContain('你必須將上述話題融入文案創作');
  });
});

describe('Calendar prompt — Cantonese LLM prompt builder includes calendar section', () => {
  it('includes calendar section when events are provided', () => {
    const prompt = buildCantoneseLLMPrompt({
      ...BASE_PARAMS,
      calendarEvents: SAMPLE_CALENDAR_EVENTS,
    });
    expect(prompt).toContain('話題日曆借勢建議');
    expect(prompt).toContain('你必須將上述話題融入文案創作');
  });

  it('does NOT include calendar section when no events', () => {
    const prompt = buildCantoneseLLMPrompt({
      ...BASE_PARAMS,
      calendarEvents: undefined,
    });
    expect(prompt).not.toContain('話題日曆借勢建議');
  });
});

// ============================================================
// Slice B: Fallback engine coverage contract
// ============================================================

describe('Calendar — fallback engine (rules) coverage', () => {
  it('fallbackGenerate produces 5-platform variants', () => {
    const params: GenerateRequest = {
      source: '暑假促销活动',
      platform: 'all',
      tone: '活潑',
      cantoneseLevel: 4,
      englishMixingLevel: 1,
      creativityLevel: 2,
      inputLanguage: 'mandarin',
      useEnhancement: false,
    };
    const result = fallbackGenerate(params);
    expect(result.variants.standardHK).toBeTruthy();
    expect(result.variants.lightCantonese).toBeTruthy();
    expect(result.variants.ig).toBeTruthy();
    expect(result.variants.facebook).toBeTruthy();
    expect(result.variants.shorts).toBeTruthy();
  });

  it('fallback engine variants are validated by coverage check', () => {
    const params: GenerateRequest = {
      source: '暑假促销活动',
      platform: 'all',
      tone: '活潑',
      cantoneseLevel: 4,
      englishMixingLevel: 1,
      creativityLevel: 2,
      inputLanguage: 'mandarin',
      useEnhancement: false,
    };
    const result = fallbackGenerate(params);
    const variants = result.variants as unknown as Record<string, string>;

    // Coverage check on fallback output — should complete without error
    const coverage = validateCalendarCoverage(
      variants,
      SAMPLE_CALENDAR_EVENTS,
    );

    // Coverage is expected — it's a non-blocking observability check
    expect(typeof coverage.allCovered).toBe('boolean');
    expect(Array.isArray(coverage.missedVariants)).toBe(true);
    expect(Object.keys(coverage.variantCoverage).sort()).toEqual(
      [...VARIANT_KEYS].sort(),
    );
  });

  it('no-event case: fallback output passes coverage trivially', () => {
    const params: GenerateRequest = {
      source: '暑假促销活动',
      platform: 'all',
      tone: '活潑',
      cantoneseLevel: 4,
      englishMixingLevel: 1,
      creativityLevel: 2,
      inputLanguage: 'mandarin',
      useEnhancement: false,
    };
    const result = fallbackGenerate(params);
    const coverage = validateCalendarCoverage(
      result.variants as unknown as Record<string, string>,
      undefined,
    );
    expect(coverage.allCovered).toBe(true);
    expect(coverage.missedVariants).toEqual([]);
  });
});

// ============================================================
// ensureCalendarCoverage — enforcement with deterministic bridges
// ============================================================

describe('ensureCalendarCoverage — deterministic enforcement', () => {
  const sampleEvents = [
    {
      titleZh: '暑假大促销',
      angles: ['暑假活动正式开始', '夏日亲子时光'],
      narrativeHooks: ['放暑假啦！', '暑假唔知去边？', '亲子打卡攻略'],
    },
  ];

  it('returns original when no events provided', () => {
    const original = {
      standardHK: '欢迎光临',
      lightCantonese: '歡迎嚟玩',
      ig: '打卡打卡',
      facebook: '分享给朋友',
      shorts: '即睇',
    };
    const result = ensureCalendarCoverage(original, undefined);
    expect(result).toEqual(original);
  });

  it('returns original when events array is empty', () => {
    const original = {
      standardHK: '欢迎光临',
      lightCantonese: '歡迎嚟玩',
      ig: '打卡',
      facebook: '分享',
      shorts: '睇',
    };
    const result = ensureCalendarCoverage(original, []);
    expect(result).toEqual(original);
  });

  it('returns original when all 5 platforms already covered', () => {
    const original = {
      standardHK: '暑假活动精彩纷呈，带小朋友来体验亲子时光吧！',
      lightCantonese: '放暑假啦！亲子时光等紧你哋～',
      ig: '📸 暑假唔知去边？亲子时光打卡攻略来咗！',
      facebook: '暑假活动正式开始，为期两周的亲子时光不容错过。',
      shorts: '放暑假啦✨亲子时光就系而家！',
    };
    const result = ensureCalendarCoverage(original, sampleEvents);
    expect(result).toEqual(original);
  });

  it('patches only shorts when only shorts is hit (other 4 get bridges)', () => {
    const original: Record<string, string> = {
      standardHK: '欢迎光临',
      lightCantonese: '歡迎嚟玩',
      ig: '打卡打卡',
      facebook: '分享给朋友',
      shorts: '放暑假啦！亲子时光就系而家！', // only this has a keyword
    };
    const result = ensureCalendarCoverage(original, sampleEvents);

    // shorts should be unchanged (already has coverage)
    expect(result.shorts).toBe(original.shorts);

    // other 4 should have been patched
    for (const key of ['standardHK', 'lightCantonese', 'ig', 'facebook']) {
      expect(result[key]).not.toBe(original[key]);
      expect(result[key].length).toBeGreaterThan(original[key].length);
      // The patched text should contain the original
      expect(result[key]).toContain(original[key]);
      // The patched text should reference the event
      expect(result[key]).toContain('暑假');
    }
  });

  it('all 5 keys exist in result', () => {
    const result = ensureCalendarCoverage(
      {
        standardHK: 'hello',
        lightCantonese: 'hello',
        ig: 'hello',
        facebook: 'hello',
        shorts: 'hello',
      },
      sampleEvents,
    );
    for (const key of VARIANT_KEYS) {
      expect(result).toHaveProperty(key);
      expect(typeof result[key]).toBe('string');
    }
  });

  it('patched variants are validated as covered on re-check', () => {
    const original = {
      standardHK: '欢迎光临',
      lightCantonese: '歡迎嚟玩',
      ig: '打卡打卡',
      facebook: '分享给朋友',
      shorts: '放暑假啦！',
    };
    const result = ensureCalendarCoverage(original, sampleEvents);

    // Re-validate — all should be covered now
    const coverage = validateCalendarCoverage(result, sampleEvents);
    expect(coverage.allCovered).toBe(true);
    expect(coverage.missedVariants).toEqual([]);
  });

  it('does not modify when no events (passthrough with deep equality)', () => {
    const original = {
      standardHK: 'text',
      lightCantonese: 'text',
      ig: 'text',
      facebook: 'text',
      shorts: 'text',
    };
    const result = ensureCalendarCoverage(original, undefined);
    expect(result).toEqual(original); // deep equality — same content
  });

  it('each variant key gets a non-empty string', () => {
    const result = ensureCalendarCoverage(
      {} as Record<string, string>,
      sampleEvents,
    );
    for (const key of VARIANT_KEYS) {
      expect(result[key]).toBeTruthy();
      expect(result[key].length).toBeGreaterThan(0);
    }
  });

  it('bridge sentences differ across platforms', () => {
    const original = {
      standardHK: 'x',
      lightCantonese: 'x',
      ig: 'x',
      facebook: 'x',
      shorts: 'x',
    };
    const result = ensureCalendarCoverage(original, sampleEvents);

    // All bridge sentences should be distinct (platform-appropriate)
    const bridges = Object.fromEntries(
      VARIANT_KEYS.map((k) => [k, result[k].replace('x\n\n', '')]),
    );
    const unique = new Set(Object.values(bridges));
    expect(unique.size).toBe(5);
  });

  it('shorts gets a short punchy bridge', () => {
    const original = {
      standardHK: 'x',
      lightCantonese: 'x',
      ig: 'x',
      facebook: 'x',
      shorts: 'x',
    };
    const result = ensureCalendarCoverage(original, sampleEvents);
    const shortsBridge = result.shorts.replace('x\n\n', '');
    // Shorts bridge should be very short
    expect(shortsBridge.length).toBeLessThan(40);
  });

  it('handles multi-event input using first event for bridges', () => {
    const multiEvents = [
      {
        titleZh: '暑假大促销',
        angles: ['暑假活动正式开始'],
        narrativeHooks: ['放暑假啦！'],
      },
      {
        titleZh: '中秋节',
        angles: ['中秋月饼'],
        narrativeHooks: ['中秋快乐！'],
      },
    ];
    const result = ensureCalendarCoverage(
      {
        standardHK: 'hello',
        lightCantonese: 'hello',
        ig: 'hello',
        facebook: 'hello',
        shorts: 'hello',
      },
      multiEvents,
    );
    // First event used for bridges
    expect(result.standardHK).toContain('暑假');
    expect(result.standardHK).not.toContain('中秋');
  });
});

// ============================================================
// Regression: ensureCalendarCoverage must run BEFORE audit/consumerFeedback
// ============================================================

describe('Calendar — generate route ordering (regression guard)', () => {
  it('ensureCalendarCoverage is called before audit() in generate.ts', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../routes/generate.ts'),
      'utf-8',
    );

    // Find the position of key function calls
    const ensurePos = content.indexOf('ensureCalendarCoverage(variantsBefore');
    const auditCallPos = content.indexOf('audit(validatedGen.variants');
    const consumerFeedbackPos = content.indexOf('generateConsumerFeedback(');

    // ensureCalendarCoverage must appear in the file
    expect(ensurePos).toBeGreaterThan(0);
    // audit call must exist (using validatedGen.variants, not generateResult.variants)
    expect(auditCallPos).toBeGreaterThan(0);
    // consumerFeedback call must exist (using validatedGen.variants)
    expect(consumerFeedbackPos).toBeGreaterThan(0);

    // ensureCalendarCoverage must come BEFORE both audit and consumerFeedback
    expect(ensurePos).toBeLessThan(auditCallPos);
    expect(ensurePos).toBeLessThan(consumerFeedbackPos);
  });

  it('generate.ts does NOT contain "audit based on pre-patch" disclaimer (no longer needed)', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../routes/generate.ts'),
      'utf-8',
    );
    // The old disclaimer about audit being based on pre-patch variants is removed
    expect(content).not.toContain('audit scores are based on pre-patch');
  });

  it('audit() receives validatedGen.variants (not raw generateResult.variants)', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(
      path.resolve(__dirname, '../routes/generate.ts'),
      'utf-8',
    );
    // The audit call must use the patched variants
    expect(content).toContain('audit(validatedGen.variants');
    // Must NOT use the raw unpatched variants for audit
    expect(content).not.toContain('audit(generateResult.variants');
  });
});
