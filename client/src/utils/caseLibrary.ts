/**
 * W2 — client helpers for personal case library.
 * Display names are derived only; never written back to the database.
 */

import type { CaseLibraryInput, CaseLibraryType } from '../types';

export const CASE_LIBRARY_LIMITS = {
  titleMax: 120,
  bodyMin: 20,
  bodyMax: 5000,
  reasonMin: 1,
  reasonMax: 500,
  tagsMax: 8,
  tagMin: 1,
  tagMax: 30,
  maxSelected: 3,
} as const;

export function deriveCaseDisplayName(
  caseType: CaseLibraryType,
  title: string | null | undefined,
): string {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (trimmed) return trimmed;
  return caseType === 'good' ? '未命名正例' : '未命名反例';
}

export function deriveCaseBodyPreview(body: string, max = 24): string {
  const text = body.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function deriveReasonPreview(reason: string, max = 40): string {
  const text = reason.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export interface CaseLibraryFieldErrors {
  title?: string;
  body?: string;
  reason?: string;
  tags?: string;
  caseType?: string;
}

export function parseTagsInput(raw: string): string[] {
  return raw
    .split(/[,，\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function validateCaseLibraryForm(input: {
  caseType: CaseLibraryType;
  title: string;
  body: string;
  reason: string;
  tagsRaw: string;
}): { ok: true; value: CaseLibraryInput } | { ok: false; errors: CaseLibraryFieldErrors } {
  const errors: CaseLibraryFieldErrors = {};
  const { caseType } = input;
  if (caseType !== 'good' && caseType !== 'bad') {
    errors.caseType = '请选择正例或反例';
  }

  const title = input.title.trim();
  if (title.length > CASE_LIBRARY_LIMITS.titleMax) {
    errors.title = `标题最多 ${CASE_LIBRARY_LIMITS.titleMax} 字`;
  }

  const body = input.body.trim();
  if (body.length < CASE_LIBRARY_LIMITS.bodyMin || body.length > CASE_LIBRARY_LIMITS.bodyMax) {
    errors.body = `正文需 ${CASE_LIBRARY_LIMITS.bodyMin}–${CASE_LIBRARY_LIMITS.bodyMax} 字（当前 ${body.length}）`;
  }

  const reason = input.reason.trim();
  if (reason.length < CASE_LIBRARY_LIMITS.reasonMin || reason.length > CASE_LIBRARY_LIMITS.reasonMax) {
    errors.reason = `原因需 ${CASE_LIBRARY_LIMITS.reasonMin}–${CASE_LIBRARY_LIMITS.reasonMax} 字（当前 ${reason.length}）`;
  }

  const tags = parseTagsInput(input.tagsRaw);
  if (tags.length > CASE_LIBRARY_LIMITS.tagsMax) {
    errors.tags = `标签最多 ${CASE_LIBRARY_LIMITS.tagsMax} 个`;
  } else {
    for (const tag of tags) {
      if (tag.length < CASE_LIBRARY_LIMITS.tagMin || tag.length > CASE_LIBRARY_LIMITS.tagMax) {
        errors.tags = `每个标签 ${CASE_LIBRARY_LIMITS.tagMin}–${CASE_LIBRARY_LIMITS.tagMax} 字`;
        break;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      caseType,
      title: title.length === 0 ? null : title,
      body,
      reason,
      tags,
    },
  };
}

/** Keep at most max selected IDs that still exist; report dropped count. */
export function reconcileSelectedCaseIds(
  selectedIds: string[] | undefined,
  availableIds: Set<string>,
  max = CASE_LIBRARY_LIMITS.maxSelected,
): { next: string[]; dropped: number } {
  const selected = Array.isArray(selectedIds) ? selectedIds : [];
  const kept: string[] = [];
  let dropped = 0;
  for (const id of selected) {
    if (!availableIds.has(id)) {
      dropped += 1;
      continue;
    }
    if (kept.length < max) kept.push(id);
  }
  return { next: kept, dropped };
}
