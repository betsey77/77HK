/**
 * Favorite-only publish platform helpers.
 * Does not change workbench global generation platform (AppSettings.platform).
 */
import { VARIANT_TABS } from '../constants';
import type { BookmarkedCopy, VariantKey } from '../types';

/** Allowed publish-platform values for a favorite snapshot (5 variants + 全部). */
export const PUBLISH_PLATFORM_OPTIONS: Array<{ value: string; label: string }> = [
  ...VARIANT_TABS.map((t) => ({ value: t.key, label: t.label })),
  { value: 'all', label: '全部平台' },
];

const VALID_PUBLISH = new Set(PUBLISH_PLATFORM_OPTIONS.map((o) => o.value));

export function isValidPublishPlatform(value: unknown): value is string {
  return typeof value === 'string' && VALID_PUBLISH.has(value);
}

/**
 * Effective publish platform for a favorite:
 * 1) settings.publishPlatform if set
 * 2) else settings.platform when not "all"
 * 3) else variantKey (never default to showing "全部平台" for old all-platform snapshots)
 */
export function resolveBookmarkPublishPlatform(
  settings: { platform?: string; publishPlatform?: string } | null | undefined,
  variantKey: string,
): string {
  const pp = settings?.publishPlatform;
  if (typeof pp === 'string' && pp.trim()) {
    const t = pp.trim();
    if (VALID_PUBLISH.has(t)) return t;
    return t;
  }
  const p = settings?.platform;
  if (typeof p === 'string' && p.trim() && p.trim() !== 'all') {
    return p.trim();
  }
  return variantKey || 'all';
}

export function publishPlatformLabel(value: string): string {
  return PUBLISH_PLATFORM_OPTIONS.find((o) => o.value === value)?.label
    ?? VARIANT_TABS.find((t) => t.key === value)?.label
    ?? value;
}

/** Build settings snapshot for a new bookmark: default publish = variant, keep generation platform. */
export function withDefaultPublishPlatform<T extends { platform?: string; publishPlatform?: string }>(
  settings: T,
  variantKey: VariantKey | string,
): T & { publishPlatform: string } {
  return {
    ...settings,
    publishPlatform: variantKey,
  };
}

export function getBookmarkPublishPlatform(bookmark: BookmarkedCopy): string {
  return resolveBookmarkPublishPlatform(bookmark.settings, bookmark.variantKey);
}
