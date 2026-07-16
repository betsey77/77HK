/**
 * W2 — Personal case library service.
 *
 * Owner-scoped CRUD over public.case_library_entries.
 * Soft-delete only. Prompt injection of resolved cases is W3 (caseLibraryContext).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type CaseType = 'good' | 'bad';

export const VALID_CASE_TYPES: readonly CaseType[] = ['good', 'bad'] as const;

export const CASE_LIBRARY_LIMITS = {
  titleMax: 120,
  bodyMin: 20,
  bodyMax: 5000,
  reasonMin: 1,
  reasonMax: 500,
  tagsMax: 8,
  tagMin: 1,
  tagMax: 30,
  maxSelectedPerGenerate: 3,
} as const;

export interface CaseLibraryInput {
  caseType: CaseType;
  title?: string | null;
  body: string;
  reason: string;
  tags?: string[];
}

export interface CaseLibraryRecord {
  id: string;
  owner_id: string;
  case_type: CaseType;
  title: string | null;
  body: string;
  reason: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CaseLibraryDto {
  id: string;
  caseType: CaseType;
  title: string | null;
  body: string;
  reason: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type CreateUserClient = (jwt: string) => SupabaseClient;

export class CaseLibraryHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CaseLibraryHttpError';
  }
}

function httpError(status: number, message: string): CaseLibraryHttpError {
  return new CaseLibraryHttpError(status, message);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Client display name only — never written back to DB. */
export function deriveCaseDisplayName(
  caseType: CaseType,
  title: string | null | undefined,
): string {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (trimmed) return trimmed;
  return caseType === 'good' ? '未命名正例' : '未命名反例';
}

/** First 24 chars of body as secondary summary (client/display helper). */
export function deriveCaseBodyPreview(body: string, max = 24): string {
  const text = body.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function normalizeTags(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw httpError(400, 'tags must be an array of strings');
  }
  if (raw.length > CASE_LIBRARY_LIMITS.tagsMax) {
    throw httpError(400, `tags must have at most ${CASE_LIBRARY_LIMITS.tagsMax} items`);
  }
  const tags: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      throw httpError(400, 'each tag must be a string');
    }
    const tag = item.trim();
    if (tag.length < CASE_LIBRARY_LIMITS.tagMin || tag.length > CASE_LIBRARY_LIMITS.tagMax) {
      throw httpError(
        400,
        `each tag must be ${CASE_LIBRARY_LIMITS.tagMin}–${CASE_LIBRARY_LIMITS.tagMax} characters`,
      );
    }
    tags.push(tag);
  }
  return tags;
}

export function validateCaseLibraryInput(body: unknown): CaseLibraryInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'Request body must be a JSON object');
  }
  const b = body as Record<string, unknown>;

  if (typeof b.caseType !== 'string' || !VALID_CASE_TYPES.includes(b.caseType as CaseType)) {
    throw httpError(400, "caseType must be 'good' or 'bad'");
  }
  const caseType = b.caseType as CaseType;

  let title: string | null = null;
  if (b.title !== undefined && b.title !== null) {
    if (typeof b.title !== 'string') {
      throw httpError(400, 'title must be a string when provided');
    }
    const t = b.title.trim();
    if (t.length > CASE_LIBRARY_LIMITS.titleMax) {
      throw httpError(400, `title must be at most ${CASE_LIBRARY_LIMITS.titleMax} characters`);
    }
    title = t.length === 0 ? null : t;
  }

  if (typeof b.body !== 'string') {
    throw httpError(400, 'body is required');
  }
  const bodyText = b.body.trim();
  if (
    bodyText.length < CASE_LIBRARY_LIMITS.bodyMin ||
    bodyText.length > CASE_LIBRARY_LIMITS.bodyMax
  ) {
    throw httpError(
      400,
      `body must be ${CASE_LIBRARY_LIMITS.bodyMin}–${CASE_LIBRARY_LIMITS.bodyMax} characters`,
    );
  }

  if (typeof b.reason !== 'string') {
    throw httpError(400, 'reason is required');
  }
  const reason = b.reason.trim();
  if (
    reason.length < CASE_LIBRARY_LIMITS.reasonMin ||
    reason.length > CASE_LIBRARY_LIMITS.reasonMax
  ) {
    throw httpError(
      400,
      `reason must be ${CASE_LIBRARY_LIMITS.reasonMin}–${CASE_LIBRARY_LIMITS.reasonMax} characters`,
    );
  }

  const tags = normalizeTags(b.tags);

  return { caseType, title, body: bodyText, reason, tags };
}

