import { Star } from 'lucide-react';
import { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { usePlanAccess } from '../../context/PlanAccessContext';
import { FREE_FAVORITE_LIMIT } from '../../services/planLimits';
import type { BookmarkedCopy } from '../../types';

interface BookmarkButtonProps {
  /** If bookmark exists, its id; otherwise undefined */
  bookmarkId?: string;
  /** Build a new bookmark payload when saving */
  buildBookmark: () => BookmarkedCopy;
}

export default function BookmarkButton({ bookmarkId, buildBookmark }: BookmarkButtonProps) {
  const { state, dispatch } = useContext(AppContext);
  const { planId, isLoading } = usePlanAccess();
  const [showLimitDialog, setShowLimitDialog] = useState(false);

  const isBookmarked = !!bookmarkId;

  const handleToggle = () => {
    if (isBookmarked) {
      dispatch({ type: 'REMOVE_BOOKMARK', payload: bookmarkId! });
    } else {
      if (planId === 'free' && state.bookmarkedCopies.length >= FREE_FAVORITE_LIMIT) {
        setShowLimitDialog(true);
        return;
      }
      dispatch({
        type: 'ADD_BOOKMARK',
        payload: {
          ...buildBookmark(),
          reviewRequested: true,
          reviewRequestedAt: null,
          adminReview: null,
        },
      });
    }
  };

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={!isBookmarked && isLoading}
        className={`p-0.5 rounded transition-all disabled:cursor-wait disabled:opacity-50 ${
          isBookmarked
            ? 'text-amber-400 hover:text-amber-300'
            : 'text-gray-500 hover:text-amber-400 light:text-gray-400 light:hover:text-amber-500'
        }`}
        title={isBookmarked ? '取消收藏' : '收藏此文案'}
      >
        <Star
          className="w-3.5 h-3.5"
          fill={isBookmarked ? 'currentColor' : 'none'}
          strokeWidth={isBookmarked ? 2.5 : 2}
        />
      </button>

      {showLimitDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="收藏容量已满"
            className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-950 p-5 shadow-2xl light:border-gray-200 light:bg-white"
          >
            <h2 className="text-base font-semibold text-gray-100 light:text-gray-900">收藏容量已满</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400 light:text-gray-600">
              Free 最多保存 {FREE_FAVORITE_LIMIT} 条收藏。删除旧收藏可释放容量，或升级 Pro 解锁全部收藏。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLimitDialog(false)}
                className="rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300 light:border-gray-300 light:text-gray-700"
              >
                暂不升级
              </button>
              <a
                href="/app/billing"
                className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-gray-950 light:bg-orange-500 light:text-white"
              >
                升级 Pro
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
