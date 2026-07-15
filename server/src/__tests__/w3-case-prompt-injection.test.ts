/**
 * W3 — Case library prompt injection (three engines + resolve + snapshot)
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  buildCantoneseLLMPrompt,
  buildDiagnoseGeneratePrompt,
  buildCalendarEventsSection,
} from '../prompts/diagnoseGenerate.js';
import { fallbackGenerate } from '../services/fallbackService.js';
import {
  normalizeSelectedCaseLibraryIds,
  resolveCaseLibraryContext,
  buildCaseLibraryPromptSection,
  buildCaseLibrarySnapshots,
  sanitizeCaseLibraryFieldsForPersistence,
  budgetReferenceCases,
  applyCaseLibraryStyle,
  deriveCaseLibraryStyleHints,
  CASE_LIBRARY_PROMPT_MARKERS,
  CASE_LIBRARY_PARTIAL_NOTICE,
  MAX_TOTAL_STYLE_CONTEXT,
  type CaseLibraryContextEntry,
} from '../services/caseLibraryContext.js';
import type { GenerateRequest, ReferenceCase } from '../types/index.js';

const GOOD_ID = '11111111-1111-4111-8111-111111111111';
const BAD_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';
const MISSING_ID = '44444444-4444-4444-8444-444444444444';

const GOOD_BODY =
  '講真，放工想歎杯好咖啡？我哋用慢烘豆，香氣啱晒香港午後——想試就留言話我知。';
const BAD_BODY = '宝子们！爆款来袭狠狠拿捏！闭眼入绝对不亏！！！全国包邮！';
const GOOD_REASON = '開場 hook 自然，CTA 軟而不硬';
const BAD_REASON = '內地硬廣腔，禁止模仿';

const goodEntry: CaseLibraryContextEntry = {
  id: GOOD_ID,
  caseType: 'good',
  title: '咖啡開場',
  body: GOOD_BODY,
  reason: GOOD_REASON,
  tags: ['hook', 'cta'],
};

const badEntry: CaseLibraryContextEntry = {
  id: BAD_ID,
  caseType: 'bad',
  title: '硬廣反面',
  body: BAD_BODY,
  reason: BAD_REASON,
  tags: ['硬廣'],
};

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

function makeQueryChain(terminal: {
  data?: unknown;
  error?: { message: string } | null;
}) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'is', 'in', 'order', 'limit', 'single']) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (v: unknown) => void) => {
    resolve({ data: terminal.data ?? null, error: terminal.error ?? null });
    return { catch: () => {} };
  };
  return chain;
}

describe('W3 normalizeSelectedCaseLibraryIds', () => {
  it('keeps order, de-dupes, caps at 3, drops non-UUID', () => {
    const ids = normalizeSelectedCaseLibraryIds([
      GOOD_ID,
      'not-a-uuid',
      BAD_ID,
      GOOD_ID,
      OTHER_ID,
      MISSING_ID,
      123,
      null,
    ]);
    expect(ids).toEqual([GOOD_ID, BAD_ID, OTHER_ID]);
  });

  it('returns empty for non-array / empty', () => {
    expect(normalizeSelectedCaseLibraryIds(undefined)).toEqual([]);
    expect(normalizeSelectedCaseLibraryIds('x')).toEqual([]);
    expect(normalizeSelectedCaseLibraryIds([])).toEqual([]);
  });
});

describe('W3 resolveCaseLibraryContext (owner-scoped)', () => {
  it('returns only owner non-deleted rows in request order; marks partial', async () => {
    const rows = [
      {
        id: BAD_ID,
        owner_id: 'user-001',
        case_type: 'bad',
        title: '硬廣反面',
        body: BAD_BODY,
        reason: BAD_REASON,
        tags: ['硬廣'],
        created_at: '2026-07-14T00:00:00.000Z',
        updated_at: '2026-07-14T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: GOOD_ID,
        owner_id: 'user-001',
        case_type: 'good',
        title: '咖啡開場',
        body: GOOD_BODY,
        reason: GOOD_REASON,
        tags: ['hook', 'cta'],
        created_at: '2026-07-14T00:00:00.000Z',
        updated_at: '2026-07-14T00:00:00.000Z',
        deleted_at: null,
      },
    ];

    const createUserClient = vi.fn(() => ({
      from: () => makeQueryChain({ data: rows, error: null }),
    }));

    // Request order: good, missing, bad → resolved good then bad; partial true
    const result = await resolveCaseLibraryContext(
      'user-001',
      'jwt-user',
      createUserClient as never,
      [GOOD_ID, MISSING_ID, BAD_ID],
    );

    expect(result.requestedIds).toEqual([GOOD_ID, MISSING_ID, BAD_ID]);
    expect(result.entries.map((e) => e.id)).toEqual([GOOD_ID, BAD_ID]);
    expect(result.partialUnavailable).toBe(true);
    expect(result.entries[0]!.body).toBe(GOOD_BODY);
    expect(createUserClient).toHaveBeenCalledWith('jwt-user');
  });

  it('foreign / empty result does not leak — empty entries + partial', async () => {
    const createUserClient = vi.fn(() => ({
      from: () => makeQueryChain({ data: [], error: null }),
    }));
    const result = await resolveCaseLibraryContext(
      'user-001',
      'jwt',
      createUserClient as never,
      [OTHER_ID],
    );
    expect(result.entries).toEqual([]);
    expect(result.partialUnavailable).toBe(true);
  });
});

describe('W3 shared prompt section + three engines', () => {
  it('omits case library section when no context', () => {
    expect(buildCaseLibraryPromptSection(undefined)).toBe('');
    expect(buildCaseLibraryPromptSection([])).toBe('');

    const deepseek = buildDiagnoseGeneratePrompt(base);
    const cantonese = buildCantoneseLLMPrompt(base);
    expect(deepseek).not.toContain(CASE_LIBRARY_PROMPT_MARKERS.good);
    expect(deepseek).not.toContain(CASE_LIBRARY_PROMPT_MARKERS.bad);
    expect(cantonese).not.toContain(CASE_LIBRARY_PROMPT_MARKERS.good);
  });

  it.each([
    ['DeepSeek', buildDiagnoseGeneratePrompt],
    ['CantoneseLLM', buildCantoneseLLMPrompt],
  ])(
    '%s includes equivalent good/bad structured constraints and anti-copy rules',
    (_name, buildPrompt) => {
      const prompt = buildPrompt({
        ...base,
        caseLibraryContext: [goodEntry, badEntry],
      });

      expect(prompt).toContain(CASE_LIBRARY_PROMPT_MARKERS.good);
      expect(prompt).toContain(CASE_LIBRARY_PROMPT_MARKERS.bad);
      expect(prompt).toContain(CASE_LIBRARY_PROMPT_MARKERS.safety);
      expect(prompt).toContain(CASE_LIBRARY_PROMPT_MARKERS.noCopyGood);
      expect(prompt).toContain(CASE_LIBRARY_PROMPT_MARKERS.noRepeatBad);
      expect(prompt).toContain(CASE_LIBRARY_PROMPT_MARKERS.notProductFacts);
      expect(prompt).toContain(CASE_LIBRARY_PROMPT_MARKERS.allPlatforms);
      expect(prompt).toContain(GOOD_BODY);
      expect(prompt).toContain(GOOD_REASON);
      expect(prompt).toContain(BAD_REASON);
      // all five platforms named in constraints
      expect(prompt).toMatch(/standardHK/);
      expect(prompt).toMatch(/shorts/);
    },
  );

  it('client-smuggled caseLibraryEntries without caseLibraryContext still ignored', () => {
    const smuggled = {
      ...base,
      caseLibraryEntries: [goodEntry, badEntry],
      selectedCaseLibraryIds: [GOOD_ID],
    } as GenerateRequest & {
      caseLibraryEntries: CaseLibraryContextEntry[];
      selectedCaseLibraryIds: string[];
    };
    const prompt = buildDiagnoseGeneratePrompt(smuggled);
    expect(prompt).not.toContain(GOOD_BODY);
    expect(prompt).not.toContain(BAD_BODY);
    expect(prompt).not.toContain(CASE_LIBRARY_PROMPT_MARKERS.good);
  });
});

describe('W3 rules fallback', () => {
  it('applies style cues without echoing case body', () => {
    const result = fallbackGenerate({
      ...base,
      caseLibraryContext: [goodEntry, badEntry],
    });
    const joined = JSON.stringify(result);
    expect(joined).not.toContain(GOOD_BODY);
    expect(joined).not.toContain(BAD_BODY);
    // style cues from good tags
    const variants = Object.values(result.variants);
    expect(variants).toHaveLength(5);
    for (const v of variants) {
      expect(v).toMatch(/講真|✨|留言/);
    }
    // avoid notes from bad reason in diagnosis issues
    const issues = result.diagnosis.issues.join(' ');
    expect(issues).toMatch(/避免|硬廣|內地/);
  });

  it('applyCaseLibraryStyle never pastes body', () => {
    const out = applyCaseLibraryStyle('產品今日登場。', [goodEntry, badEntry]);
    expect(out).not.toContain(GOOD_BODY);
    expect(out).not.toContain(BAD_BODY);
    expect(out).toContain('產品今日登場');
  });

  it('without cases, output matches baseline shape', () => {
    const a = fallbackGenerate(base);
    const b = fallbackGenerate({ ...base, caseLibraryContext: [] });
    expect(a.variants.ig).toBe(b.variants.ig);
  });
});

describe('W3 budget with reference cases', () => {
  it('case library priority: total context ≤ 5, library ≤ 3', () => {
    const refs: ReferenceCase[] = Array.from({ length: 5 }, (_, i) => ({
      id: `fav-${i}`,
      content: `收藏文案 ${i}`,
      rating: 5,
      reasonTags: ['hook'],
      variantKey: 'ig' as const,
    }));
    const with3 = budgetReferenceCases(3, refs);
    expect(with3).toHaveLength(MAX_TOTAL_STYLE_CONTEXT - 3);
    const with0 = budgetReferenceCases(0, refs);
    expect(with0).toHaveLength(Math.min(5, refs.length));
    // library slots are hard-capped at 3 even if count is higher
    const with5lib = budgetReferenceCases(5, refs);
    expect(with5lib).toHaveLength(MAX_TOTAL_STYLE_CONTEXT - 3);
  });
});

describe('W3 snapshots for history', () => {
  it('buildCaseLibrarySnapshots keeps min fields for historical interpretability', () => {
    const snaps = buildCaseLibrarySnapshots([goodEntry, badEntry]);
    expect(snaps).toEqual([
      {
        id: GOOD_ID,
        caseType: 'good',
        title: '咖啡開場',
        body: GOOD_BODY,
        reason: GOOD_REASON,
        tags: ['hook', 'cta'],
      },
      {
        id: BAD_ID,
        caseType: 'bad',
        title: '硬廣反面',
        body: BAD_BODY,
        reason: BAD_REASON,
        tags: ['硬廣'],
      },
    ]);
  });

  it('strips client-smuggled case bodies before the history brief is built', () => {
    const smuggled = sanitizeCaseLibraryFieldsForPersistence({
      source: 'safe source',
      caseLibraryEntries: [goodEntry],
      caseLibraryContext: [badEntry],
      resolvedCaseLibrarySnapshots: [goodEntry],
      workbenchSettings: {
        creativityLevel: 2,
        caseLibraryEntries: [goodEntry],
        caseLibraryContext: [badEntry],
        resolvedCaseLibrarySnapshots: [goodEntry],
      },
    });

    const serialized = JSON.stringify(smuggled);
    expect(serialized).not.toContain(GOOD_BODY);
    expect(serialized).not.toContain(BAD_BODY);
    expect(smuggled).toEqual({
      source: 'safe source',
      workbenchSettings: { creativityLevel: 2 },
    });
  });

  it('partial notice constant is generic (no existence leak)', () => {
    expect(CASE_LIBRARY_PARTIAL_NOTICE).toBe('部分已選案例不可用');
  });
});

describe('W3 calendar + reference cases no regression on all platforms', () => {
  it('calendar section still requires multi-platform fusion', () => {
    const section = buildCalendarEventsSection([
      {
        id: 'new-year',
        title: 'New Year',
        titleZh: '元旦',
        date: '01-01',
        applicableIndustries: ['retail'],
        angles: ['開年新開始'],
        narrativeHooks: ['新一年，新選擇'],
      },
    ]);
    expect(section).toContain('話題日曆');
    expect(section).toMatch(/IG|Facebook|Shorts|平台/);
  });

  it('reference cases + case library coexist in DeepSeek prompt', () => {
    const prompt = buildDiagnoseGeneratePrompt({
      ...base,
      caseLibraryContext: [goodEntry],
      referenceCases: [
        {
          id: 'favorite-1',
          content: '✨ 放工想輕鬆一下？即刻留言話我知！',
          rating: 5,
          reasonTags: ['hook', 'emoji', 'cta'],
          favoriteReason: '開場吸睛',
          variantKey: 'ig',
        },
      ],
    });
    expect(prompt).toContain(CASE_LIBRARY_PROMPT_MARKERS.good);
    expect(prompt).toContain('用戶收藏嘅正例案例');
    expect(prompt).toContain('✨ 放工想輕鬆一下');
    expect(prompt).toContain('每個平台版本');
  });
});

describe('W3 generate route accepts IDs only (source contract)', () => {
  it('generate route resolves selectedCaseLibraryIds and does not map client case bodies', () => {
    const generatePath = path.resolve(process.cwd(), 'src/routes/generate.ts');
    const alt = path.resolve(process.cwd(), 'server/src/routes/generate.ts');
    const file = fs.existsSync(generatePath) ? generatePath : alt;
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toMatch(/selectedCaseLibraryIds|resolveCaseLibraryContext/);
    expect(src).toMatch(/createUserClient/);
    // Must not trust client-supplied bodies field for prompt
    expect(src).not.toMatch(/obj\.caseLibraryEntries|body\.caseLibraryEntries/);
    expect(src).toContain('referenceCases');
  });
});

describe('W3 derive hints', () => {
  it('maps bad reason to avoid notes without body', () => {
    const h = deriveCaseLibraryStyleHints([badEntry]);
    expect(h.avoidNotes.some((n) => n.includes('避免'))).toBe(true);
    expect(JSON.stringify(h)).not.toContain(BAD_BODY);
  });
});
