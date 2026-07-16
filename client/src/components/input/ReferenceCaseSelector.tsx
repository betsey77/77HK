import { useContext, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Star, StickyNote, Bookmark } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { usePlanAccess } from '../../context/PlanAccessContext';
import { getAccessibleBookmarks } from '../../services/planLimits';
import { REASON_TAGS } from '../../types';

/**
 * Lets users select up to three highly-rated bookmarks as generation references.
 * The list starts collapsed so the settings column stays compact.
 */
export default function ReferenceCaseSelector() {
  const { state, dispatch } = useContext(AppContext);
  const { planId } = usePlanAccess();
  const [isExpanded, setIsExpanded] = useState(false);

  const ratedBookmarks = useMemo(
    () =>
      getAccessibleBookmarks(state.bookmarkedCopies, planId)
        .filter((bookmark) => (bookmark.rating ?? 0) >= 4)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.savedAt.localeCompare(a.savedAt))
        .slice(0, 10),
    [planId, state.bookmarkedCopies],
  );

  const eligibleIds = useMemo(
    () => new Set(ratedBookmarks.map((bookmark) => bookmark.id)),
    [ratedBookmarks],
  );
  const selectedIds = (state.settings.selectedReferenceCaseIds ?? [])
    .filter((id) => eligibleIds.has(id));

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      dispatch({
        type: 'SET_SELECTED_REFERENCE_CASES',
        payload: selectedIds.filter((selectedId) => selectedId !== id),
      });
    } else if (selectedIds.length < 3) {
      dispatch({
        type: 'SET_SELECTED_REFERENCE_CASES',
        payload: [...selectedIds, id],
      });
    }
  };

  const clearAll = () => {
    dispatch({ type: 'SET_SELECTED_REFERENCE_CASES', payload: [] });
  };

  return (
    <div
      data-testid="reference-case-selector"
      className="shrink-0 overflow-hidden rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] light:border-orange-400/30 light:bg-orange-50/60"
    >
      <div className="flex items-center gap-1">
        <Bookmark className="ml-2 h-3.5 w-3.5 shrink-0 text-emerald-400/60 light:text-orange-400" />
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls="reference-case-list"
          onClick={() => setIsExpanded(value => !value)}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 px-1 py-2 text-left text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300 light:text-orange-600 light:hover:text-orange-700"
        >
          <span className="truncate">
            参考收藏案例{' '}
            <span className="font-normal text-emerald-600/70 light:text-orange-500/80">
              （可用 {ratedBookmarks.length} 条 · 已选 {selectedIds.length}/3）
            </span>
          </span>
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
        </button>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="mr-2 text-[10px] text-gray-500 transition-colors hover:text-gray-300 light:hover:text-gray-700"
          >
            清除
          </button>
        )}
      </div>

      {isExpanded && (
        <div id="reference-case-list" className="space-y-1.5 border-t border-emerald-500/20 px-2.5 pb-2.5 pt-2 light:border-orange-400/30">
          <p className="text-[10px] leading-relaxed text-gray-500">
            选择你之前评分 ≥4 的收藏案例，AI 将在生成时参考其技法风格
          </p>

          {ratedBookmarks.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-700/40 px-3 py-3 text-center light:border-gray-300">
              <p className="text-[11px] text-gray-400 light:text-gray-600">
                暂无可用案例
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-gray-500">
                收藏并评分 4 星或以上的文案后，即可在这里选作生成参考。
              </p>
            </div>
          ) : (
            <div className="max-h-[200px] space-y-1 overflow-y-auto">
              {ratedBookmarks.map((bookmark) => {
              const isSelected = selectedIds.includes(bookmark.id);
              const tags = (bookmark.reasonTags ?? [])
                .map((tag) => REASON_TAGS.find((reasonTag) => reasonTag.key === tag)?.label)
                .filter(Boolean)
                .slice(0, 2);

                return (
                  <button
                  type="button"
                  key={bookmark.id}
                  onClick={() => toggle(bookmark.id)}
                  disabled={!isSelected && selectedIds.length >= 3}
                  className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    isSelected
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 light:text-amber-700'
                      : 'border-gray-700/20 bg-gray-800/30 text-gray-400 hover:border-amber-500/20 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40 light:border-gray-300/30 light:bg-gray-100 light:text-gray-600'
                  }`}
                >
                  <div className="mb-0.5 flex items-center gap-1.5">
                    {isSelected && <span className="shrink-0 text-[10px] text-amber-400">✓</span>}
                    <span className="line-clamp-1 text-[11px]">
                      {bookmark.content.slice(0, 60)}{bookmark.content.length > 60 ? '…' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {bookmark.rating && (
                      <span className="flex items-center gap-0.5 text-amber-400">
                        <Star className="h-2.5 w-2.5" fill="currentColor" />
                        {bookmark.rating}
                      </span>
                    )}
                    {tags.length > 0 && <span className="text-gray-500">{tags.join(' · ')}</span>}
                  </div>
                  {bookmark.notes?.trim() && (
                    <div className="mt-1.5 flex items-start gap-1 rounded bg-amber-500/10 px-1.5 py-1 text-[10px] leading-relaxed text-amber-300 light:bg-amber-50 light:text-amber-700">
                      <StickyNote className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                      <span className="line-clamp-2">{bookmark.notes}</span>
                    </div>
                  )}
                  </button>
                );
              })}
            </div>
          )}

          {selectedIds.length > 0 && (
            <p className="text-[10px] text-amber-400/80 light:text-amber-600">
              ✓ 已选 {selectedIds.length} 条参考案例 — 将在下次生成时作为 Few-Shot 参考注入 Prompt
            </p>
          )}
        </div>
      )}
    </div>
  );
}
