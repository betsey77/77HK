import { Star } from 'lucide-react';
import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import type { BookmarkedCopy } from '../../types';

interface BookmarkButtonProps {
  /** If bookmark exists, its id; otherwise undefined */
  bookmarkId?: string;
  /** Build a new bookmark payload when saving */
  buildBookmark: () => BookmarkedCopy;
}

export default function BookmarkButton({ bookmarkId, buildBookmark }: BookmarkButtonProps) {
  const { dispatch } = useContext(AppContext);

  const isBookmarked = !!bookmarkId;

  const handleToggle = () => {
    if (isBookmarked) {
      dispatch({ type: 'REMOVE_BOOKMARK', payload: bookmarkId! });
    } else {
      dispatch({ type: 'ADD_BOOKMARK', payload: buildBookmark() });
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`p-0.5 rounded transition-all ${
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
  );
}
