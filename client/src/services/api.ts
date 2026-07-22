import { supabase } from './supabase';
import { apiUrl } from './apiBase';
import type {
  GenerateRequest, GenerateResponse, Variants, QuickCheckResult,
  GenerationJobSummary, GenerationJob, GenerationEngine,
  GenerationListResponse, GenerationDetailResponse, GenerationCreateResponse,
  GenerateFailedBody,
  PlanEntitlements, CheckoutRequest, CheckoutResponse,
  PaymentOrder, PaymentOrderListResponse,
} from '../types';

/**
 * HTTP-aware API error. Callers must branch on `status` (e.g. 402 quota),
 * never by matching Chinese/English message text.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Get the current Supabase session JWT for authenticated API calls */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

/** Call an API route with the current Supabase session JWT. */
export async function authApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const headers = new Headers(init.headers);

  for (const [name, value] of Object.entries(authHeaders)) {
    headers.set(name, value);
  }

  return fetch(apiUrl(path), { ...init, headers });
}

/** Convert one product selling point into natural Hong Kong Cantonese. */
export async function localizeSellingPoint(sourceText: string): Promise<string> {
  const response = await authApiFetch('/localize-selling-point', {
    method: 'POST',
    body: JSON.stringify({ sourceText }),
  });
  const body = await response.json().catch(() => ({})) as {
    cantoneseText?: unknown;
    error?: unknown;
  };

  if (!response.ok) {
    throw new ApiError(
      typeof body.error === 'string' ? body.error : '产品卖点港化失败，请重试',
      response.status,
    );
  }
  if (typeof body.cantoneseText !== 'string' || !body.cantoneseText.trim()) {
    throw new Error('产品卖点港化结果为空，请重试');
  }
  return body.cantoneseText.trim();
}

const INSPIRATION_FAILURE_MESSAGES: Record<string, string> = {
  youtube_not_configured: 'YouTube API 尚未配置，请联系管理员',
  youtube_api_key_invalid: 'YouTube API Key 无效，请联系管理员更新配置',
  youtube_quota_exceeded: 'YouTube API 今日额度已用完，请稍后重试',
  youtube_access_denied: 'YouTube API Key 没有访问权限，请联系管理员检查限制',
  youtube_upstream_unavailable: 'YouTube 服务暂时不可用，请稍后重试',
};

