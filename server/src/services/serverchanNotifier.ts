/**
 * Server酱 Turbo 通知服务。
 *
 * 设计约束（Slice H1）：
 * - SendKey 不出现于仓库、日志、错误消息或前端 bundle。
 * - 配置优先级：SERVERCHAN_SENDKEY env > SERVERCHAN_SENDKEY_FILE 文件指针。
 * - 外部文件支持 raw key 或 `SERVERCHAN_SENDKEY=...` 格式。
 * - URL 与异常全部脱敏，禁止输出完整 URL 或 key 片段。
 * - 可注入（通过 Notifier 接口），可 mock，方便测试。
 * - 通知失败不影响业务主流程——反馈持久化独立于通知。
 */

import { readFileSync } from 'node:fs';

// ── Types ──────────────────────────────────────────────────────

export interface NotifyPayload {
  /** 消息标题（纯文本，≤ 128 字符） */
  title: string;
  /** 消息正文（纯文本，≤ 4096 字符） */
  content: string;
}

export interface NotifyResult {
  success: boolean;
  /** Server酱 errno=0 且 errmsg 非空即成功 */
  serverchanErrno?: number;
  serverchanErrmsg?: string;
  /** 脱敏错误消息——绝不包含 SendKey、完整 URL 或内部文件名 */
  error?: string;
}

export interface Notifier {
  send(payload: NotifyPayload): Promise<NotifyResult>;
  isConfigured?(): boolean;
}

// ── 密钥加载 ──────────────────────────────────────────────────

function readSendKeyFromFile(filePath: string): string {
  try {
    const contents = readFileSync(filePath, 'utf8').trim();
    if (!contents) {
      throw new Error('SendKey file is empty');
    }

    // Split into non-empty lines
    const lines = contents.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // Fail closed on multi-line content (unexpected format)
    if (lines.length > 1) {
      throw new Error('SendKey file contains multiple lines');
    }

    const line = lines[0];

    // Case-insensitive match for known assignment formats
    const knownAssignments = /^(?:SendKey|SERVERCHAN_SENDKEY)\s*=\s*(.+)$/i;
    const assignment = line.match(knownAssignments);
    let key: string;

    if (assignment) {
      // Known assignment format: extract value
      key = assignment[1].trim();
    } else if (line.includes('=')) {
      // Unknown assignment name — fail closed
      throw new Error('Unknown SendKey file format');
    } else {
      // Raw key (no '=' sign)
      key = line;
    }

    // Strip optional paired quotes (single or double)
    if (
      key.length >= 2 &&
      ((key.startsWith('"') && key.endsWith('"')) ||
        (key.startsWith("'") && key.endsWith("'")))
    ) {
      key = key.slice(1, -1).trim();
    }

    if (!key || key.length < 10) {
      throw new Error('SendKey too short');
    }

    return key;
  } catch (err: unknown) {
    // If already one of our known errors, re-throw as-is
    if (err instanceof Error) {
      const msg = err.message;
      if (msg === 'SendKey file is empty' || msg === 'SendKey too short' || msg.includes('Unknown') || msg.includes('multiple lines')) {
        throw err;
      }
    }
    // Fail closed — 不暴露文件路径或内容
    throw new Error('Failed to read SendKey');
  }
}

function getSendKey(): string | null {
  // 1) 直接环境变量优先
  const directKey = process.env.SERVERCHAN_SENDKEY?.trim();
  if (directKey) return directKey;

  // 2) 文件指针（SERVERCHAN_SENDKEY_FILE）
  const keyFile = process.env.SERVERCHAN_SENDKEY_FILE?.trim();
  if (keyFile) {
    try {
      return readSendKeyFromFile(keyFile);
    } catch {
      // Fail closed — file parsing error means no key available
      return null;
    }
  }

  return null;
}

// ── ServerChan Turbo 实现 ──────────────────────────────────────

