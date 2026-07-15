import type { BookmarkedCopy, PlanId } from '../types';

export const FREE_FAVORITE_LIMIT = 10;
export const FREE_HISTORY_LIMIT = 15;

export function getAccessibleBookmarks(
  bookmarks: BookmarkedCopy[],
  planId: PlanId,
): BookmarkedCopy[] {
  const newestFirst = [...bookmarks].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  return planId === 'pro' ? newestFirst : newestFirst.slice(0, FREE_FAVORITE_LIMIT);
}
