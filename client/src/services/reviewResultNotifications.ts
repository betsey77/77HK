import type { BookmarkedCopy } from '../types';

export const OPEN_REVIEWED_FAVORITE_EVENT = 'open-reviewed-favorite';
const STORAGE_PREFIX = 'hk-cantonese-bookmark-review-seen:';
const MAX_SEEN_RESULTS = 100;
const memorySeen = new Map<string, string[]>();

export function getReviewResultStorageKey(ownerId: string): string {
  return `${STORAGE_PREFIX}${ownerId}`;
}

export function buildReviewResultKey(
  ownerId: string,
  bookmark: BookmarkedCopy,
): string | null {
  const review = bookmark.adminReview;
  if (!ownerId || !review?.updatedAt || !bookmark.contentRevision) return null;
  if (review.status !== 'adopted' && review.status !== 'changes_requested') return null;
  return [ownerId, bookmark.id, bookmark.contentRevision, review.updatedAt, review.status].join('|');
}

export function readSeenReviewResults(ownerId: string): string[] {
  const storageKey = getReviewResultStorageKey(ownerId);
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
      memorySeen.set(storageKey, parsed);
      return parsed;
    }
  } catch {
    // The in-memory copy still prevents repeated prompts in this tab.
  }
  return memorySeen.get(storageKey) ?? [];
}

export function markReviewResultSeen(ownerId: string, resultKey: string): void {
  const storageKey = getReviewResultStorageKey(ownerId);
  const previous = readSeenReviewResults(ownerId);
  const next = [...previous.filter(key => key !== resultKey), resultKey].slice(-MAX_SEEN_RESULTS);
  memorySeen.set(storageKey, next);
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // Session-level deduplication remains available through memorySeen.
  }
}

export function selectLatestUnseenReview(
  ownerId: string,
  bookmarks: BookmarkedCopy[],
): { bookmark: BookmarkedCopy; resultKey: string } | null {
  const seen = new Set(readSeenReviewResults(ownerId));
  return bookmarks
    .map(bookmark => ({ bookmark, resultKey: buildReviewResultKey(ownerId, bookmark) }))
    .filter((item): item is { bookmark: BookmarkedCopy; resultKey: string } => (
      item.resultKey !== null && !seen.has(item.resultKey)
    ))
    .sort((a, b) => (
      b.bookmark.adminReview!.updatedAt.localeCompare(a.bookmark.adminReview!.updatedAt)
    ))[0] ?? null;
}
