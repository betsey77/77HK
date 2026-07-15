/**
 * W2 — personal case library API client (auth JWT).
 * Bodies are managed here only; generation sends selected IDs, server resolves for W3 prompts.
 */

import { supabase } from './supabase';
import type { CaseLibraryEntry, CaseLibraryInput, CaseLibraryType } from '../types';
import { ApiError } from './api';
import { apiUrl } from './apiBase';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json() as { error?: string };
    return body.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function listCaseLibrary(params?: {
  query?: string;
  caseType?: CaseLibraryType;
}): Promise<CaseLibraryEntry[]> {
  const headers = await getAuthHeaders();
  const qs = new URLSearchParams();
  if (params?.query?.trim()) qs.set('query', params.query.trim());
  if (params?.caseType) qs.set('caseType', params.caseType);
  const url = `${apiUrl('/case-library')}${qs.toString() ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  const data = await res.json() as { items: CaseLibraryEntry[] };
  return data.items ?? [];
}

export async function createCaseLibraryEntry(input: CaseLibraryInput): Promise<CaseLibraryEntry> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl('/case-library'), {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  return res.json() as Promise<CaseLibraryEntry>;
}

export async function updateCaseLibraryEntry(
  id: string,
  input: CaseLibraryInput,
): Promise<CaseLibraryEntry> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/case-library/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers,
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
  return res.json() as Promise<CaseLibraryEntry>;
}

export async function deleteCaseLibraryEntry(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/case-library/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new ApiError(await parseError(res), res.status);
}
