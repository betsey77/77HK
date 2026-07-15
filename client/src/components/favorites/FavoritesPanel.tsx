import { useContext, useState, useMemo, useCallback, useEffect, type FormEvent } from 'react';
import { X, Trash2, Star, ExternalLink, ChevronDown, ChevronUp, Copy, Check, StickyNote, Search, Pencil, Loader2, Plus } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { usePlanAccess } from '../../context/PlanAccessContext';
import { getAccessibleBookmarks } from '../../services/planLimits';
import type { BookmarkedCopy, CopyType, VariantKey } from '../../types';
import { REASON_TAGS } from '../../types';
import { VARIANT_TABS } from '../../constants';
import { COPY_TYPES, getCopyTypeLabel, isValidCustomCopyType } from '../../utils/w1Settings';
import {
  getBookmarkPublishPlatform,
  PUBLISH_PLATFORM_OPTIONS,
} from '../../utils/publishPlatform';
import ConfirmDialog from '../shared/ConfirmDialog';
import { updateFavoriteContent } from '../../services/cloudSync';
import { buildAnnotatedSegments } from '../../utils/reviewAnnotations';

interface FavoritesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  focusBookmarkId?: string | null;
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

function BookmarkCard({
  bookmark,
  selectionMode = false,
  selected = false,
  focused = false,
  onToggleSelected,
}: {
  bookmark: BookmarkedCopy;
  selectionMode?: boolean;
  selected?: boolean;
  focused?: boolean;
  onToggleSelected?: (id: string) => void;
}) {
  const { dispatch } = useContext(AppContext);
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState(bookmark.notes ?? '');
  const [showRating, setShowRating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingContent, setEditingContent] = useState(false);
  const [contentDraft, setContentDraft] = useState(bookmark.content);
  const [contentSaving, setContentSaving] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [showContentCancelConfirm, setShowContentCancelConfirm] = useState(false);
  const [customCopyTypeDraft, setCustomCopyTypeDraft] = useState(bookmark.settings.customCopyType ?? '');

  useEffect(() => {
    if (!editingNotes) setNotesText(bookmark.notes ?? '');
  }, [bookmark.notes, editingNotes]);

  useEffect(() => {
    if (!editingContent) setContentDraft(bookmark.content);
  }, [bookmark.content, editingContent]);

  useEffect(() => {
    setCustomCopyTypeDraft(bookmark.settings.customCopyType ?? '');
  }, [bookmark.settings.customCopyType]);

  const annotationView = useMemo(
    () => buildAnnotatedSegments(bookmark.content, bookmark.adminReview?.annotations),
    [bookmark.content, bookmark.adminReview?.annotations],
  );

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
        tone: bookmark.settings.primaryTone ?? bookmark.settings.tone,
        platform: bookmark.settings.platform,
        inputLanguage: bookmark.settings.inputLanguage,
        consumerPersonas: bookmark.settings.consumerPersonas,
        targetDate: bookmark.settings.targetDate,
        competitorQueries: bookmark.settings.competitorQueries,
        selectedReferenceCaseIds: bookmark.settings.selectedReferenceCaseIds,
        selectedCalendarEventIds: bookmark.settings.selectedCalendarEventIds,
        copyType: bookmark.settings.copyType,
        customCopyType: bookmark.settings.customCopyType,
        lengthControlEnabled: bookmark.settings.lengthControlEnabled,
        copyLengthLevel: bookmark.settings.copyLengthLevel,
        primaryTone: bookmark.settings.primaryTone ?? bookmark.settings.tone,
        toneModifiers: bookmark.settings.toneModifiers,
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

  const publishPlatform = getBookmarkPublishPlatform(bookmark);
  const handlePublishPlatformChange = useCallback(
    (value: string) => {
      dispatch({
        type: 'UPDATE_BOOKMARK_PUBLISH_PLATFORM',
        payload: { id: bookmark.id, publishPlatform: value },
      });
    },
    [bookmark.id, dispatch],
  );

  const handleCopyTypeChange = useCallback((copyType: CopyType) => {
    dispatch({
      type: 'UPDATE_BOOKMARK_COPY_TYPE',
      payload: {
        id: bookmark.id,
        copyType,
        customCopyType: copyType === 'custom'
          ? (isValidCustomCopyType(bookmark.settings.customCopyType) ? bookmark.settings.customCopyType : '其他文案')
          : '',
      },
    });
  }, [bookmark.id, bookmark.settings.customCopyType, dispatch]);

  const commitCustomCopyType = useCallback(() => {
    if (!isValidCustomCopyType(customCopyTypeDraft)) {
      setCustomCopyTypeDraft(bookmark.settings.customCopyType ?? '其他文案');
      return;
    }
    dispatch({
      type: 'UPDATE_BOOKMARK_COPY_TYPE',
      payload: { id: bookmark.id, copyType: 'custom', customCopyType: customCopyTypeDraft.trim() },
    });
  }, [bookmark.id, bookmark.settings.customCopyType, customCopyTypeDraft, dispatch]);

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

  const closeContentEditor = () => {
    setContentDraft(bookmark.content);
    setContentError(null);
    setEditingContent(false);
    setShowContentCancelConfirm(false);
  };

  const requestCloseContentEditor = () => {
    if (contentDraft !== bookmark.content) setShowContentCancelConfirm(true);
    else closeContentEditor();
  };

  const handleSaveContent = async () => {
    if (contentSaving) return;
    if (!contentDraft.trim()) {
      setContentError('文案不能为空');
      return;
    }
    if (contentDraft.length > 5000) {
      setContentError('文案不能超过 5000 字');
      return;
    }
    if (contentDraft === bookmark.content) {
      closeContentEditor();
      return;
    }
    setContentSaving(true);
    setContentError(null);
    try {
      const result = await updateFavoriteContent(bookmark.id, contentDraft);
      dispatch({
        type: 'UPDATE_BOOKMARK_CONTENT',
        payload: {
          id: bookmark.id,
          content: result.content,
          contentRevision: result.contentRevision ?? (bookmark.contentRevision ?? 1) + 1,
          contentEditedAt: result.contentEditedAt ?? new Date().toISOString(),
          reviewRequested: result.reviewRequested ?? true,
          reviewRequestedAt: result.reviewRequestedAt ?? null,
          adminReview: result.adminReview ?? null,
        },
      });
      setEditingContent(false);
    } catch {
      setContentError('保存失败，请检查网络后重试');
    } finally {
      setContentSaving(false);
    }
  };

  const brandProductLabel = [bookmark.settings.brandName, bookmark.settings.productName]
    .map(value => value?.trim())
    .filter(Boolean)
    .join(' · ');

  const hasCopyTypeField = bookmark.settings && 'copyType' in bookmark.settings;
  const copyTypeLabel = getCopyTypeLabel(bookmark.settings?.copyType, {
    legacyMissing: !hasCopyTypeField,
  });

  return (
    <div
      data-testid={`bookmark-card-${bookmark.id}`}
      data-bookmark-id={bookmark.id}
      data-focused={focused ? 'true' : 'false'}
      className={`bg-gray-800/40 light:bg-gray-100 border rounded-lg overflow-hidden transition-shadow ${
      focused
        ? 'border-emerald-400 ring-2 ring-emerald-400/60 light:border-orange-500 light:ring-orange-400/50'
        : selected
        ? 'border-emerald-500/60 light:border-orange-400'
        : 'border-gray-700/30 light:border-gray-300/50'
    }`}
    >
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
      <ConfirmDialog
        open={showContentCancelConfirm}
        title="放弃未保存的文案修改？"
        message="当前修改尚未保存，放弃后无法恢复。"
        preview={contentDraft.slice(0, 150)}
        confirmLabel="放弃修改"
        cancelLabel="继续编辑"
        onConfirm={closeContentEditor}
        onCancel={() => setShowContentCancelConfirm(false)}
      />
      {/* Header: wrapping meta (left) + fixed actions (right) — no overlap at narrow widths */}
      <div className="flex items-start gap-2 p-3 pb-1">
        <div data-testid="bookmark-card-meta" className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {selectionMode && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelected?.(bookmark.id)}
                aria-label={`选择收藏：${bookmark.content}`}
                className="h-3.5 w-3.5 shrink-0 accent-emerald-500 light:accent-orange-500"
              />
            )}
            {brandProductLabel && (
              <span
                className="max-w-full truncate text-[10px] font-medium text-red-400 light:text-red-600"
                title={brandProductLabel}
              >
                {brandProductLabel}
              </span>
            )}
            <select
              value={bookmark.settings.copyType ?? 'social'}
              onChange={(event) => handleCopyTypeChange(event.target.value as CopyType)}
              aria-label="文案类型"
              title={copyTypeLabel}
              data-testid="bookmark-copy-type"
              className="max-w-[7rem] shrink-0 rounded border border-sky-500/30 bg-sky-500/10 px-1 py-0.5 text-[10px] font-medium text-sky-400 outline-none light:text-sky-700"
            >
              {COPY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            {bookmark.settings.copyType === 'custom' && (
              <input
                type="text"
                value={customCopyTypeDraft}
                onChange={(event) => setCustomCopyTypeDraft(event.target.value)}
                onBlur={commitCustomCopyType}
                aria-label="自定义文案类型"
                aria-invalid={!isValidCustomCopyType(customCopyTypeDraft)}
                maxLength={20}
                className="max-w-[7rem] rounded border border-sky-500/30 bg-transparent px-1 py-0.5 text-[10px] text-gray-300 outline-none light:text-gray-700"
              />
            )}
            <span
              data-testid="bookmark-variant"
              className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400 light:text-amber-600"
            >
              {variantLabel(bookmark.variantKey)}
            </span>
            <label className="inline-flex max-w-full shrink-0 items-center gap-1 text-[10px] text-gray-500">
              <span className="sr-only">发布平台</span>
              <span aria-hidden="true" className="hidden sm:inline">平台</span>
              <select
                value={publishPlatform}
                onChange={(e) => handlePublishPlatformChange(e.target.value)}
                aria-label="发布平台"
                data-testid="bookmark-publish-platform"
                className="max-w-[7.5rem] rounded border border-emerald-500/40 bg-emerald-500/10 px-1 py-0.5 text-[10px] font-medium text-emerald-400 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/40 light:border-orange-400/50 light:bg-orange-50 light:text-orange-700 light:focus:border-orange-500 light:focus:ring-orange-500/40"
              >
                {PUBLISH_PLATFORM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {bookmark.reviewRequested && !bookmark.adminReview && (
              <span data-testid="bookmark-review-requested" className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 light:text-amber-800">
                待管理员审核
              </span>
            )}
            {bookmark.isUserAuthored && (
              <label className="inline-flex shrink-0 items-center gap-1 text-[10px] text-gray-500">
                <input
                  type="checkbox"
                  checked={bookmark.reviewRequested === true}
                  onChange={(event) => dispatch({
                    type: 'UPDATE_BOOKMARK_REVIEW_REQUEST',
                    payload: { id: bookmark.id, reviewRequested: event.target.checked },
                  })}
                  className="h-3 w-3 accent-amber-500"
                />
                提交管理员审核
              </label>
            )}
          </div>
          <div
            data-testid="bookmark-saved-at"
            className="mt-1 text-[10px] leading-none text-gray-500"
          >
            {formatDate(bookmark.savedAt)}
          </div>
        </div>
        {/* Fixed right actions — never covered by meta text */}
        <div
          data-testid="bookmark-card-actions"
          className="flex shrink-0 items-center gap-0.5 self-start"
        >
          <button
            onClick={handleCopy}
            className={`rounded p-1 transition-colors ${
              copied
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-gray-500 hover:text-emerald-400 light:hover:text-emerald-600'
            }`}
            title={copied ? '已复制！' : '复制文案'}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          {!selectionMode && (
            <button
              type="button"
              onClick={() => {
                setContentDraft(bookmark.content);
                setContentError(null);
                setEditingContent(true);
              }}
              className="rounded p-1 text-gray-500 transition-colors hover:text-emerald-400 light:hover:text-orange-600"
              title="编辑文案"
              aria-label="编辑文案"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={handleLoadParams}
            className="rounded p-1 text-gray-500 transition-colors hover:text-amber-400 light:hover:text-amber-600"
            title="载入参数以微调"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          {!selectionMode && (
            <button
              onClick={handleDeleteClick}
              className="rounded p-1 text-gray-500 transition-colors hover:text-red-400"
              title="删除收藏"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content preview */}
      <div className="px-3 pb-1">
        {editingContent ? (
          <div className="space-y-2">
            <label htmlFor={`favorite-content-${bookmark.id}`} className="sr-only">编辑收藏文案</label>
            <textarea
              id={`favorite-content-${bookmark.id}`}
              aria-label="编辑收藏文案"
              value={contentDraft}
              maxLength={5000}
              disabled={contentSaving}
              onChange={(event) => setContentDraft(event.target.value)}
              className="min-h-32 max-h-[55vh] w-full resize-y rounded-md border border-emerald-500/40 bg-gray-950/70 p-2 text-sm leading-relaxed text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500/30 light:border-orange-300 light:bg-white light:text-gray-800 light:focus:ring-orange-400/30"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={contentSaving} onClick={() => void handleSaveContent()} className="inline-flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1.5 text-[11px] font-semibold text-gray-950 disabled:opacity-50 light:bg-orange-500 light:text-white">
                {contentSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                {contentSaving ? '保存中…' : '保存文案'}
              </button>
              <button type="button" disabled={contentSaving} onClick={requestCloseContentEditor} className="rounded-md border border-gray-600 px-2.5 py-1.5 text-[11px] text-gray-300 disabled:opacity-50 light:border-gray-300 light:text-gray-700">取消</button>
              {contentError && <span role="alert" className="text-[11px] text-red-400">{contentError}</span>}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-300 light:text-gray-800 leading-relaxed line-clamp-3 whitespace-pre-wrap">
            {annotationView.segments.map((part, index) => part.annotation ? (
              <mark key={`${part.annotation.id}-${index}`} title={part.annotation.note} className="rounded bg-red-500/20 px-0.5 text-red-200 light:bg-red-100 light:text-red-800">
                {part.text}
              </mark>
            ) : <span key={`plain-${index}`}>{part.text}</span>)}
          </p>
        )}
      </div>

      {!bookmark.adminReview && bookmark.contentEditedAt && (
        <div className="mx-3 mb-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-[11px] text-red-200 light:border-red-200 light:bg-red-50 light:text-red-800">
          <span className="font-semibold">修改后待审核</span>
          <span className="ml-2 opacity-75">管理员将按最新正文重新审核</span>
        </div>
      )}

      {/* Admin review (visible when collapsed; no reviewer email/group) */}
      {bookmark.adminReview && (
        <div
          data-testid="bookmark-admin-review"
          className={`mx-3 mb-2 rounded-md border px-2.5 py-2 text-[11px] leading-snug ${
            bookmark.adminReview.status === 'adopted'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 light:border-emerald-300 light:bg-emerald-50 light:text-emerald-900'
              : 'border-amber-500/50 bg-amber-500/10 text-amber-100 light:border-amber-400 light:bg-amber-50 light:text-amber-950'
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold">
              {bookmark.adminReview.status === 'adopted' ? '已采纳' : '需修改'}
            </span>
            {bookmark.adminReview.updatedAt && (
              <span className="text-[10px] opacity-70">
                {formatDate(bookmark.adminReview.updatedAt)}
              </span>
            )}
          </div>
          <p className="mt-1 font-medium opacity-90">管理员审核意见</p>
          {bookmark.adminReview.note ? (
            <p className="mt-0.5 whitespace-pre-wrap break-words opacity-95">
              {bookmark.adminReview.note}
            </p>
          ) : null}
          {(bookmark.adminReview.annotations?.length ?? 0) > 0 && (
            <div className="mt-2 border-t border-current/15 pt-2">
              <p className="font-medium">句子批注</p>
              <ul className="mt-1 space-y-1.5">
                {bookmark.adminReview.annotations!.map((item) => {
                  const invalid = annotationView.invalid.some((entry) => entry.id === item.id);
                  return (
                    <li key={item.id} className="rounded bg-red-500/10 px-2 py-1.5 text-red-100 light:bg-red-50 light:text-red-800">
                      <p className="font-medium">“{item.quotedText}” {invalid && <span className="font-normal">（定位失效）</span>}</p>
                      <p className="mt-0.5 whitespace-pre-wrap">{item.note}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

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

const FAVORITES_PAGE_SIZE = 10;

export default function FavoritesPanel({ isOpen, onClose, focusBookmarkId = null }: FavoritesPanelProps) {
  const { state, dispatch } = useContext(AppContext);
  const { planId } = usePlanAccess();
  const { bookmarkedCopies } = state;
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [draftBrand, setDraftBrand] = useState('');
  const [draftCopyType, setDraftCopyType] = useState<CopyType>('social');
  const [draftCustomCopyType, setDraftCustomCopyType] = useState('');
  const [draftPublishPlatform, setDraftPublishPlatform] = useState('ig');
  const [draftContent, setDraftContent] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftReviewRequested, setDraftReviewRequested] = useState<boolean | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [highlightedBookmarkId, setHighlightedBookmarkId] = useState<string | null>(null);

  const resetAddForm = useCallback(() => {
    setDraftBrand('');
    setDraftCopyType('social');
    setDraftCustomCopyType('');
    setDraftPublishPlatform('ig');
    setDraftContent('');
    setDraftNotes('');
    setDraftReviewRequested(null);
    setDraftError(null);
  }, []);

  const saveUserAuthoredFavorite = (event: FormEvent) => {
    event.preventDefault();
    const brand = draftBrand.trim();
    const content = draftContent.trim();
    if (!brand) { setDraftError('请填写品牌名称'); return; }
    if (!content) { setDraftError('请填写文案正文'); return; }
    if (draftReviewRequested === null) { setDraftError('请选择是否提交管理员审核'); return; }
    if (draftCopyType === 'custom' && !isValidCustomCopyType(draftCustomCopyType)) {
      setDraftError('自定义文案类型需填写 2-20 个字');
      return;
    }
    if (planId === 'free' && bookmarkedCopies.length >= 10) {
      setDraftError('Free 最多保存 10 条收藏，请先删除旧收藏或升级 Pro');
      return;
    }

    const now = new Date().toISOString();
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    dispatch({
      type: 'ADD_BOOKMARK',
      payload: {
        id,
        savedAt: now,
        variantKey: draftPublishPlatform === 'all' ? 'standardHK' : draftPublishPlatform as VariantKey,
        content,
        source: '用户自写',
        settings: {
          ...state.settings,
          brandName: brand,
          copyType: draftCopyType,
          customCopyType: draftCopyType === 'custom' ? draftCustomCopyType.trim() : '',
          publishPlatform: draftPublishPlatform,
        },
        notes: draftNotes.trim() || undefined,
        isUserAuthored: true,
        reviewRequested: draftReviewRequested,
        reviewRequestedAt: null,
        adminReview: null,
      },
    });
    resetAddForm();
    setShowAddForm(false);
    setPage(1);
  };

  const accessibleBookmarks = useMemo(
    () => getAccessibleBookmarks(bookmarkedCopies, planId),
    [bookmarkedCopies, planId],
  );
  const lockedCount = Math.max(0, bookmarkedCopies.length - accessibleBookmarks.length);

  const filteredBookmarks = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return accessibleBookmarks;
    return accessibleBookmarks.filter(bookmark => [
      bookmark.settings.brandName,
      bookmark.settings.productName,
      bookmark.source,
      bookmark.content,
    ].some(value => value?.toLocaleLowerCase().includes(normalized)));
  }, [accessibleBookmarks, query]);

  const pageCount = Math.max(1, Math.ceil(filteredBookmarks.length / FAVORITES_PAGE_SIZE));
  const pageBookmarks = useMemo(() => {
    const start = (page - 1) * FAVORITES_PAGE_SIZE;
    return filteredBookmarks.slice(start, start + FAVORITES_PAGE_SIZE);
  }, [filteredBookmarks, page]);

  useEffect(() => {
    if (!isOpen || !focusBookmarkId) return;
    const targetIndex = accessibleBookmarks.findIndex(bookmark => bookmark.id === focusBookmarkId);
    if (targetIndex < 0) return;
    setQuery('');
    setPage(Math.floor(targetIndex / FAVORITES_PAGE_SIZE) + 1);
  }, [accessibleBookmarks, focusBookmarkId, isOpen]);

  useEffect(() => {
    if (!isOpen || !focusBookmarkId || !pageBookmarks.some(item => item.id === focusBookmarkId)) return;
    const frame = window.requestAnimationFrame(() => {
      const target = Array.from(document.querySelectorAll<HTMLElement>('[data-bookmark-id]'))
        .find(element => element.dataset.bookmarkId === focusBookmarkId);
      if (!target) return;
      setHighlightedBookmarkId(focusBookmarkId);
      target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusBookmarkId, isOpen, pageBookmarks]);

  useEffect(() => {
    if (!highlightedBookmarkId) return;
    const timeout = window.setTimeout(() => setHighlightedBookmarkId(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [highlightedBookmarkId]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    setSelectedIds(previous => {
      const existing = new Set(accessibleBookmarks.map(bookmark => bookmark.id));
      const next = new Set([...previous].filter(id => existing.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [accessibleBookmarks]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setPage(1);
      setSelectionMode(false);
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
      setShowAddForm(false);
      resetAddForm();
    }
  }, [isOpen, resetAddForm]);

  // Group the current page by date (today, yesterday, this week, older).
  const grouped = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const buckets: Record<'今天' | '昨天' | '本周' | '更早', BookmarkedCopy[]> = {
      今天: [], 昨天: [], 本周: [], 更早: [],
    };

    for (const bookmark of pageBookmarks) {
      const date = new Date(bookmark.savedAt);
      const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (day.getTime() >= today.getTime()) buckets.今天.push(bookmark);
      else if (day.getTime() >= yesterday.getTime()) buckets.昨天.push(bookmark);
      else if (day.getTime() >= weekAgo.getTime()) buckets.本周.push(bookmark);
      else buckets.更早.push(bookmark);
    }

    return (Object.entries(buckets) as Array<[string, BookmarkedCopy[]]>)
      .filter(([, items]) => items.length > 0)
      .map(([label, items]) => ({ label, items }));
  }, [pageBookmarks]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const currentPageIds = pageBookmarks.map(bookmark => bookmark.id);
  const allCurrentSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.has(id));

  function toggleCurrentPage() {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (allCurrentSelected) currentPageIds.forEach(id => next.delete(id));
      else currentPageIds.forEach(id => next.add(id));
      return next;
    });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }

  function confirmBulkDelete() {
    dispatch({ type: 'REMOVE_BOOKMARKS', payload: [...selectedIds] });
    setShowBulkDeleteConfirm(false);
    exitSelectionMode();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative flex h-full w-full max-w-md flex-col border-l border-gray-800 bg-gray-950 shadow-2xl light:border-gray-300 light:bg-white">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-800 px-4 py-3 light:border-gray-300">
          <div className="flex min-w-0 items-center gap-2">
            <Star className="h-4 w-4 shrink-0 text-amber-400" fill="currentColor" />
            <h2 className="text-sm font-semibold text-gray-200 light:text-gray-800">文案收藏库</h2>
            {bookmarkedCopies.length > 0 && (
              <span className="rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400 light:bg-gray-200 light:text-gray-600">
                {bookmarkedCopies.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setShowAddForm((value) => !value); setDraftError(null); }}
              aria-label="添加自写文案"
              title="添加自写文案"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-emerald-400 hover:bg-emerald-500/10 light:text-orange-600 light:hover:bg-orange-50"
            >
              <Plus className="h-4 w-4" />
            </button>
            {bookmarkedCopies.length > 0 && (
              <button
                type="button"
                onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                className="rounded px-2 py-1 text-[11px] text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200 light:text-gray-600 light:hover:bg-gray-100 light:hover:text-gray-900"
              >
                {selectionMode ? '完成' : '批量管理'}
              </button>
            )}
            <button
              type="button"
              aria-label="关闭收藏库"
              onClick={onClose}
              className="rounded p-1 text-gray-500 transition-colors hover:text-gray-300 light:hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {showAddForm && (
          <form onSubmit={saveUserAuthoredFavorite} className="shrink-0 space-y-3 border-b border-gray-800 px-4 py-3 light:border-gray-300">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-[11px] text-gray-400 light:text-gray-600">
                <span>品牌名称</span>
                <input
                  value={draftBrand}
                  onChange={(event) => setDraftBrand(event.target.value)}
                  aria-label="品牌名称"
                  maxLength={200}
                  className="w-full rounded-md border border-gray-700 bg-gray-900 px-2.5 py-2 text-xs text-gray-100 outline-none focus:border-emerald-500 light:border-gray-300 light:bg-white light:text-gray-900"
                />
              </label>
              <label className="space-y-1 text-[11px] text-gray-400 light:text-gray-600">
                <span>文案类型</span>
                <select
                  value={draftCopyType}
                  onChange={(event) => setDraftCopyType(event.target.value as CopyType)}
                  aria-label="文案类型"
                  className="w-full rounded-md border border-gray-700 bg-gray-900 px-2.5 py-2 text-xs text-gray-100 outline-none focus:border-emerald-500 light:border-gray-300 light:bg-white light:text-gray-900"
                >
                  {COPY_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
            </div>
            {draftCopyType === 'custom' && (
              <label className="block space-y-1 text-[11px] text-gray-400 light:text-gray-600">
                <span>自定义文案类型</span>
                <input
                  value={draftCustomCopyType}
                  onChange={(event) => setDraftCustomCopyType(event.target.value)}
                  aria-label="自定义文案类型"
                  maxLength={20}
                  className="w-full rounded-md border border-gray-700 bg-gray-900 px-2.5 py-2 text-xs text-gray-100 outline-none light:border-gray-300 light:bg-white light:text-gray-900"
                />
              </label>
            )}
            <label className="block space-y-1 text-[11px] text-gray-400 light:text-gray-600">
              <span>发布平台</span>
              <select
                value={draftPublishPlatform}
                onChange={(event) => setDraftPublishPlatform(event.target.value)}
                aria-label="发布平台"
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-2.5 py-2 text-xs text-gray-100 outline-none focus:border-emerald-500 light:border-gray-300 light:bg-white light:text-gray-900"
              >
                {PUBLISH_PLATFORM_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-[11px] text-gray-400 light:text-gray-600">
              <span>文案正文</span>
              <textarea
                value={draftContent}
                onChange={(event) => setDraftContent(event.target.value)}
                aria-label="文案正文"
                maxLength={5000}
                className="min-h-28 w-full resize-y rounded-md border border-gray-700 bg-gray-900 px-2.5 py-2 text-xs leading-relaxed text-gray-100 outline-none focus:border-emerald-500 light:border-gray-300 light:bg-white light:text-gray-900"
              />
            </label>
            <label className="block space-y-1 text-[11px] text-gray-400 light:text-gray-600">
              <span>备注（可选）</span>
              <input
                value={draftNotes}
                onChange={(event) => setDraftNotes(event.target.value)}
                aria-label="备注（可选）"
                maxLength={2000}
                className="w-full rounded-md border border-gray-700 bg-gray-900 px-2.5 py-2 text-xs text-gray-100 outline-none light:border-gray-300 light:bg-white light:text-gray-900"
              />
            </label>
            <fieldset className="space-y-1.5">
              <legend className="text-[11px] text-gray-400 light:text-gray-600">管理员审核</legend>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs ${draftReviewRequested === true ? 'border-amber-500 bg-amber-500/10 text-amber-300 light:text-amber-800' : 'border-gray-700 text-gray-400 light:border-gray-300 light:text-gray-600'}`}>
                  <input
                    type="radio"
                    name="review-requested"
                    checked={draftReviewRequested === true}
                    onChange={() => setDraftReviewRequested(true)}
                    aria-label="提交管理员审核"
                    className="h-4 w-4 accent-amber-500"
                  />
                  提交审核
                </label>
                <label className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs ${draftReviewRequested === false ? 'border-gray-500 bg-gray-800/60 text-gray-200 light:bg-gray-100 light:text-gray-800' : 'border-gray-700 text-gray-400 light:border-gray-300 light:text-gray-600'}`}>
                  <input
                    type="radio"
                    name="review-requested"
                    checked={draftReviewRequested === false}
                    onChange={() => setDraftReviewRequested(false)}
                    aria-label="暂不提交管理员审核"
                    className="h-4 w-4 accent-gray-500"
                  />
                  暂不提交
                </label>
              </div>
            </fieldset>
            {draftError && <p role="alert" className="text-[11px] text-red-400">{draftError}</p>}
            <div className="flex items-center gap-2">
              <button type="submit" className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-semibold text-gray-950 light:bg-orange-500 light:text-white">
                保存到收藏库
              </button>
              <button type="button" onClick={() => { resetAddForm(); setShowAddForm(false); }} className="rounded-md border border-gray-600 px-3 py-2 text-xs text-gray-300 light:border-gray-300 light:text-gray-700">
                取消
              </button>
            </div>
          </form>
        )}

        {bookmarkedCopies.length > 0 && (
          <div className="shrink-0 space-y-2 border-b border-gray-800 px-4 py-3 light:border-gray-300">
            <label className="flex items-center gap-2 rounded-md border border-gray-700 bg-gray-900 px-2.5 py-2 light:border-gray-300 light:bg-white">
              <Search className="h-3.5 w-3.5 text-gray-500" />
              <input
                type="search"
                aria-label="搜索收藏"
                value={query}
                onChange={event => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="搜索品牌、产品或文案"
                className="min-w-0 flex-1 bg-transparent text-xs text-gray-200 outline-none placeholder:text-gray-600 light:text-gray-800 light:placeholder:text-gray-400"
              />
            </label>

            {selectionMode && (
              <div className="flex items-center gap-2 text-[11px]">
                <label className="flex items-center gap-1.5 text-gray-400 light:text-gray-600">
                  <input
                    type="checkbox"
                    aria-label="全选当前收藏"
                    checked={allCurrentSelected}
                    onChange={toggleCurrentPage}
                    className="h-3.5 w-3.5 accent-emerald-500 light:accent-orange-500"
                  />
                  全选当前页
                </label>
                <span className="text-gray-500">已选 {selectedIds.size} / {filteredBookmarks.length}</span>
                <button
                  type="button"
                  disabled={selectedIds.size === 0}
                  onClick={() => setShowBulkDeleteConfirm(true)}
                  className="ml-auto rounded-md bg-red-600 px-2.5 py-1 font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  删除所选
                </button>
              </div>
            )}
          </div>
        )}

        {lockedCount > 0 && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-300 light:border-orange-200 light:bg-orange-50 light:text-orange-700">
            <p>Free 可使用 10 条收藏，另有 {lockedCount} 条需 Pro 解锁</p>
            <a href="/app/billing" className="mt-1 inline-block font-semibold underline underline-offset-2">
              解锁全部收藏
            </a>
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {bookmarkedCopies.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="text-4xl opacity-30">⭐</div>
              <p className="text-sm text-gray-500">暂无收藏的文案</p>
              <p className="max-w-xs text-xs text-gray-600 light:text-gray-500">
                生成文案后，点击文案卡片右上角的 ☆ 即可收藏。收藏后可以查看生成参数、复制文案、评分，方便微调和复用。
              </p>
            </div>
          ) : filteredBookmarks.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-500">没有匹配的收藏</p>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mt-3 text-xs font-medium text-emerald-400 light:text-orange-600"
              >
                清空搜索
              </button>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.label}>
                <p className="mb-2 text-[10px] font-medium text-gray-500">{group.label}</p>
                <div className="space-y-2">
                  {group.items.map(bookmark => (
                    <BookmarkCard
                      key={bookmark.id}
                      bookmark={bookmark}
                      selectionMode={selectionMode}
                      selected={selectedIds.has(bookmark.id)}
                      focused={highlightedBookmarkId === bookmark.id}
                      onToggleSelected={toggleSelection}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {filteredBookmarks.length > FAVORITES_PAGE_SIZE && (
          <div className="flex shrink-0 items-center justify-between border-t border-gray-800 px-4 py-2 light:border-gray-300">
            <button
              type="button"
              aria-label="上一页"
              disabled={page === 1}
              onClick={() => setPage(current => Math.max(1, current - 1))}
              className="rounded px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-800 disabled:opacity-30 light:text-gray-600 light:hover:bg-gray-100"
            >
              上一页
            </button>
            <span className="text-[11px] text-gray-500">第 {page} / {pageCount} 页</span>
            <button
              type="button"
              aria-label="下一页"
              disabled={page === pageCount}
              onClick={() => setPage(current => Math.min(pageCount, current + 1))}
              className="rounded px-2 py-1 text-[11px] text-gray-400 hover:bg-gray-800 disabled:opacity-30 light:text-gray-600 light:hover:bg-gray-100"
            >
              下一页
            </button>
          </div>
        )}

        {bookmarkedCopies.length > 0 && (
          <div className="shrink-0 border-t border-gray-800 px-4 py-2 light:border-gray-300">
            <p className="text-[10px] text-gray-500">
              点击 <Copy className="inline h-3 w-3 text-emerald-400" /> 复制文案 ·
              点击 <Star className="inline h-3 w-3 text-amber-400" fill="currentColor" /> 评分为 AI 提供偏好反馈 ·
              点击 <ExternalLink className="inline h-3 w-3" /> 载入参数
            </p>
          </div>
        )}

        <ConfirmDialog
          open={showBulkDeleteConfirm}
          title="确认批量删除收藏？"
          message={`即将删除 ${selectedIds.size} 条收藏，此操作不可撤销。`}
          confirmLabel={`确认删除 ${selectedIds.size} 条`}
          danger
          onConfirm={confirmBulkDelete}
          onCancel={() => setShowBulkDeleteConfirm(false)}
        />
      </div>
    </div>
  );
}
