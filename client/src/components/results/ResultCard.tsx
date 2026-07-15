import { useState, useRef, useEffect, useContext, type ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import CopyButton from './CopyButton';
import BookmarkButton from './BookmarkButton';
import { AppContext } from '../../context/AppContext';
import type { VariantMeta, VariantKey } from '../../types';

interface ResultCardProps {
  title: string;
  variantKey: VariantKey;         // 🆕 收藏功能需要知道是哪个 variant
  content: string;
  originalText?: string | null;
  externalTranslatedText?: string | null;
  externalTranslating?: boolean;
  variantMeta?: VariantMeta | null; // 🆕 Ph1
  onEdit?: (newText: string) => void;
}

/** Simple prefix-suffix diff: highlight the changed portion in red */
function renderDiff(original: string, modified: string): ReactNode {
  if (original === modified) return modified;

  // Find common prefix
  let prefixLen = 0;
  const minLen = Math.min(original.length, modified.length);
  while (prefixLen < minLen && original[prefixLen] === modified[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix
  let suffixLen = 0;
  const origRemaining = original.length - prefixLen;
  const modRemaining = modified.length - prefixLen;
  const maxSuffix = Math.min(origRemaining, modRemaining);
  while (
    suffixLen < maxSuffix &&
    original[original.length - 1 - suffixLen] === modified[modified.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const prefix = modified.slice(0, prefixLen);
  const changed = modified.slice(prefixLen, modified.length - suffixLen);
  const suffix = modified.slice(modified.length - suffixLen);

  return (
    <>
      {prefix}
      {changed.length > 0 && (
        <span className="text-red-300 light:text-red-700 bg-red-500/15 light:bg-red-100 rounded px-0.5">
          {changed}
        </span>
      )}
      {suffix}
    </>
  );
}

export default function ResultCard({ title, variantKey, content, originalText, externalTranslatedText, externalTranslating, variantMeta, onEdit }: ResultCardProps) {
  const { state, dispatch } = useContext(AppContext);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(content);
  const [copiedHeadline, setCopiedHeadline] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if this variant is already bookmarked
  const existingBookmark = state.bookmarkedCopies.find(
    b => b.variantKey === variantKey && b.content === content,
  );

  const buildBookmark = () => ({
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    savedAt: new Date().toISOString(),
    variantKey,
    content,
    source: state.source,
    // Keep historical generation platform; default publish platform = this variant
    settings: {
      ...state.settings,
      publishPlatform: variantKey,
    },
    variantMeta: variantMeta ?? null,
    scores: state.scores ?? null,
    consumerFeedback: state.consumerFeedback ?? null,
  });

  // Sync editText when content changes externally (e.g. tab switch)
  useEffect(() => {
    setEditText(content);
  }, [content]);

  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Translation is handled globally by ResultsPanel's "🔤 譯普" toggle
  const displayTranslated = externalTranslatedText ?? null;
  const isTranslating = externalTranslating ?? false;

  const handleStartEdit = () => {
    setEditText(content);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== content && onEdit) {
      onEdit(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(content);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-gray-600 light:text-gray-500 font-medium">{title}</span>
        <div className="flex items-center gap-1">
          <BookmarkButton
            bookmarkId={existingBookmark?.id}
            buildBookmark={buildBookmark}
          />
          {onEdit && !isEditing && (
            <button
              onClick={handleStartEdit}
              className="text-[10px] px-2 py-0.5 rounded border border-gray-600/40 light:border-gray-300
                text-gray-500 light:text-gray-500 hover:text-gray-300 light:hover:text-gray-700 hover:border-gray-500 transition-colors"
              title="手动编辑文案"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {isEditing && (
            <>
              <button
                onClick={handleSaveEdit}
                disabled={!editText.trim() || editText.trim() === content}
                className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40
                  text-emerald-400 hover:bg-emerald-500/30 transition-colors
                  disabled:opacity-30 disabled:cursor-not-allowed"
              >
                储存
              </button>
              <button
                onClick={handleCancelEdit}
                className="text-[10px] px-2 py-0.5 rounded border border-gray-600/40 light:border-gray-300
                  text-gray-500 light:text-gray-500 hover:text-gray-300 light:hover:text-gray-700 transition-colors"
              >
                取消
              </button>
            </>
          )}
          <CopyButton text={content} />
        </div>
      </div>
      <div className="flex-1 bg-gray-800/20 light:bg-gray-100 border border-gray-700/30 light:border-gray-300/50 rounded-lg p-3 overflow-y-auto space-y-3">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveEdit}
            rows={8}
            className="w-full bg-gray-900/60 light:bg-white border border-gray-600/50 light:border-gray-400
              rounded-lg px-3 py-2 text-sm text-gray-200 light:text-gray-800 leading-relaxed
              resize-y focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20
              placeholder-gray-500"
          />
        ) : (
          <>
            <p className="text-sm text-gray-300 light:text-gray-800 leading-relaxed whitespace-pre-wrap">
              {originalText && originalText !== content
                ? renderDiff(originalText, content)
                : content}
            </p>
            {originalText && originalText !== content && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-red-400 light:text-red-600">红色标记为修改内容</span>
              </div>
            )}

            {/* 🆕 Ph1: Alt headlines + value prop statement */}
            {variantMeta && (
              <div className="border-t border-gray-700/30 light:border-gray-300/50 pt-2.5 space-y-2">
                {/* Alt headlines */}
                {variantMeta.altHeadlines && variantMeta.altHeadlines.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 light:text-gray-500 mb-1.5">
                      📋 备选标题
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {variantMeta.altHeadlines.map((h, i) => {
                        const justCopied = copiedHeadline === i;
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              navigator.clipboard.writeText(h);
                              setCopiedHeadline(i);
                              setTimeout(() => setCopiedHeadline(null), 1500);
                            }}
                            className={`text-[11px] px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                              justCopied
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 light:text-emerald-600'
                                : 'bg-gray-800/40 light:bg-gray-200 border border-gray-700/30 light:border-gray-300 text-gray-300 light:text-gray-700 hover:bg-emerald-500/15 hover:border-emerald-500/30 hover:text-emerald-300 light:hover:text-emerald-600'
                            }`}
                            title={justCopied ? '已复制' : '点击复制到剪贴板'}
                          >
                            {justCopied ? '✓ ' : ''}{h}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Value prop statement */}
                {variantMeta.valuePropStatement && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-[10px] text-gray-500 shrink-0 mt-0.5">💡</span>
                    <p className="text-[11px] text-gray-400 light:text-gray-600 italic leading-relaxed">
                      {variantMeta.valuePropStatement}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {displayTranslated && (
          <div className="border-t border-gray-700/40 pt-2.5">
            <p className="text-[10px] text-gray-500 light:text-gray-500 mb-1">📝 普通话翻译</p>
            <p className="text-sm text-gray-400 light:text-gray-600 leading-relaxed whitespace-pre-wrap">{displayTranslated}</p>
          </div>
        )}
      </div>
    </div>
  );
}