const SERVERCHAN_URL = 'https://sctapi.ftqq.com'; // 脱敏日志用
const NOTIFY_TIMEOUT_MS = 10_000;
const MAX_TITLE_LENGTH = 128;
const MAX_CONTENT_LENGTH = 4096;

export class ServerChanNotifier implements Notifier {
  private readonly sendKey: string | null;
  private readonly fetchFn: typeof fetch;

  /**
   * @param fetchOverride 可注入 fetch 实现（测试用）；默认 global fetch。
   */
  constructor(fetchOverride?: typeof fetch) {
    this.sendKey = getSendKey();
    this.fetchFn = fetchOverride ?? fetch;
  }

  /** 检查是否已配置（SendKey 可用） */
  isConfigured(): boolean {
    return this.sendKey !== null && this.sendKey.length >= 10;
  }

  async send(payload: NotifyPayload): Promise<NotifyResult> {
    if (!this.sendKey) {
      return { success: false, error: 'ServerChan SendKey not configured' };
    }

    // 截断与校验
    const title = payload.title.slice(0, MAX_TITLE_LENGTH);
    const content = payload.content.slice(0, MAX_CONTENT_LENGTH);

    if (!title.trim() || !content.trim()) {
      return { success: false, error: 'Title and content must not be empty' };
    }

    // 发送
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), NOTIFY_TIMEOUT_MS);

      const url = `${SERVERCHAN_URL}/${this.sendKey}.send`;
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ title, desp: content }).toString(),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        return {
          success: false,
          error: `ServerChan returned HTTP ${response.status}`,
        };
      }

      const body = await response.json().catch(() => null);
      if (!body || typeof body !== 'object') {
        return { success: false, error: 'ServerChan returned non-JSON response' };
      }

      // Server酱返回格式：{ code: 0, message: "success", data: { errno: 0, errmsg: "success" } }
      // 或者旧格式：{ errno: 0, errmsg: "success" }
      const errno = body?.data?.errno ?? body?.errno;
      const errmsg = body?.data?.errmsg ?? body?.errmsg ?? body?.message;

      if (errno === 0 || errno === '0') {
        return { success: true, serverchanErrno: 0, serverchanErrmsg: typeof errmsg === 'string' ? errmsg : undefined };
      }

      return {
        success: false,
        serverchanErrno: typeof errno === 'number' ? errno : undefined,
        serverchanErrmsg: typeof errmsg === 'string' ? errmsg : undefined,
        error: `ServerChan notification failed: ${typeof errmsg === 'string' ? errmsg : 'unknown error'}`,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      // 脱敏——报错中可能包含 URL key 片段，使用泛化消息
      if (message.includes('aborted') || (err instanceof DOMException && err.name === 'AbortError')) {
        return { success: false, error: 'ServerChan notification timed out' };
      }
      if (message.includes('fetch') || message.includes('ENOTFOUND') || message.includes('ECONNREFUSED')) {
        return { success: false, error: 'ServerChan unreachable' };
      }
      // 通用脱敏：不输出原始 message（可能含 key）
      return { success: false, error: 'ServerChan notification failed' };
    }
  }
}

/** 无操作通知器（SendKey 未配置时使用） */
export class NoopNotifier implements Notifier {
  isConfigured(): boolean {
    return false;
  }

  async send(_payload: NotifyPayload): Promise<NotifyResult> {
    return { success: false, error: 'Notifier not configured' };
  }
}

/**
 * 工厂——返回可用的通知器。
 * 如果 SendKey 已配置则返回 ServerChanNotifier，否则返回 NoopNotifier。
 * 单例缓存，避免重复读取外部文件。
 */
let _notifier: Notifier | undefined;

export function getNotifier(): Notifier {
  if (!_notifier) {
    const notifier = new ServerChanNotifier();
    _notifier = notifier.isConfigured() ? notifier : new NoopNotifier();
  }
  return _notifier;
}

/** 仅供测试——重置单例缓存 */
export function resetNotifier(): void {
  _notifier = undefined;
}
