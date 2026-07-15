import type { AdminPendingReviewSummary } from './api';

interface SeenPendingReviewSummary {
  count: number;
  latestRequestedAt: string | null;
}

export function recordAdminPendingReviewSummary(
  summary: AdminPendingReviewSummary,
  identity?: string | null,
): boolean {
  const key = `admin-review-reminder:${identity ?? 'admin'}`;
  const stored = sessionStorage.getItem(key);
  let seen: SeenPendingReviewSummary | null = null;

  if (stored) {
    try {
      seen = JSON.parse(stored) as SeenPendingReviewSummary;
    } catch {
      const [count, latestRequestedAt] = stored.split('|');
      seen = { count: Number(count) || 0, latestRequestedAt: latestRequestedAt || null };
    }
  }

  const latestMs = summary.latestRequestedAt ? Date.parse(summary.latestRequestedAt) : 0;
  const seenLatestMs = seen?.latestRequestedAt ? Date.parse(seen.latestRequestedAt) : 0;
  const hasNewTask = summary.count > 0 && (
    !seen
    || summary.count > seen.count
    || latestMs > seenLatestMs
  );

  sessionStorage.setItem(key, JSON.stringify({
    count: summary.count,
    latestRequestedAt: latestMs >= seenLatestMs
      ? summary.latestRequestedAt
      : seen?.latestRequestedAt ?? null,
  } satisfies SeenPendingReviewSummary));

  return hasNewTask;
}
