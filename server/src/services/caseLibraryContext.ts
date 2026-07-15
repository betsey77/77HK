/**
 * W3 — Case library context resolution + shared prompt/fallback constraints.
 *
 * Client only sends selectedCaseLibraryIds (max 3 UUIDs).
 * Server resolves rows with the user JWT Supabase client (RLS, never service role).
 * DeepSeek / CantoneseLLM / rules fallback share the same structured builder.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  CASE_LIBRARY_LIMITS,
  isUuid,
  type CaseLibraryRecord,
  type CaseType,
  type CreateUserClient,
} from './caseLibraryService.js';
import type { ReferenceCase } from '../types/index.js';

/** Max total context items: case library (≤3) + reference bookmarks. */
export const MAX_TOTAL_STYLE_CONTEXT = 5;

/** Structured snapshot used in prompt + generation history brief. */
export interface CaseLibraryContextEntry {
  id: string;
  caseType: CaseType;
  title: string | null;
  body: string;
  reason: string;
  tags: string[];
}

export interface ResolveCaseLibraryResult {
  /** Rows actually resolved for this request (owner, not soft-deleted). */
  entries: CaseLibraryContextEntry[];
  /** Valid UUID ids requested after normalize (≤3, order preserved, de-duped). */
  requestedIds: string[];
  /** True when some requested IDs were missing / foreign / deleted / non-uuid. */
  partialUnavailable: boolean;
}

export type CreateUserClientFn = CreateUserClient;

/**
 * Normalize client-selected IDs: keep order, drop non-UUID / dups, cap at 3.
 * Does not throw — invalid entries are ignored (no existence leak).
 */
export function normalizeSelectedCaseLibraryIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const id = item.trim();
    if (!isUuid(id)) continue;
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(id);
    if (out.length >= CASE_LIBRARY_LIMITS.maxSelectedPerGenerate) break;
  }
  return out;
}

export function toCaseLibraryContextEntry(row: CaseLibraryRecord): CaseLibraryContextEntry {
  return {
    id: row.id,
    caseType: row.case_type,
    title: row.title,
    body: row.body,
    reason: row.reason,
    tags: Array.isArray(row.tags) ? row.tags : [],
  };
}

/**
 * Owner-scoped resolve via user JWT client.
 * Missing / other-owner / soft-deleted IDs simply do not return rows (RLS + filters).
 */
export async function resolveCaseLibraryContext(
  userId: string,
  userJwt: string,
  createUserClient: CreateUserClientFn,
  selectedIds: unknown,
): Promise<ResolveCaseLibraryResult> {
  const requestedIds = normalizeSelectedCaseLibraryIds(selectedIds);
  if (requestedIds.length === 0) {
    return { entries: [], requestedIds: [], partialUnavailable: false };
  }

  const client = createUserClient(userJwt);
  const { data, error } = await client
    .from('case_library_entries')
    .select('*')
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .in('id', requestedIds);

  if (error) {
    // Soft-fail: do not block generation; treat as unavailable.
    console.warn('[CaseLibraryContext] resolve failed:', error.message);
    return {
      entries: [],
      requestedIds,
      partialUnavailable: requestedIds.length > 0,
    };
  }

  const rows = (data ?? []) as CaseLibraryRecord[];
  const byId = new Map(rows.map((r) => [r.id.toLowerCase(), r]));

  // Preserve request order
  const entries: CaseLibraryContextEntry[] = [];
  for (const id of requestedIds) {
    const row = byId.get(id.toLowerCase());
    if (row) entries.push(toCaseLibraryContextEntry(row));
  }

  return {
    entries,
    requestedIds,
    partialUnavailable: entries.length < requestedIds.length,
  };
}

/**
 * Case library takes priority; remaining budget (max 5 total) for reference bookmarks.
 */
export function budgetReferenceCases(
  caseLibraryCount: number,
  referenceCases: ReferenceCase[] | undefined,
): ReferenceCase[] | undefined {
  if (!referenceCases || referenceCases.length === 0) return undefined;
  const librarySlots = Math.min(
    Math.max(0, caseLibraryCount),
    CASE_LIBRARY_LIMITS.maxSelectedPerGenerate,
  );
  const remaining = Math.max(0, MAX_TOTAL_STYLE_CONTEXT - librarySlots);
  if (remaining === 0) return undefined;
  const sliced = referenceCases.slice(0, remaining);
  return sliced.length > 0 ? sliced : undefined;
}

