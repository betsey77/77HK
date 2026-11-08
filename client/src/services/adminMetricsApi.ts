import { apiUrl } from './apiBase';
import { supabase } from './supabase';

export interface AdminMetricsOverview {
  scope: 'group' | 'global';
  reviewGroup: string | null;
  from: string;
  to: string;
  activity: { dau: number; wau: number; mau: number };
  membershipGrants: { total: number; pending: number; applied: number };
  quota: { consumed: number; remaining: number };
}

export interface AdminModelMetricsRow {
  provider: string;
  model: string;
  total: number;
  success: number;
  error: number;
  errorRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  unavailableUsageCount: number;
}

export interface AdminModelMetrics {
  from: string;
  to: string;
  rows: AdminModelMetricsRow[];
}

export interface AdminBadCases {
  from: string;
  to: string;
  threshold: number;
  items: Array<{
    id: string;
    score: number;
    platform: string;
    tone: string;
    generationEngine: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
}

export interface AdminBadCaseDetailJob {
  id: string;
  status: string;
  source: string;
  platform: string;
  tone: string;
  generation_engine: string | null;
  variants: Record<string, unknown> | null;
  diagnosis?: unknown;
  audit?: unknown;
  scores?: unknown;
  error_message?: string | null;
  error_code?: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface AdminBadCaseModelAttempt {
  createdAt: string;
  operation: string;
  provider: string;
  model: string;
  status: 'success' | 'error';
  errorClass: string | null;
  latencyMs: number;
  attempt: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cacheHitTokens: number | null;
  cacheMissTokens: number | null;
  usageSource: 'provider' | 'unavailable';
}

export interface AdminBadCaseDetail {
  job: AdminBadCaseDetailJob;
  modelAttempts:
    | { status: 'available'; items: AdminBadCaseModelAttempt[] }
    | { status: 'unavailable'; items: [] };
}

export type AdminProviderBalance = {
  provider: 'deepseek';
  status: 'ok';
  isAvailable: boolean;
  balances: Array<{
    currency: 'CNY' | 'USD';
    totalBalance: string;
    grantedBalance: string;
    toppedUpBalance: string;
  }>;
  fetchedAt: string;
} | {
  provider: 'deepseek';
  status: 'unavailable';
};

async function get(path: string): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  return fetch(apiUrl(path), { headers });
}

async function read<T>(path: string, errorMessage: string): Promise<T> {
  const response = await get(path);
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (!response.ok) throw new Error(errorMessage);
  return response.json() as Promise<T>;
}

export function getAdminMetricsOverview(): Promise<AdminMetricsOverview> {
  return read('/admin/metrics/overview', 'Failed to load operational metrics');
}

export function getAdminModelMetrics(): Promise<AdminModelMetrics> {
  return read('/admin/metrics/models', 'Failed to load model metrics');
}

export function getAdminBadCases(): Promise<AdminBadCases> {
  return read('/admin/metrics/bad-cases', 'Failed to load bad cases');
}

export function getAdminBadCaseDetail(id: string): Promise<AdminBadCaseDetail> {
  return read(`/admin/metrics/bad-cases/${encodeURIComponent(id)}`, 'Failed to load bad case detail');
}

export function getAdminProviderBalance(): Promise<AdminProviderBalance> {
  return read('/admin/metrics/provider-balance', 'Failed to load provider balance');
}
