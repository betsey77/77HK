import { supabase } from './supabase';
import type {
  GenerateRequest, GenerateResponse, Variants, QuickCheckResult,
  GenerationJobSummary, GenerationJob, GenerationEngine,
  GenerationListResponse, GenerationDetailResponse, GenerationCreateResponse,
  GenerateFailedBody,
  PlanEntitlements, CheckoutRequest, CheckoutResponse,
  PaymentOrder, PaymentOrderListResponse,
} from '../types';

const API_BASE = '/api';

/** Get the current Supabase session JWT for authenticated API calls */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

// ============================================================
// Polling helpers for generation jobs
// ============================================================

const GENERATE_POLL_MAX_MS = 120_000;   // 2 min total
const GENERATE_POLL_MAX_DELAY_MS = 16_000;

/** Map a completed GenerationJob to the GenerateResponse shape the UI expects. */
function mapJobToGenerateResponse(job: GenerationJob): GenerateResponse {
  return {
    diagnosis: job.diagnosis!,
    variants: job.variants!,
    audit: job.audit!,
    generationEngine: (job.generationEngine as GenerationEngine) || 'rules',
    scores: job.scores ?? undefined,
    consumerFeedback: job.consumerFeedback ?? undefined,
    variantMeta: job.variantMeta as GenerateResponse['variantMeta'],
  };
}

/** Poll GET /api/generations/:id until the job completes or fails. */
async function pollGenerationJob(jobId: string): Promise<GenerateResponse> {
  const startedAt = Date.now();
  let delay = 1000;

  while (Date.now() - startedAt < GENERATE_POLL_MAX_MS) {
    await new Promise((r) => setTimeout(r, delay));

    try {
      const detail = await getGenerationJob(jobId);
      const job = detail.job;

      if (job.status === 'completed') {
        return mapJobToGenerateResponse(job);
      }

      if (job.status === 'failed') {
        throw new Error(job.errorMessage || 'Generation failed');
      }
      // pending / processing — keep polling
    } catch (err) {
      // Re-throw job-level failures (from status==='failed' above).
      // Network / transient server errors during poll: swallow and continue.
      if (err instanceof Error && !err.message.includes('Failed to get job')) {
        throw err;
      }
      // else: transient error, keep polling
    }

    delay = Math.min(delay * 2, GENERATE_POLL_MAX_DELAY_MS);
  }

  throw new Error(
    `Generation timed out. You can check results in history (job ${jobId}).`,
  );
}

// ============================================================
// POST /api/generate — main entry point
// ============================================================

/**
 * Call POST /api/generate and resolve to a completed GenerateResponse.
 *
 * Behaviour:
 * - Network errors are retried once with the same idempotencyKey.
 * - HTTP 202 (pending/processing) triggers server-side polling via
 *   GET /api/generations/:id until the job reaches completed or failed.
 * - HTTP 200 with `status: 'failed'` throws immediately.
 * - The caller must provide a stable idempotencyKey; one per user action.
 */
export async function generateCopy(
  request: GenerateRequest,
  idempotencyKey: string,
): Promise<GenerateResponse> {
  const headers = await getAuthHeaders();
  const body = JSON.stringify({ ...request, idempotencyKey });

  const doPost = () =>
    fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers,
      body,
    });

  // --- Network-level retry (once, same idempotencyKey) ---
  let res: Response;
  try {
    res = await doPost();
  } catch {
    // Single retry on network error — reuse exact same body (same key)
    res = await doPost();
  }
  // ----------------------------------------------------------

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new Error(
      (json.error as string) ?? `Generation failed (${res.status})`,
    );
  }

  // HTTP 202 → pending or processing — poll
  if (res.status === 202) {
    const jobId = json.jobId as string | undefined;
    if (!jobId) throw new Error('Server returned 202 but no jobId');
    return pollGenerationJob(jobId);
  }

  // HTTP 200 but body.status === 'failed' — prior failure
  if (json.status === 'failed') {
    const failBody = json as unknown as GenerateFailedBody;
    throw new Error(failBody.error || 'Generation failed');
  }

  // HTTP 200 completed
  return json as unknown as GenerateResponse;
}

/**
 * Run local rules-based quick checks on generated variants.
 * No AI call — always fast.
 */
export async function runQuickCheck(
  variants: Variants,
  opts?: { brandName?: string; brandRedLines?: string; platform?: string },
): Promise<QuickCheckResult> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/quick-check`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ variants, ...opts }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Quick check failed (${res.status})`);
  }

  return res.json() as Promise<QuickCheckResult>;
}

// ============================================================
// Slice C1: Generation Jobs API
// ============================================================