/** Minimal snapshot for generation_jobs.brief (historical interpretability). */
export function buildCaseLibrarySnapshots(
  entries: CaseLibraryContextEntry[],
): CaseLibraryContextEntry[] {
  return entries.map((e) => ({
    id: e.id,
    caseType: e.caseType,
    title: e.title,
    body: e.body,
    reason: e.reason,
    tags: [...e.tags],
  }));
}

/**
 * Remove client-supplied case-library payloads before persisting a generation
 * brief. The route replaces these fields with snapshots built from rows that
 * were actually resolved through the caller's JWT/RLS scope.
 */
export function sanitizeCaseLibraryFieldsForPersistence(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const {
    caseLibraryEntries: _caseLibraryEntries,
    caseLibraryContext: _caseLibraryContext,
    resolvedCaseLibrarySnapshots: _resolvedCaseLibrarySnapshots,
    workbenchSettings,
    ...safeRaw
  } = raw;

  if (!workbenchSettings || typeof workbenchSettings !== 'object' || Array.isArray(workbenchSettings)) {
    return safeRaw;
  }

  const {
    caseLibraryEntries: _workbenchCaseLibraryEntries,
    caseLibraryContext: _workbenchCaseLibraryContext,
    resolvedCaseLibrarySnapshots: _workbenchResolvedCaseLibrarySnapshots,
    ...safeWorkbench
  } = workbenchSettings as Record<string, unknown>;

  return { ...safeRaw, workbenchSettings: safeWorkbench };
}

const GOOD_MARKER = '## 個人案例庫 · 正例技法參考';
const BAD_MARKER = '## 個人案例庫 · 反例負向約束';
const SAFETY_MARKER = '學技法，唔好抄內容';

export const CASE_LIBRARY_PROMPT_MARKERS = {
  good: GOOD_MARKER,
  bad: BAD_MARKER,
  safety: SAFETY_MARKER,
  noCopyGood: '禁止逐句複製',
  noRepeatBad: '禁止復述、模仿或反向拼接反例正文',
  notProductFacts: '唔好把案例標題或正文當成用戶當前產品資料',
  allPlatforms: '每個平台版本',
} as const;

/**
 * Shared structured prompt section for DeepSeek + CantoneseLLM.
 * Bodies/reasons are present for model analysis, with explicit anti-copy rules.
 */
export function buildCaseLibraryPromptSection(
  entries: CaseLibraryContextEntry[] | undefined,
): string {
  if (!entries || entries.length === 0) return '';

  const goods = entries.filter((e) => e.caseType === 'good');
  const bads = entries.filter((e) => e.caseType === 'bad');

  const parts: string[] = [];

  if (goods.length > 0) {
    const blocks = goods
      .map((e, i) => {
        const title = e.title?.trim() || `正例 ${i + 1}`;
        const tags = e.tags.length > 0 ? e.tags.join('、') : '（無）';
        return `### 正例 ${i + 1}：${title}
標籤：${tags}
用戶選作正例的原因：${e.reason}

結構化案例正文（僅供技法分析，禁止照抄）：
"""
${e.body}
"""

**技法抽取（必須做，然後落地到五個平台版本）**：
- Hook 類型與開場節奏
- 整體結構（信息順序、段落節奏）
- 句式節奏（短句 / 長句 / 混合）
- 表達氛圍與情緒技巧
- CTA 或互動引導方式`;
      })
      .join('\n\n');

    parts.push(`${GOOD_MARKER}

以下係用戶從個人案例庫勾選嘅**正例**。請**${SAFETY_MARKER}**：

${blocks}

---
**正例安全規則（全部平台版本必須遵守）**：
- ${CASE_LIBRARY_PROMPT_MARKERS.noCopyGood}、整段搬運或近義改寫正例正文
- 禁止復述正例中的專有事實、品牌名、促銷承諾，或把示例嘅優惠當成當前品牌事實
- ${CASE_LIBRARY_PROMPT_MARKERS.notProductFacts}
- ${CASE_LIBRARY_PROMPT_MARKERS.allPlatforms}（standardHK / lightCantonese / ig / facebook / shorts）都要受正例技法影響，唔可以只喺 Shorts/TK 提一句
- 學嘅係結構、節奏、氛圍同 CTA 技巧，唔係主題內容`);
  }

  if (bads.length > 0) {
    const blocks = bads
      .map((e, i) => {
        const title = e.title?.trim() || `反例 ${i + 1}`;
        const tags = e.tags.length > 0 ? e.tags.join('、') : '（無）';
        return `### 反例 ${i + 1}：${title}
標籤：${tags}
用戶標註的問題原因（轉為負向約束）：${e.reason}

反例正文（僅用於理解「唔好點做」——禁止輸出中復述）：
"""
${e.body}
"""`;
      })
      .join('\n\n');

    parts.push(`${BAD_MARKER}

以下係用戶勾選嘅**反例**。請把「原因」轉成清晰嘅負向約束，並喺**全部五個平台版本**避免：

${blocks}

---
**反例安全規則（全部平台版本必須遵守）**：
- ${CASE_LIBRARY_PROMPT_MARKERS.noRepeatBad}
- 禁止模仿反例嘅失敗句式、硬廣腔或用戶點名的問題模式
- 以 reason 為準建立「避免清單」；唔好把反例標題當作品牌或產品資訊
- ${CASE_LIBRARY_PROMPT_MARKERS.allPlatforms} 都要遵守，唔可以只約束單一平台`);
  }

  return parts.join('\n\n');
}