export function toCaseLibraryDto(row: CaseLibraryRecord): CaseLibraryDto {
  return {
    id: row.id,
    caseType: row.case_type,
    title: row.title,
    body: row.body,
    reason: row.reason,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCaseLibrary(
  userId: string,
  userJwt: string,
  createUserClient: CreateUserClient,
  options: { query?: string; caseType?: CaseType } = {},
): Promise<CaseLibraryDto[]> {
  const client = createUserClient(userJwt);
  let q = client
    .from('case_library_entries')
    .select('*')
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (options.caseType) {
    q = q.eq('case_type', options.caseType);
  }

  const { data, error } = await q;
  if (error) {
    throw httpError(500, 'Internal server error');
  }

  let rows = (data ?? []) as CaseLibraryRecord[];

  const query = options.query?.trim().toLowerCase();
  if (query) {
    rows = rows.filter((row) => {
      const hay = [
        row.title ?? '',
        row.body,
        row.reason,
        ...(Array.isArray(row.tags) ? row.tags : []),
        row.case_type,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }

  return rows.map(toCaseLibraryDto);
}

export async function createCaseLibraryEntry(
  userId: string,
  userJwt: string,
  createUserClient: CreateUserClient,
  input: CaseLibraryInput,
): Promise<CaseLibraryDto> {
  const client = createUserClient(userJwt);
  const { data, error } = await client
    .from('case_library_entries')
    .insert({
      owner_id: userId,
      case_type: input.caseType,
      title: input.title ?? null,
      body: input.body,
      reason: input.reason,
      tags: input.tags ?? [],
    })
    .select('*')
    .single();

  if (error || !data) {
    // Surface safe, actionable classes without leaking schema internals.
    const msg = (error?.message ?? '').toLowerCase();
    if (msg.includes('permission denied') && msg.includes('case_library_tags_valid')) {
      throw httpError(
        500,
        '案例库暂时无法保存（标签校验权限未就绪）。请联系管理员应用最新数据库修复。',
      );
    }
    if (msg.includes('row-level security') || error?.code === '42501') {
      throw httpError(403, '无权保存案例，请重新登录后再试');
    }
    if (error?.code === '23514' || msg.includes('check constraint')) {
      throw httpError(400, '案例内容未通过校验，请检查正文/原因/标签长度');
    }
    console.error('[caseLibrary] create failed', {
      code: error?.code,
      message: error?.message,
    });
    throw httpError(500, '保存案例失败，请稍后重试');
  }
  return toCaseLibraryDto(data as CaseLibraryRecord);
}

export async function updateCaseLibraryEntry(
  userId: string,
  userJwt: string,
  createUserClient: CreateUserClient,
  id: string,
  input: CaseLibraryInput,
): Promise<CaseLibraryDto> {
  if (!isUuid(id)) {
    throw httpError(400, 'Invalid case id');
  }

  const client = createUserClient(userJwt);
  const { data, error } = await client
    .from('case_library_entries')
    .update({
      case_type: input.caseType,
      title: input.title ?? null,
      body: input.body,
      reason: input.reason,
      tags: input.tags ?? [],
      // never allow owner reassignment through BFF
      owner_id: userId,
    })
    .eq('id', id)
    .eq('owner_id', userId)
    .is('deleted_at', null)
    .select('*')
    .single();

  if (error || !data) {
    // Treat missing / other-owner as 404 (do not leak existence)
    throw httpError(404, 'Case not found');
  }
  return toCaseLibraryDto(data as CaseLibraryRecord);
}

export async function softDeleteCaseLibraryEntry(
  userId: string,
  userJwt: string,
  createUserClient: CreateUserClient,
  id: string,
): Promise<void> {
  if (!isUuid(id)) {
    throw httpError(400, 'Invalid case id');
  }

  const client = createUserClient(userJwt);

  // Direct UPDATE of deleted_at is blocked by authenticated RLS on this table
  // (WITH CHECK rejects the soft-deleted new row in practice). Use owner-scoped
  // SECURITY DEFINER RPC that still requires auth.uid() = owner_id.
  const { error } = await client.rpc('soft_delete_case_library_entry', {
    p_id: id,
  });

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    if (
      msg.includes('case not found')
      || msg.includes('p0002')
      || error.code === 'P0002'
    ) {
      throw httpError(404, 'Case not found');
    }
    console.error('[caseLibrary] soft-delete rpc failed', {
      code: error.code,
      message: error.message,
      userIdPrefix: userId.slice(0, 8),
    });
    throw httpError(500, '删除案例失败，请稍后重试');
  }
}