/** Create a generation job (or retrieve existing by idempotency key) */
export async function createGenerationJob(params: {
  source: string;
  idempotencyKey?: string;
  platform?: string;
  tone?: string;
}): Promise<GenerationCreateResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/generations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Failed to create job (${res.status})`);
  }

  return res.json() as Promise<GenerationCreateResponse>;
}

/** List user's generation history */
export async function listGenerationJobs(opts?: {
  limit?: number;
  offset?: number;
}): Promise<GenerationListResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));

  const url = `${API_BASE}/generations${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Failed to list jobs (${res.status})`);
  }

  return res.json() as Promise<GenerationListResponse>;
}

/** Get a single generation job detail */
export async function getGenerationJob(id: string): Promise<GenerationDetailResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/generations/${encodeURIComponent(id)}`, { headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Failed to get job (${res.status})`);
  }

  return res.json() as Promise<GenerationDetailResponse>;
}

/** Soft-delete a generation job */
export async function deleteGenerationJob(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/generations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Failed to delete job (${res.status})`);
  }
}

// ============================================================
// Slice E: Billing (MOCK)
// ============================================================

/** Get current user's plan entitlements */
export async function getEntitlements(): Promise<PlanEntitlements> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/me/entitlements`, { headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Failed to get entitlements (${res.status})`);
  }

  return res.json() as Promise<PlanEntitlements>;
}

/** Create a MOCK checkout order */
export async function createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/billing/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Failed to create checkout (${res.status})`);
  }

  return res.json() as Promise<CheckoutResponse>;
}

/** List user's MOCK orders */
export async function listOrders(): Promise<PaymentOrderListResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/billing/orders`, { headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Failed to list orders (${res.status})`);
  }

  return res.json() as Promise<PaymentOrderListResponse>;
}

/** Get a single MOCK order detail */
export async function getOrder(orderId: string): Promise<PaymentOrder> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/billing/orders/${encodeURIComponent(orderId)}`, { headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Failed to get order (${res.status})`);
  }

  return res.json() as Promise<PaymentOrder>;
}

// ============================================================
// Slice G1: Admin API
// ============================================================

export interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalGenerations: number;
  totalFeedback: number;
  adminUsers: number;
}

export interface AdminUserOverview {
  id: string;
  displayName: string;
  userIdPrefix: string;
  roles: string[];
  status: string;
  createdAt: string;
  deletionRequestedAt: string | null;
  subscriptionPlan: string | null;
  generationCount: number;
}

export interface AdminGenerationMeta {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  status: string;
  platform: string;
  tone: string;
  generationEngine: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AdminFeedbackSummary {
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  type: string;
  title: string;
  notifyStatus: string;
  createdAt: string;
}

export interface AdminSubscriptionOverview {
  id: string;
  userId: string;
  userDisplayName: string;
  planName: string;
  status: string;
  quotaUsed: number;
  quotaTotal: number;
  cycleStart: string;
  cycleEnd: string;
}

export interface AdminAuditEntry {
  id: string;
  actor: string | null;
  actorRole: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  reason: string | null;
  diff: unknown;
  requestId: string | null;
  createdAt: string;
}

export async function getAdminStats(): Promise<AdminStats> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/stats`, { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load admin stats');
  return res.json();
}

export async function getAdminUsers(limit = 20, offset = 0): Promise<{ users: AdminUserOverview[]; total: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/users?limit=${limit}&offset=${offset}`, { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load users');
  return res.json();
}

export async function getAdminGenerations(limit = 20, offset = 0): Promise<{ jobs: AdminGenerationMeta[]; total: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/generations?limit=${limit}&offset=${offset}`, { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load generations');
  return res.json();
}

export async function getAdminFeedback(limit = 20, offset = 0): Promise<{ feedback: AdminFeedbackSummary[]; total: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/feedback?limit=${limit}&offset=${offset}`, { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load feedback');
  return res.json();
}

export async function getAdminSubscriptions(limit = 20, offset = 0): Promise<{ subscriptions: AdminSubscriptionOverview[]; total: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/subscriptions?limit=${limit}&offset=${offset}`, { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load subscriptions');
  return res.json();
}

export async function getAdminAuditLog(limit = 20, offset = 0): Promise<{ entries: AdminAuditEntry[]; total: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/admin/audit-log?limit=${limit}&offset=${offset}`, { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load audit log');
  return res.json();
}

/** Check if the current user has admin access (server-verified). Returns true if 200. */
export async function checkAdminAccess(): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_BASE}/admin/stats`, { headers });
    return res.ok;
  } catch {
    return false;
  }
}
