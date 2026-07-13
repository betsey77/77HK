import { useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { X, Trash2, Star, ExternalLink, ChevronDown, ChevronUp, Copy, Check, StickyNote } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import type { BookmarkedCopy, VariantKey } from '../../types';
import { REASON_TAGS } from '../../types';
import { VARIANT_TABS } from '../../constants';
import ConfirmDialog from '../shared/ConfirmDialog';

interface FavoritesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function variantLabel(key: VariantKey): string {
  return VARIANT_TABS.find(t => t.key === key)?.label ?? key;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-HK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Single star for rating display or click */
function StarButton({
  filled,
  onClick,
  size = 'sm',
}: {
  filled: boolean;
  onClick?: () => void;
  size?: 'sm' | 'xs';
}) {
  const dims = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${dims} transition-colors ${
          filled
            ? 'text-amber-400 hover:text-amber-300'
            : 'text-gray-600 hover:text-amber-500'
        }`}
      >
        <Star className={dims} fill={filled ? 'currentColor' : 'none'} />
      </button>
    );
  }
  return (
    <Star
      className={`${dims} ${filled ? 'text-amber-400' : 'text-gray-600'}`}
      fill={filled ? 'currentColor' : 'none'}
    />
  );
}

function BookmarkCard({ bookmark }: { bookmark: BookmarkedCopy }) {
  const { dispatch } = useContext(AppContext);
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(bookmark.notes ?? '');
  const [showRating, setShowRating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!editingNotes) setNotesText(bookmark.notes ?? '');
  }, [bookmark.notes, editingNotes]);

  // ---- Copy to clipboard ----
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(bookmark.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = bookmark.content;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* ignore */ }
      document.body.removeChild(textarea);
    }
  }, [bookmark.content]);

  // ---- Rating ----
  const currentRating = bookmark.rating ?? 0;
  const handleSetRating = useCallback(
    (rating: number) => {
      dispatch({
        type: 'UPDATE_BOOKMARK_RATING',
        payload: {
          id: bookmark.id,
          rating: rating === currentRating ? undefined : rating, // toggle off
          favoriteReason: bookmark.favoriteReason,
          reasonTags: bookmark.reasonTags,
        },
      });
    },
    [bookmark.id, bookmark.favoriteReason, bookmark.reasonTags, currentRating, dispatch],
  );

  // ---- Reason tags ----
  const selectedTags = bookmark.reasonTags ?? [];
  const handleToggleTag = useCallback(
    (tagKey: string) => {
      const nextTags = selectedTags.includes(tagKey)
        ? selectedTags.filter(t => t !== tagKey)
        : [...selectedTags, tagKey];
      dispatch({
        type: 'UPDATE_BOOKMARK_RATING',
        payload: {
          id: bookmark.id,
          rating: bookmark.rating,
          favoriteReason: bookmark.favoriteReason,
          reasonTags: nextTags,
        },
      });
    },
    [bookmark.id, bookmark.rating, bookmark.favoriteReason, selectedTags, dispatch],
  );

  // ---- Custom reason ----
  const handleSetCustomReason = useCallback(
    (text: string) => {
      dispatch({
        type: 'UPDATE_BOOKMARK_RATING',
        payload: {
          id: bookmark.id,
          rating: bookmark.rating,
          favoriteReason: text || undefined,
          reasonTags: bookmark.reasonTags,
        },
      });
    },
    [bookmark.id, bookmark.rating, bookmark.reasonTags, dispatch],
  );

  const handleLoadParams = () => {
    dispatch({
      type: 'LOAD_CONFIG',
      payload: {
        id: bookmark.id,
        name: `收藏 · ${variantLabel(bookmark.variantKey)} · ${formatDate(bookmark.savedAt)}`,
        brandName: bookmark.settings.brandName,
        productName: bookmark.settings.productName,
        brandRedLines: bookmark.settings.brandRedLines,
        structuredBriefEnabled: bookmark.settings.structuredBriefEnabled,
        creativityLevel: bookmark.settings.creativityLevel,
        cantoneseLevel: bookmark.settings.cantoneseLevel,
        englishMixingLevel: bookmark.settings.englishMixingLevel,
        tone: bookmark.settings.tone,
        platform: bookmark.settings.platform,
        inputLanguage: bookmark.settings.inputLanguage,
        consumerPersonas: bookmark.settings.consumerPersonas,
        targetDate: bookmark.settings.targetDate,
        competitorQueries: bookmark.settings.competitorQueries,
        createdAt: bookmark.savedAt,
      },
    });
  };

  const handleSaveNotes = () => {
    const normalizedNotes = notesText.trim();
    dispatch({
      type: 'UPDATE_BOOKMARK_NOTES',
      payload: { id: bookmark.id, notes: normalizedNotes },
    });
    setNotesText(normalizedNotes);
    setEditingNotes(false);
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    dispatch({ type: 'REMOVE_BOOKMARK', payload: bookmark.id });
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  return (
    <div className="bg-gray-800/40 light:bg-gray-100 border border-gray-700/30 light:border-gray-300/50 rounded-lg overflow-hidden">
      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="确认删除此收藏？"
        message="删除后将从收藏库移除，但不会影响已生成的文案。此操作不可撤销。"
        preview={bookmark.content.slice(0, 150)}
        danger
        confirmLabel="确认删除"
        cancelLabel="取消"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
      {/* Header: variant tag + date + action buttons */}
      <div className="flex items-start justify-between p-3 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 light:text-amber-600 font-medium">
            {variantLabel(bookmark.variantKey)}
          </span>
          <span className="text-[10px] text-gray-500">{formatDate(bookmark.savedAt)}</span>
        </div>
        {/* 🆕 Top-right action buttons: Copy + Delete */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={handleCopy}
            className={`p-1 rounded transition-colors ${
              copied
                ? 'text-emerald-400 bg-emerald-500/15'
                : 'text-gray-500 hover:text-emerald-400 light:hover:text-emerald-600'
            }`}
            title={copied ? '已复制！' : '复制文案'}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={handleLoadParams}
            className="p-1 rounded text-gray-500 hover:text-amber-400 light:hover:text-amber-600 transition-colors"
            title="载入参数以微调"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDeleteClick}
            className="p-1 rounded text-gray-500 hover:text-red-400 transition-colors"
            title="删除收藏"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content preview */}
      <div className="px-3 pb-1">
        <p className="text-sm text-gray-300 light:text-gray-800 leading-relaxed line-clamp-3 whitespace-pre-wrap">
          {bookmark.content}
        </p>
      </div>

      {/* 🆕 Rating bar (always visible summary, expandable) */}
      <div className="px-3 pb-1">
        {!showRating && (currentRating > 0 || selectedTags.length > 0 || (bookmark.favoriteReason)) ? (
          /* Collapsed rating summary */
          <button
            onClick={() => setShowRating(true)}
            className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-amber-400 transition-colors flex-wrap"
          >
            {currentRating > 0 && (
              <span className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarButton key={i} filled={i < currentRating} size="xs" />
                ))}
              </span>
            )}
            {selectedTags.length > 0 && (
              <span className="text-gray-500">
                {selectedTags.map(t => REASON_TAGS.find(rt => rt.key === t)?.label).filter(Boolean).join(' · ')}
              </span>
            )}
            {bookmark.favoriteReason && (
              <span className="text-gray-400 light:text-gray-600 italic">
                「{bookmark.favoriteReason}」
              </span>
            )}
            <span className="text-gray-600">（点击编辑评价）</span>
          </button>
        ) : !showRating && currentRating === 0 && selectedTags.length === 0 ? (
          /* No rating yet — prompt */
          <button
            onClick={() => setShowRating(true)}
            className="text-[10px] text-gray-600 hover:text-amber-400 transition-colors"
          >
            ⭐ 点击评分，帮助 AI 学习你的偏好
          </button>
        ) : null}
      </div>

      {/* 🆕 Expanded rating editor */}
      {showRating && (
        <div className="px-3 pb-2 border-t border-gray-700/20 light:border-gray-300/30 pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-gray-500">评分</span>
            <button
              onClick={() => setShowRating(false)}
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              收起 ▲
            </button>
          </div>

          {/* Star rating row */}
          <div className="flex items-center gap-1 mb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <StarButton
                key={i}
                filled={i < currentRating}
                onClick={() => handleSetRating(i + 1)}
              />
            ))}
            {currentRating > 0 && (
              <span className="text-[10px] text-amber-400 ml-1">
                {currentRating}/5
              </span>
            )}
          </div>

          {/* Reason tags */}
          <div className="mb-2">
            <p className="text-[10px] text-gray-500 mb-1">这条文案好在哪？（可多选）</p>
            <div className="flex flex-wrap gap-1">
              {REASON_TAGS.map(tag => {
                const isSelected = selectedTags.includes(tag.key);
                return (
                  <button
                    key={tag.key}
                    onClick={() => handleToggleTag(tag.key)}
                    className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                      isSelected
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 light:text-emerald-600'
                        : 'bg-gray-800/30 light:bg-gray-100 border-gray-700/20 light:border-gray-300/30 text-gray-500 hover:border-emerald-500/30 hover:text-emerald-400'
                    }`}
                    title={tag.description}
                  >
                    {isSelected ? '✓ ' : ''}{tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom reason input */}
          <div>
            <input
              type="text"
              value={bookmark.favoriteReason ?? ''}
              onChange={e => handleSetCustomReason(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              onBlur={() => {
                // Save on blur — dispatch is already called onChange via handleSetCustomReason
              }}
              placeholder="自定义原因（可选）..."
              className="w-full text-[11px] bg-gray-900/60 light:bg-white border border-gray-600/40 light:border-gray-400 rounded px-2 py-1 text-gray-200 light:text-gray-800 focus:outline-none focus:border-amber-500/50 placeholder:text-gray-600"
            />
          </div>
        </div>
      )}

      {!expanded && bookmark.notes?.trim() && (
        <div className="px-3 pb-2">
          <button
            type="button"
            aria-label="查看收藏备注"
            onClick={() => setExpanded(true)}
            className="flex w-full items-start gap-1.5 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-left text-[11px] leading-relaxed text-amber-300 transition-colors hover:bg-amber-500/15 light:border-amber-300 light:bg-amber-50 light:text-amber-700 light:hover:bg-amber-100"
          >
            <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="line-clamp-2">{bookmark.notes}</span>
          </button>
        </div>
      )}

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={expanded ? '收起参数详情' : '查看参数详情'}
        className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-gray-500 hover:text-gray-300 light:hover:text-gray-700 transition-colors border-t border-gray-700/20 light:border-gray-300/30"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? '收起参数详情' : '查看参数详情'}
      </button>

      {/* Expanded details (existing) */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-700/20 light:border-gray-300/30">
          {/* Source text */}
          {bookmark.source && (
            <div className="mt-2">
              <p className="text-[10px] text-gray-500 mb-1">📝 原始输入</p>
              <p className="text-xs text-gray-400 light:text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-4">
                {bookmark.source}
              </p>
            </div>
          )}

          {/* Generation parameters */}
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            <ParamRow label="平台" value={bookmark.settings.platform} />
            <ParamRow label="语气" value={bookmark.settings.tone} />
            <ParamRow label="粤语程度" value={`${bookmark.settings.cantoneseLevel}/5`} />
            <ParamRow label="中英夹杂" value={`${bookmark.settings.englishMixingLevel}/5`} />
            <ParamRow label="创作自由度" value={`${bookmark.settings.creativityLevel}/4`} />
            <ParamRow label="输入语言" value={bookmark.settings.inputLanguage === 'mandarin' ? '普通话' : '粤语'} />
            {bookmark.settings.brandName && <ParamRow label="品牌" value={bookmark.settings.brandName} />}
            {bookmark.settings.productName && <ParamRow label="产品" value={bookmark.settings.productName} />}
            {bookmark.settings.structuredBriefEnabled && (
              <ParamRow label="结构化简报" value="已启用" />
            )}
            {bookmark.settings.targetDate && <ParamRow label="目标日期" value={bookmark.settings.targetDate} />}
          </div>

          {/* Scores snapshot */}
          {bookmark.scores?.generated && (
            <div className="mt-2">
              <p className="text-[10px] text-gray-500 mb-1">📊 审核评分</p>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: '港味', v: bookmark.scores.generated.cantoneseNaturalness },
                  { label: '安全', v: bookmark.scores.generated.brandSafety },
                  { label: '平台', v: bookmark.scores.generated.platformFit },
                  { label: '可读', v: bookmark.scores.generated.readability },
                  { label: '创意', v: bookmark.scores.generated.creativity },
                ].map(({ label, v }) => (
                  <span key={label} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/30 light:bg-gray-200 text-gray-400 light:text-gray-600">
                    {label} {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mt-2">
            <p className="text-[10px] text-gray-500 mb-1">🗒 备注</p>
            {editingNotes ? (
              <div className="flex gap-1">
                <input
                  type="text"
                  value={notesText}
                  onChange={e => setNotesText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveNotes();
                    if (e.key === 'Escape') { setNotesText(bookmark.notes ?? ''); setEditingNotes(false); }
                  }}
                  className="flex-1 text-xs bg-gray-900/60 light:bg-white border border-gray-600/40 light:border-gray-400 rounded px-2 py-1 text-gray-200 light:text-gray-800 focus:outline-none focus:border-amber-500/50"
                  placeholder="添加备注..."
                  autoFocus
                />
                <button
                  type="button"
                  aria-label="储存备注"
                  onClick={handleSaveNotes}
                  className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                >
                  储存
                </button>
              </div>
            ) : (
              <button
                type="button"
                aria-label="编辑收藏备注"
                onClick={() => setEditingNotes(true)}
                className="block min-h-[1.2em] w-full text-left text-xs text-gray-400 hover:text-gray-300 light:text-gray-600 light:hover:text-gray-700"
              >
                {bookmark.notes || '点击添加备注...'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ParamRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1 text-xs">
      <span className="text-gray-500 shrink-0">{label}:</span>
      <span className="text-gray-300 light:text-gray-700 truncate">{value}</span>
    </div>
  );
}

export default function FavoritesPanel({ isOpen, onClose }: FavoritesPanelProps) {
  const { state } = useContext(AppContext);
  const { bookmarkedCopies } = state;

  // Group by date (today, yesterday, this week, older)
  const grouped = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);

    const groups: { label: string; items: BookmarkedCopy[] }[] = [];
    const todayItems: BookmarkedCopy[] = [];
    const yesterdayItems: BookmarkedCopy[] = [];
    const weekItems: BookmarkedCopy[] = [];
    const olderItems: BookmarkedCopy[] = [];

    for (const b of bookmarkedCopies) {
      const d = new Date(b.savedAt);
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      if (day.getTime() >= today.getTime()) {
        todayItems.push(b);
      } else if (day.getTime() >= yesterday.getTime()) {
        yesterdayItems.push(b);
      } else if (day.getTime() >= weekAgo.getTime()) {
        weekItems.push(b);
      } else {
        olderItems.push(b);
      }
    }

    if (todayItems.length) groups.push({ label: '今天', items: todayItems });
    if (yesterdayItems.length) groups.push({ label: '昨天', items: yesterdayItems });
    if (weekItems.length) groups.push({ label: '本周', items: weekItems });
    if (olderItems.length) groups.push({ label: '更早', items: olderItems });

    return groups;
  }, [bookmarkedCopies]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md h-full bg-gray-950 light:bg-white border-l border-gray-800 light:border-gray-300 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 light:border-gray-300 shrink-0">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" fill="currentColor" />
            <h2 className="text-sm font-semibold text-gray-200 light:text-gray-800">
              文案收藏库
            </h2>
            {bookmarkedCopies.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 light:bg-gray-200 text-gray-400 light:text-gray-600">
                {bookmarkedCopies.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-500 hover:text-gray-300 light:hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {bookmarkedCopies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="text-4xl opacity-30">⭐</div>
              <p className="text-sm text-gray-500">暂无收藏的文案</p>
              <p className="text-xs text-gray-600 light:text-gray-500 max-w-xs">
                生成文案后，点击文案卡片右上角的 ☆ 即可收藏。收藏后可以查看生成参数、复制文案、评分，方便微调和复用。
              </p>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.label}>
                <p className="text-[10px] text-gray-500 mb-2 font-medium">{group.label}</p>
                <div className="space-y-2">
                  {group.items.map(b => (
                    <BookmarkCard key={b.id} bookmark={b} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {bookmarkedCopies.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-800 light:border-gray-300 shrink-0">
            <p className="text-[10px] text-gray-500">
              点击 <Copy className="w-3 h-3 inline text-emerald-400" /> 复制文案 ·
              点击 <Star className="w-3 h-3 inline text-amber-400" fill="currentColor" /> 评分为 AI 提供偏好反馈 ·
              点击 <ExternalLink className="w-3 h-3 inline" /> 载入参数
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
