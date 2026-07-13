/**
 * Feedback service — Slice H1。
 *
 * 职责：
 * 1) 将用户反馈持久化到 user_feedback 表。
 * 2) 在持久化成功后 best-effort 通过 Server酱通知管理员。
 * 3) 通知失败绝不回滚已持久化的反馈（反馈数据优先于通知）。
 *
 * 安全：
 * - 反馈正文不写入普通 server log。
 * - 通知错误消息脱敏。
 * - 用户只能查询自己的反馈（RLS + owner_id WHERE）。
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getNotifier, type NotifyResult } from './serverchanNotifier.js';

// ── Types ──────────────────────────────────────────────────────

export type FeedbackType = 'feature_request' | 'bug_report' | 'user_experience' | 'other';

export const VALID_FEEDBACK_TYPES: readonly FeedbackType[] = [
  'feature_request',
  'bug_report',
  'user_experience',
  'other',
] as const;

export interface CreateFeedbackInput {
  type: FeedbackType;
  title: string;
  content: string;
  /** 自动附加的元数据 */
  metadata?: {
    page_path?: string;
    app_version?: string;
  };
}

export interface FeedbackRecord {
  id: string;
  owner_id: string;
  type: FeedbackType;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  notify_status: 'pending' | 'sent' | 'failed';
  notify_attempts: number;
  notify_last_error: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFeedbackResult {
  feedback: FeedbackRecord;
  notifyResult?: NotifyResult;
}

// ── Constants ──────────────────────────────────────────────────

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 5000;
const MAX_METADATA_KEYS = 20;
const MAX_NOTIFY_ATTEMPTS = 3;
const NOTIFY_TITLE_PREFIX = '[77港话通]';

/** 反馈类型中文映射（用于通知） */
const TYPE_LABELS: Record<FeedbackType, string> = {
  feature_request: '需求建议',
  bug_report: 'Bug反馈',
  user_experience: '使用体验',
  other: '其他',
};

// ── Validation ─────────────────────────────────────────────────

export function validateFeedbackInput(body: unknown): CreateFeedbackInput {
  if (!body || typeof body !== 'object') {
    throw { status: 400, message: 'Request body must be a JSON object' };
  }

  const b = body as Record<string, unknown>;

  // type
  if (typeof b.type !== 'string' || !VALID_FEEDBACK_TYPES.includes(b.type as FeedbackType)) {
    throw {
      status: 400,
      message: `type must be one of: ${VALID_FEEDBACK_TYPES.join(', ')}`,
    };
  }

  // title
  if (typeof b.title !== 'string' || b.title.trim().length === 0) {
    throw { status: 400, message: 'title is required and must be a non-empty string' };
  }
  const title = b.title.trim();
  if (title.length > MAX_TITLE_LENGTH) {
    throw { status: 400, message: `title must not exceed ${MAX_TITLE_LENGTH} characters` };
  }

  // content
  if (typeof b.content !== 'string' || b.content.trim().length === 0) {
    throw { status: 400, message: 'content is required and must be a non-empty string' };
  }
  const content = b.content.trim();
  if (content.length > MAX_CONTENT_LENGTH) {
    throw { status: 400, message: `content must not exceed ${MAX_CONTENT_LENGTH} characters` };
  }

  // metadata (optional)
  let metadata: CreateFeedbackInput['metadata'] | undefined;
  if (b.metadata !== undefined && b.metadata !== null) {
    if (typeof b.metadata !== 'object' || Array.isArray(b.metadata)) {
      throw { status: 400, message: 'metadata must be an object if provided' };
    }
    const metaObj = b.metadata as Record<string, unknown>;
    // 限制字段数量防滥用
    const keys = Object.keys(metaObj);
    if (keys.length > MAX_METADATA_KEYS) {
      throw { status: 400, message: `metadata must have at most ${MAX_METADATA_KEYS} keys` };
    }
    // 限制字段值为简单类型
    for (const key of keys) {
      const v = metaObj[key];
      if (v !== null && v !== undefined && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') {
        throw { status: 400, message: `metadata.${key} must be string, number, or boolean` };
      }
    }
    metadata = { page_path: String(metaObj.page_path ?? ''), app_version: String(metaObj.app_version ?? '') };
  }

  return { type: b.type as FeedbackType, title, content, metadata };
}

// ── Notification helper ────────────────────────────────────────

function buildNotifyContent(feedback: CreateFeedbackInput, userEmail?: string): string {
  const typeLabel = TYPE_LABELS[feedback.type] ?? feedback.type;
  let desp = '';

  desp += `## 用户反馈\n\n`;
  desp += `**类型**：${typeLabel}\n\n`;
  desp += `**标题**：${feedback.title}\n\n`;
  desp += `**内容**：\n${feedback.content}\n\n`;

  if (userEmail) {
    desp += `**用户**：${userEmail}\n\n`;
  }

  if (feedback.metadata?.page_path) {
    desp += `**页面路径**：${feedback.metadata.page_path}\n\n`;
  }
  if (feedback.metadata?.app_version) {
    desp += `**App版本**：${feedback.metadata.app_version}\n\n`;
  }

  return desp;
}

// ── Core service ───────────────────────────────────────────────

export async function createFeedback(
  userId: string,
  userEmail: string | undefined,
  userJwt: string,
  input: CreateFeedbackInput,
  supabaseFactory: (jwt: string) => SupabaseClient,
  trustedClientFactory?: () => (SupabaseClient | undefined),
): Promise<CreateFeedbackResult> {
  const client = supabaseFactory(userJwt);

  // 1) 持久化反馈（user-scoped client + RLS）
  const { data, error } = await client
    .from('user_feedback')
    .insert({
      owner_id: userId,
      type: input.type,
      title: input.title,
      content: input.content,
      metadata: input.metadata ?? null,
      notify_status: 'pending',
      notify_attempts: 0,
    })
    .select('*')
    .single();

  if (error) {
    // Detect rate-limit violation from DB trigger and map to 429
    if (typeof error.message === 'string' && error.message.includes('RATE_LIMIT')) {
      throw { status: 429, message: 'Feedback limit reached. Please try again later.' };
    }
    // 脱敏其他数据库错误
    throw { status: 500, message: 'Failed to save feedback' };
  }

  if (!data) {
    throw { status: 500, message: 'Failed to save feedback' };
  }

  const feedback = rowToRecord(data);

  // 2) Best-effort 通知
  const notifier = getNotifier();
  const notifyTitle = `${NOTIFY_TITLE_PREFIX} ${TYPE_LABELS[input.type]}: ${input.title.slice(0, 80)}`;
  const notifyContent = buildNotifyContent(input, userEmail);

  let notifyResult: NotifyResult = { success: false, error: 'Not attempted' };

  try {
    notifyResult = await notifier.send({ title: notifyTitle, content: notifyContent });
  } catch {
    notifyResult = { success: false, error: 'Notification threw unexpected error' };
  }

  // 3) 通过 trusted client 更新通知状态（service_role bypass RLS）
  //    用户客户端不可写 notify_* 字段（RLS enforce）。
  //    更新失败时 feedback.notify_status 保持 'pending'，不伪报 sent/failed。
  const attempts = 1;
  const newStatus: FeedbackRecord['notify_status'] = notifyResult.success ? 'sent' : 'failed';
  const lastError = notifyResult.success ? null : (notifyResult.error ?? 'Unknown notification error');

  const trusted = trustedClientFactory?.();
  if (trusted) {
    try {
      const { error: updateError } = await trusted
        .from('user_feedback')
        .update({
          notify_status: newStatus,
          notify_attempts: attempts,
          notify_last_error: lastError,
          notified_at: notifyResult.success ? new Date().toISOString() : null,
        })
        .eq('id', feedback.id)
        .eq('owner_id', userId);

      if (!updateError) {
        // Only update in-memory state on confirmed DB write
        feedback.notify_status = newStatus;
        feedback.notify_attempts = attempts;
        feedback.notify_last_error = lastError;
        if (notifyResult.success) {
          feedback.notified_at = new Date().toISOString();
        }
      }
      // On error: feedback.notify_status stays 'pending', body still 201
    } catch {
      // Trusted update failed — keep pending, body still 201
    }
  }
  // If no trusted client available (e.g. migration not pushed yet),
  // feedback stays 'pending' — no false sent/failed reported.

  return { feedback, notifyResult };
}

export async function getMyFeedback(
  userId: string,
  userJwt: string,
  supabaseFactory: (jwt: string) => SupabaseClient,
  limit: number = 50,
  offset: number = 0,
): Promise<{ items: FeedbackRecord[]; total: number }> {
  const finalLimit = Math.max(1, Math.min(100, limit));
  const finalOffset = Math.max(0, offset);

  const client = supabaseFactory(userJwt);

  const { data, error, count } = await client
    .from('user_feedback')
    .select('*', { count: 'exact' })
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .range(finalOffset, finalOffset + finalLimit - 1);

  if (error) {
    throw { status: 500, message: 'Failed to fetch feedback' };
  }

  return {
    items: (data ?? []).map(rowToRecord),
    total: count ?? 0,
  };
}

// ── Row mapping ────────────────────────────────────────────────

function rowToRecord(row: Record<string, unknown>): FeedbackRecord {
  return {
    id: String(row.id ?? ''),
    owner_id: String(row.owner_id ?? ''),
    type: String(row.type ?? 'other') as FeedbackType,
    title: String(row.title ?? ''),
    content: String(row.content ?? ''),
    metadata: (row.metadata as Record<string, unknown>) ?? null,
    notify_status: String(row.notify_status ?? 'pending') as FeedbackRecord['notify_status'],
    notify_attempts: typeof row.notify_attempts === 'number' ? row.notify_attempts : 0,
    notify_last_error: typeof row.notify_last_error === 'string' ? row.notify_last_error : null,
    notified_at: typeof row.notified_at === 'string' ? row.notified_at : null,
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}