/** Convert a structured inspiration API failure into safe user-facing copy. */
export async function getInspirationErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({})) as { reason?: unknown };
  const reason = typeof body.reason === 'string' ? body.reason : '';
  return INSPIRATION_FAILURE_MESSAGES[reason] ?? '热点数据获取失败';
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
    fetch(apiUrl('/generate'), {
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
    throw new ApiError(
      (json.error as string) ?? `Generation failed (${res.status})`,
      res.status,
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
  const res = await fetch(apiUrl('/quick-check'), {
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
  const res = await fetch(apiUrl('/generations'), {
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
  query?: string;
}): Promise<GenerationListResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  if (opts?.query) params.set('q', opts.query);

  const url = `${apiUrl('/generations')}${params.toString() ? '?' + params.toString() : ''}`;
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
  const res = await fetch(apiUrl(`/generations/${encodeURIComponent(id)}`), { headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Failed to get job (${res.status})`);
  }

  return res.json() as Promise<GenerationDetailResponse>;
}

/** Soft-delete a generation job */
export async function deleteGenerationJob(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/generations/${encodeURIComponent(id)}`), {
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
  const res = await fetch(apiUrl('/me/entitlements'), { headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Failed to get entitlements (${res.status})`);
  }

  return res.json() as Promise<PlanEntitlements>;
}

/** Create a MOCK checkout order */
export async function createCheckout(request: CheckoutRequest): Promise<CheckoutResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl('/billing/checkout'), {
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
  const res = await fetch(apiUrl('/billing/orders'), { headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Failed to list orders (${res.status})`);
  }

  return res.json() as Promise<PaymentOrderListResponse>;
}

/** Get a single MOCK order detail */
export async function getOrder(orderId: string): Promise<PaymentOrder> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/billing/orders/${encodeURIComponent(orderId)}`), { headers });

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
  reviewGroup?: string | null;
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
  ownerReviewGroup?: string | null;
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

export type AdminFavoriteReviewStatus = 'adopted' | 'changes_requested';

export interface AdminReviewAnnotation {
  id: string;
  startOffset: number;
  endOffset: number;
  quotedText: string;
  note: string;
}

export interface AdminFavoriteMeta {
  id: string;
  ownerDisplayName: string;
  userEmail: string;
  ownerReviewGroup?: string | null;
  variantKey: string;
  rating: number | null;
  notes: string | null;
  favoriteReason: string | null;
  reasonTags: string[];
  savedAt: string;
  /** W4: from favorites.settings snapshot; null → UI「未填写」 */
  brandName: string | null;
  productName: string | null;
  copyType: string | null;
  platform: string | null;
  /** Favorite-only publish platform; null if unset (UI falls back to platform/variantKey) */
  publishPlatform?: string | null;
  /** R1: admin review summary (no reviewer email/group) */
  reviewStatus?: AdminFavoriteReviewStatus | null;
  reviewNote?: string | null;
  reviewUpdatedAt?: string | null;
  reviewAnnotations?: AdminReviewAnnotation[];
  contentRevision?: number;
  contentEditedAt?: string | null;
  isUserAuthored?: boolean;
  reviewRequested?: boolean;
  reviewRequestedAt?: string | null;
  isPendingReview?: boolean;
}

export interface AdminPendingReviewSummary {
  count: number;
  latestRequestedAt: string | null;
}

export interface AdminFavoriteDetail extends AdminFavoriteMeta {
  content: string;
}

export interface AdminFavoriteReviewResult {
  favoriteId: string;
  reviewStatus: AdminFavoriteReviewStatus | null;
  reviewNote: string | null;
  reviewUpdatedAt: string | null;
  reviewAnnotations: AdminReviewAnnotation[];
}

/** W4: super_admin case library review (no email). */
export interface AdminCaseLibraryDetail {
  id: string;
  ownerDisplayName: string;
  caseType: string;
  title: string | null;
  body: string;
  reason: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export async function getAdminStats(): Promise<AdminStats & { role?: 'admin' | 'super_admin'; reviewGroup?: string | null }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl('/admin/stats'), { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load admin stats');
  return res.json();
}

export async function getAdminUsers(limit = 20, offset = 0): Promise<{ users: AdminUserOverview[]; total: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/admin/users?limit=${limit}&offset=${offset}`), { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load users');
  return res.json();
}

export async function getAdminGenerations(limit = 20, offset = 0): Promise<{ jobs: AdminGenerationMeta[]; total: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/admin/generations?limit=${limit}&offset=${offset}`), { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load generations');
  return res.json();
}

export async function getAdminFeedback(limit = 20, offset = 0): Promise<{ feedback: AdminFeedbackSummary[]; total: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/admin/feedback?limit=${limit}&offset=${offset}`), { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load feedback');
  return res.json();
}

export async function getAdminSubscriptions(limit = 20, offset = 0): Promise<{ subscriptions: AdminSubscriptionOverview[]; total: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/admin/subscriptions?limit=${limit}&offset=${offset}`), { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load subscriptions');
  return res.json();
}

export async function getAdminAuditLog(limit = 20, offset = 0): Promise<{ entries: AdminAuditEntry[]; total: number }> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/admin/audit-log?limit=${limit}&offset=${offset}`), { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load audit log');
  return res.json();
}

export async function getAdminFavorites(
  limit = 20,
  offset = 0,
  q?: string,
  pendingOnly = false,
): Promise<{ favorites: AdminFavoriteMeta[]; total: number }> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const trimmed = typeof q === 'string' ? q.trim() : '';
  if (trimmed) params.set('q', trimmed.slice(0, 80));
  if (pendingOnly) params.set('pendingOnly', 'true');
  const res = await fetch(apiUrl(`/admin/favorites?${params.toString()}`), { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load favorites');
  return res.json();
}

export async function getAdminFavoriteDetail(id: string): Promise<AdminFavoriteDetail> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/admin/favorites/${encodeURIComponent(id)}`), { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load favorite detail');
  return res.json();
}

/** R1: upsert/clear favorite admin review (status null clears). */
export async function putAdminFavoriteReview(
  id: string,
  body: {
    status: AdminFavoriteReviewStatus | null;
    note?: string | null;
    annotations?: AdminReviewAnnotation[];
  },
  // Sentence-level annotations are replaced atomically with this review save.
): Promise<AdminFavoriteReviewResult> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/admin/favorites/${encodeURIComponent(id)}/review`), {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (res.status === 404) throw new Error('NOT_FOUND');
  if (res.status === 400) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(typeof errBody.error === 'string' ? errBody.error : 'INVALID');
  }
  if (!res.ok) throw new Error('Failed to save review');
  return res.json();
}

export async function getAdminPendingReviewSummary(): Promise<AdminPendingReviewSummary> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl('/admin/favorites/pending-summary'), { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (!res.ok) throw new Error('Failed to load pending review summary');
  return res.json();
}

/** W4: super_admin only — audited case body read. Ordinary admin gets 403. */
export async function getAdminCaseLibraryDetail(id: string): Promise<AdminCaseLibraryDetail> {
  const headers = await getAuthHeaders();
  const res = await fetch(apiUrl(`/admin/case-library/${encodeURIComponent(id)}`), { headers });
  if (res.status === 403) throw new Error('FORBIDDEN');
  if (res.status === 404) throw new Error('NOT_FOUND');
  if (!res.ok) throw new Error('Failed to load case library detail');
  return res.json();
}

/** Check if the current user has admin access (server-verified). Returns true if 200. */
export async function checkAdminAccess(): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(apiUrl('/admin/stats'), { headers });
    return res.ok;
  } catch {
    return false;
  }
}
