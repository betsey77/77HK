import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import type { BookmarkedCopy } from '../../types';
import {
  OPEN_REVIEWED_FAVORITE_EVENT,
  markReviewResultSeen,
  publishReviewResultDialogVisibility,
  selectLatestUnseenReview,
} from '../../services/reviewResultNotifications';
import { fetchReviewResultSummary } from '../../services/cloudSync';
import { useVisiblePolling } from '../../hooks/useVisiblePolling';

interface ReviewResultNotifierProps {
  ownerId: string;
  onReviewVersionChanged?: () => void;
}

interface PendingResult {
  bookmark: BookmarkedCopy;
  resultKey: string;
}

export default function ReviewResultNotifier({
  ownerId,
  onReviewVersionChanged,
}: ReviewResultNotifierProps) {
  const { state } = useContext(AppContext);
  const [pending, setPending] = useState<PendingResult | null>(null);
  const latestReviewUpdatedAt = state.bookmarkedCopies.reduce<string | null>((latest, bookmark) => {
    const updatedAt = bookmark.adminReview?.updatedAt;
    return updatedAt && (!latest || updatedAt > latest) ? updatedAt : latest;
  }, null);
  const lastReviewVersionRef = useRef<string | null>(latestReviewUpdatedAt);

  useEffect(() => {
    if (state.bookmarkedCopies.length === 0) return;
    setPending(selectLatestUnseenReview(ownerId, state.bookmarkedCopies));
  }, [ownerId, state.bookmarkedCopies]);

  useEffect(() => {
    lastReviewVersionRef.current = latestReviewUpdatedAt;
  }, [ownerId, latestReviewUpdatedAt]);

  const pollReviewVersion = useCallback(async () => {
    const summary = await fetchReviewResultSummary(ownerId);
    if (summary.latestUpdatedAt === lastReviewVersionRef.current) return true;
    lastReviewVersionRef.current = summary.latestUpdatedAt;
    onReviewVersionChanged?.();
    return true;
  }, [onReviewVersionChanged, ownerId]);

  useVisiblePolling(pollReviewVersion, Boolean(onReviewVersionChanged));

  const review = pending?.bookmark.adminReview;
  const dialogOpen = Boolean(pending && review);

  useEffect(() => {
    publishReviewResultDialogVisibility(ownerId, dialogOpen);
    return () => {
      if (!dialogOpen) return;
      publishReviewResultDialogVisibility(ownerId, false);
    };
  }, [dialogOpen, ownerId]);

  if (!pending || !review) return null;

  const { bookmark, resultKey } = pending;
  const approved = review.status === 'adopted';
  const brandName = bookmark.settings.brandName?.trim();
  const subject = brandName ? `你的「${brandName}」文案` : '你的文案';

  const dismiss = () => {
    markReviewResultSeen(ownerId, resultKey);
    setPending(null);
  };

  const openFavorite = () => {
    dismiss();
    window.dispatchEvent(new CustomEvent(OPEN_REVIEWED_FAVORITE_EVENT, {
      detail: { favoriteId: bookmark.id },
    }));
  };

  return (
    <aside
      role="dialog"
      aria-label="文案审核结果"
      className={`fixed bottom-4 right-4 z-[70] w-[min(24rem,calc(100vw-2rem))] border bg-gray-950 p-4 shadow-2xl light:bg-white ${
        approved
          ? 'border-emerald-500/60 light:border-emerald-300'
          : 'border-amber-500/70 light:border-amber-300'
      }`}
    >
      <div className="flex items-start gap-3">
        {approved ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400 light:text-emerald-600" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400 light:text-amber-600" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-100 light:text-gray-900">文案审核结果</p>
          <p className="mt-1 text-sm leading-6 text-gray-300 light:text-gray-700">
            {subject}{approved ? '已通过审核' : '未通过审核'}，请立即查看
          </p>
          {!approved && review.note && (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500 light:text-gray-500">
              审核意见：{review.note}
            </p>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="px-2.5 py-1.5 text-xs text-gray-400 hover:text-gray-200 light:text-gray-600 light:hover:text-gray-900"
            >
              稍后查看
            </button>
            <button
              type="button"
              onClick={openFavorite}
              className="bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-gray-950 hover:bg-emerald-400 light:bg-orange-500 light:text-white light:hover:bg-orange-600"
            >
              立即查看
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