/**
 * Rules-engine style cues derived from cases — NEVER echo body/title verbatim.
 * Positive → lightweight presentation hints from tags/reason keywords.
 * Negative → explicit avoid notes only via diagnosis, not body paste.
 */
export function deriveCaseLibraryStyleHints(
  entries: CaseLibraryContextEntry[] | undefined,
): {
  wantsHook: boolean;
  wantsEmoji: boolean;
  wantsCta: boolean;
  wantsSoft: boolean;
  avoidNotes: string[];
} {
  const empty = {
    wantsHook: false,
    wantsEmoji: false,
    wantsCta: false,
    wantsSoft: false,
    avoidNotes: [] as string[],
  };
  if (!entries || entries.length === 0) return empty;

  let wantsHook = false;
  let wantsEmoji = false;
  let wantsCta = false;
  let wantsSoft = false;
  const avoidNotes: string[] = [];

  for (const e of entries) {
    const signal = `${e.reason} ${(e.tags ?? []).join(' ')}`.toLowerCase();
    if (e.caseType === 'good') {
      if (/hook|開場|吸睛|反問|開頭/.test(signal)) wantsHook = true;
      if (/emoji|表情/.test(signal)) wantsEmoji = true;
      if (/cta|留言|行動|互動|導流/.test(signal)) wantsCta = true;
      if (/節奏|結構|句式|氛圍|溫暖|親切|街坊/.test(signal)) wantsSoft = true;
      // Default positive: mild soft cue when no tag matched
      if (!wantsHook && !wantsEmoji && !wantsCta) wantsSoft = true;
    } else {
      // Negative: reason → avoid note (never body)
      const reason = e.reason.trim().slice(0, 80);
      if (reason) {
        avoidNotes.push(`避免：${reason}`);
      }
      if (/硬廣|硬卖|硬賣|喊買|轟炸/.test(signal)) {
        avoidNotes.push('避免硬廣式喊買與密集促銷句');
      }
      if (/內地|寶子|种草|種草|爆款/.test(signal)) {
        avoidNotes.push('避免內地社群電商腔');
      }
    }
  }

  // de-dupe avoid notes
  const uniqueAvoid = [...new Set(avoidNotes)].slice(0, 4);
  return { wantsHook, wantsEmoji, wantsCta, wantsSoft, avoidNotes: uniqueAvoid };
}

/**
 * Apply non-copying style hints to a variant string (rules fallback).
 * Must never include case body text.
 */
export function applyCaseLibraryStyle(
  text: string,
  entries: CaseLibraryContextEntry[] | undefined,
): string {
  const hints = deriveCaseLibraryStyleHints(entries);
  if (!entries || entries.length === 0) return text;

  let styled = text;
  if (hints.wantsHook && !/^講真[，,]/.test(styled)) {
    styled = `講真，${styled}`;
  }
  if (hints.wantsEmoji && !/\p{Extended_Pictographic}/u.test(styled)) {
    styled = `✨ ${styled}`;
  }
  if (hints.wantsCta && !/留言/.test(styled)) {
    styled = `${styled}\n\n想知多啲？留言話我知。`;
  }
  if (hints.wantsSoft && !hints.wantsHook && !/^各位/.test(styled)) {
    // Mild pacing cue without copying any case body
    styled = styled.replace(/\n\n/g, '\n');
  }
  return styled;
}

/** For tests / route: user-visible generic notice (no existence leak). */
export const CASE_LIBRARY_PARTIAL_NOTICE = '部分已選案例不可用';
