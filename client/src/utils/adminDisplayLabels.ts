/**
 * Admin UI display-only labels. Do not change API/DB enum values.
 */

import { SHORTS_TK_LABEL } from '../constants';

const COPY_TYPE_LABELS: Record<string, string> = {
  social: '社媒文案',
  spoken: '口播稿',
  poster: '海报短文',
  advertorial: '软文章',
  poetry: '诗歌',
  custom: '自定义',
};

const PLATFORM_LABELS: Record<string, string> = {
  all: '全部平台',
  ig: 'IG',
  facebook: 'Facebook',
  shorts: SHORTS_TK_LABEL,
  standardHK: '标准繁中',
  lightCantonese: '轻粤语',
};

/** reasonTags English keys → Chinese labels (UI only; DB keeps English keys). */
const REASON_TAG_LABELS: Record<string, string> = {
  hook: '开场吸睛',
  tone: '语气贴地',
  cta: '行动引导有力',
  rhythm: '句式节奏好',
  emoji: '表情自然',
  brand: '品牌调性匹配',
  creative: '创意突出',
  audience: '适合目标受众',
};

function emptyToMissing(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/** Map copyType enum → Chinese; unknown/empty → 未填写 */
export function formatAdminCopyType(value: string | null | undefined): string {
  const key = emptyToMissing(value);
  if (!key) return '未填写';
  return COPY_TYPE_LABELS[key] ?? '未填写';
}

/**
 * Map platform / variantKey → Chinese; unknown/empty → 未填写.
 * Prefer platform; callers may pass variantKey as fallback.
 */
export function formatAdminPlatform(value: string | null | undefined): string {
  const key = emptyToMissing(value);
  if (!key) return '未填写';
  return PLATFORM_LABELS[key] ?? '未填写';
}

/**
 * Resolve which platform key to show for a favorite:
 * publishPlatform → non-all platform → variantKey.
 * Never prefer bare "all" when a variantKey exists.
 */
export function resolveFavoritePublishPlatform(meta: {
  publishPlatform?: string | null;
  platform?: string | null;
  variantKey?: string | null;
}): string | null {
  const pp = emptyToMissing(meta.publishPlatform);
  if (pp) return pp;
  const p = emptyToMissing(meta.platform);
  if (p && p !== 'all') return p;
  const vk = emptyToMissing(meta.variantKey);
  if (vk) return vk;
  return p;
}

/** Single reason tag → Chinese; unknown → 自定义标签 (never leak English key). */
export function formatAdminReasonTag(tag: string | null | undefined): string {
  const key = emptyToMissing(tag);
  if (!key) return '自定义标签';
  return REASON_TAG_LABELS[key] ?? '自定义标签';
}

/** Join tags for list/detail; empty → 未填写. */
export function formatAdminReasonTags(tags: string[] | null | undefined): string {
  if (!tags || tags.length === 0) return '未填写';
  return tags.map((t) => formatAdminReasonTag(t)).join(' · ');
}
