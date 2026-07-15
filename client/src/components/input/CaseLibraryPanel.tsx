import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Library, Pencil, Plus, Trash2 } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import ConfirmDialog from '../shared/ConfirmDialog';
import {
  createCaseLibraryEntry,
  deleteCaseLibraryEntry,
  listCaseLibrary,
  updateCaseLibraryEntry,
} from '../../services/caseLibraryApi';
import type { CaseLibraryEntry, CaseLibraryType } from '../../types';
import {
  CASE_LIBRARY_LIMITS,
  deriveCaseBodyPreview,
  deriveCaseDisplayName,
  deriveReasonPreview,
  reconcileSelectedCaseIds,
  validateCaseLibraryForm,
} from '../../utils/caseLibrary';

type FormMode = 'closed' | 'create' | 'edit';

const emptyForm = {
  caseType: 'good' as CaseLibraryType,
  title: '',
  body: '',
  reason: '',
  tagsRaw: '',
};

/**
 * W2 personal case library — create/edit/soft-delete/select (max 3).
 * Selection stores IDs only; bodies are never sent into generation (W3).
 */
export default function CaseLibraryPanel() {
  const { state, dispatch } = useContext(AppContext);
  const [entries, setEntries] = useState<CaseLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | CaseLibraryType>('all');
  const [formMode, setFormMode] = useState<FormMode>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CaseLibraryEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedIds = state.settings.selectedCaseLibraryIds ?? [];

  const refresh = useCallback(async (opts?: { query?: string; caseType?: CaseLibraryType }) => {
    setLoading(true);
    setLoadError(null);
    try {
      const items = await listCaseLibrary({
        query: opts?.query,
        caseType: opts?.caseType,
      });
      setEntries(items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '加载案例库失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Full-list reconcile after successful unfiltered fetch (deleted IDs → non-blocking tip)
  useEffect(() => {
    if (loading || loadError || search.trim() || typeFilter !== 'all') return;
    const available = new Set(entries.map((e) => e.id));
    const { next, dropped } = reconcileSelectedCaseIds(selectedIds, available);
    if (dropped > 0) {
      setNotice(`已忽略 ${dropped} 个已删除案例，未静默替换`);
    }
    if (next.join(',') !== selectedIds.join(',')) {
      dispatch({ type: 'SET_SELECTED_CASE_LIBRARY_IDS', payload: next });
    }
  }, [loading, loadError, entries, search, typeFilter, selectedIds, dispatch]);

  const filtered = useMemo(() => {
    // Server already filtered when search/type used; still apply light client filter for snappy UX on full list
    let list = entries;
    if (typeFilter !== 'all') {
      list = list.filter((e) => e.caseType === typeFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const hay = [
          e.title ?? '',
          e.body,
          e.reason,
          ...e.tags,
          e.caseType,
          deriveCaseDisplayName(e.caseType, e.title),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [entries, search, typeFilter]);

  const openCreate = () => {
    setFormMode('create');
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
  };

  const openEdit = (entry: CaseLibraryEntry) => {
    setFormMode('edit');
    setEditingId(entry.id);
    setForm({
      caseType: entry.caseType,
      title: entry.title ?? '',
      body: entry.body,
      reason: entry.reason,
      tagsRaw: entry.tags.join(', '),
    });
    setFieldErrors({});
  };

  const closeForm = () => {
    setFormMode('closed');
    setEditingId(null);
    setForm(emptyForm);
    setFieldErrors({});
  };

  const handleSave = async () => {
    const result = validateCaseLibraryForm(form);
    if (!result.ok) {
      setFieldErrors(result.errors as Record<string, string>);
      return;
    }
    setSaving(true);
    setFieldErrors({});
    try {
      if (formMode === 'edit' && editingId) {
        await updateCaseLibraryEntry(editingId, result.value);
      } else {
        await createCaseLibraryEntry(result.value);
      }
      closeForm();
      await refresh();
    } catch (err) {
      setFieldErrors({
        body: err instanceof Error ? err.message : '保存失败',
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCaseLibraryEntry(deleteTarget.id);
      // Drop from selection if selected
      if (selectedIds.includes(deleteTarget.id)) {
        dispatch({
          type: 'SET_SELECTED_CASE_LIBRARY_IDS',
          payload: selectedIds.filter((id) => id !== deleteTarget.id),
        });
      }
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : '删除失败');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      dispatch({
        type: 'SET_SELECTED_CASE_LIBRARY_IDS',
        payload: selectedIds.filter((x) => x !== id),
      });
      return;
    }
    if (selectedIds.length >= CASE_LIBRARY_LIMITS.maxSelected) {
      setNotice(`最多选择 ${CASE_LIBRARY_LIMITS.maxSelected} 条案例`);
      return;
    }
    dispatch({
      type: 'SET_SELECTED_CASE_LIBRARY_IDS',
      payload: [...selectedIds, id],
    });
  };

  const selectedEntries = selectedIds
    .map((id) => entries.find((e) => e.id === id))
    .filter((e): e is CaseLibraryEntry => !!e);

  return (
    <div
      data-testid="case-library-panel"
      className="space-y-2 rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-2.5 light:border-violet-400/30 light:bg-violet-50/50"
    >
      <div className="flex items-center gap-1.5">
        <Library className="h-3.5 w-3.5 shrink-0 text-violet-400 light:text-violet-500" />
        <span className="text-xs font-medium text-violet-300 light:text-violet-700">
          个人案例库
        </span>
        <span className="text-[10px] text-violet-500/70 light:text-violet-500">
          （已选 {selectedIds.length}/{CASE_LIBRARY_LIMITS.maxSelected}）
        </span>
        <button
          type="button"
          data-testid="case-library-add"
          onClick={openCreate}
          className="ml-auto inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] text-violet-300 hover:bg-violet-500/15 light:text-violet-700 light:hover:bg-violet-100"
        >
          <Plus className="h-3 w-3" />
          新增
        </button>
      </div>

      <p className="text-[10px] leading-relaxed text-gray-500">
        管理你的正例/反例，生成前最多勾选 3 条。本轮只保存选择 ID，不会把正文注入生成 Prompt。
      </p>

      {notice && (
        <div
          data-testid="case-library-notice"
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-300 light:text-amber-700"
        >
          {notice}
          <button
            type="button"
            className="ml-2 underline opacity-80"
            onClick={() => setNotice(null)}
          >
            关闭
          </button>
        </div>
      )}

      {selectedEntries.length > 0 && (
        <div data-testid="case-library-selected" className="space-y-1">
          {selectedEntries.map((e) => (
            <div
              key={e.id}
              className="rounded-md border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200 light:text-violet-800"
            >
              <span className="font-medium">
                {e.caseType === 'good' ? '正例' : '反例'} ·{' '}
                {deriveCaseDisplayName(e.caseType, e.title)}
              </span>
              <span className="ml-1 text-gray-400 light:text-gray-600">
                {deriveReasonPreview(e.reason)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1.5">
        <input
          type="search"
          data-testid="case-library-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索标题/正文/标签/类型"
          className="min-w-0 flex-1 rounded-md border border-gray-700/50 bg-gray-800/50 px-2 py-1 text-[11px] text-gray-200 placeholder-gray-600 focus:border-violet-500/50 focus:outline-none light:border-gray-300 light:bg-gray-100 light:text-gray-800 light:placeholder-gray-400"
        />
        <select
          data-testid="case-library-type-filter"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as 'all' | CaseLibraryType)}
          className="rounded-md border border-gray-700/50 bg-gray-800/50 px-1.5 py-1 text-[11px] text-gray-300 light:border-gray-300 light:bg-gray-100 light:text-gray-700"
        >
          <option value="all">全部</option>
          <option value="good">正例</option>
          <option value="bad">反例</option>
        </select>
      </div>

      {formMode !== 'closed' && (
        <div
          data-testid="case-library-form"
          className="space-y-1.5 rounded-md border border-gray-700/40 bg-gray-900/40 p-2 light:border-gray-300 light:bg-white"
        >
          <div className="flex gap-2 text-[11px]">
            <label className="flex items-center gap-1 text-gray-300 light:text-gray-700">
              <input
                type="radio"
                name="caseType"
                checked={form.caseType === 'good'}
                onChange={() => setForm((f) => ({ ...f, caseType: 'good' }))}
              />
              正例
            </label>
            <label className="flex items-center gap-1 text-gray-300 light:text-gray-700">
              <input
                type="radio"
                name="caseType"
                checked={form.caseType === 'bad'}
                onChange={() => setForm((f) => ({ ...f, caseType: 'bad' }))}
              />
              反例
            </label>
          </div>
          <input
            data-testid="case-library-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            maxLength={CASE_LIBRARY_LIMITS.titleMax}
            placeholder="标题（选填）"
            className="w-full rounded-md border border-gray-700/50 bg-gray-800/50 px-2 py-1 text-[11px] text-gray-200 light:border-gray-300 light:bg-gray-100 light:text-gray-800"
          />
          {fieldErrors.title && (
            <p className="text-[10px] text-red-400">{fieldErrors.title}</p>
          )}
          <textarea
            data-testid="case-library-body"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={3}
            placeholder={`正文（必填，${CASE_LIBRARY_LIMITS.bodyMin}–${CASE_LIBRARY_LIMITS.bodyMax} 字）`}
            className="w-full resize-y rounded-md border border-gray-700/50 bg-gray-800/50 px-2 py-1 text-[11px] text-gray-200 light:border-gray-300 light:bg-gray-100 light:text-gray-800"
          />
          {fieldErrors.body && (
            <p className="text-[10px] text-red-400" data-testid="case-library-body-error">
              {fieldErrors.body}
            </p>
          )}
          <textarea
            data-testid="case-library-reason"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            rows={2}
            placeholder={`原因（必填，${CASE_LIBRARY_LIMITS.reasonMin}–${CASE_LIBRARY_LIMITS.reasonMax} 字）`}
            className="w-full resize-y rounded-md border border-gray-700/50 bg-gray-800/50 px-2 py-1 text-[11px] text-gray-200 light:border-gray-300 light:bg-gray-100 light:text-gray-800"
          />
          {fieldErrors.reason && (
            <p className="text-[10px] text-red-400">{fieldErrors.reason}</p>
          )}
          <input
            data-testid="case-library-tags"
            value={form.tagsRaw}
            onChange={(e) => setForm((f) => ({ ...f, tagsRaw: e.target.value }))}
            placeholder="标签（可选，逗号分隔，最多 8 个）"
            className="w-full rounded-md border border-gray-700/50 bg-gray-800/50 px-2 py-1 text-[11px] text-gray-200 light:border-gray-300 light:bg-gray-100 light:text-gray-800"
          />
          {fieldErrors.tags && (
            <p className="text-[10px] text-red-400">{fieldErrors.tags}</p>
          )}
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={closeForm}
              className="rounded-md px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200"
            >
              取消
            </button>
            <button
              type="button"
              data-testid="case-library-save"
              disabled={saving}
              onClick={() => void handleSave()}
              className="rounded-md bg-violet-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[10px] text-gray-500">加载中…</p>
      ) : loadError ? (
        <p className="text-[10px] text-red-400" data-testid="case-library-load-error">
          {loadError}
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-700/40 px-2 py-3 text-center text-[10px] text-gray-500 light:border-gray-300">
          暂无案例，点击「新增」创建正例或反例
        </p>
      ) : (
        <div
          data-testid="case-library-list"
          className="max-h-[220px] space-y-1 overflow-y-auto"
        >
          {filtered.map((entry) => {
            const isSelected = selectedIds.includes(entry.id);
            const atCap = !isSelected && selectedIds.length >= CASE_LIBRARY_LIMITS.maxSelected;
            return (
              <div
                key={entry.id}
                className={`rounded-lg border px-2 py-1.5 ${
                  isSelected
                    ? 'border-violet-500/40 bg-violet-500/15'
                    : 'border-gray-700/30 bg-gray-800/30 light:border-gray-300/40 light:bg-gray-100'
                }`}
              >
                <div className="flex items-start gap-1.5">
                  <button
                    type="button"
                    data-testid={`case-library-select-${entry.id}`}
                    disabled={atCap}
                    onClick={() => toggleSelect(entry.id)}
                    className="mt-0.5 shrink-0 text-[10px] text-violet-300 disabled:cursor-not-allowed disabled:opacity-40 light:text-violet-700"
                  >
                    {isSelected ? '✓' : '○'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSelect(entry.id)}
                    disabled={atCap}
                    className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <div className="flex items-center gap-1 text-[11px] text-gray-200 light:text-gray-800">
                      <span className="shrink-0 rounded bg-violet-500/20 px-1 text-[9px] text-violet-300 light:text-violet-700">
                        {entry.caseType === 'good' ? '正例' : '反例'}
                      </span>
                      <span className="truncate font-medium">
                        {deriveCaseDisplayName(entry.caseType, entry.title)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-gray-500">
                      {deriveCaseBodyPreview(entry.body)} · {deriveReasonPreview(entry.reason, 28)}
                    </p>
                  </button>
                  <button
                    type="button"
                    data-testid={`case-library-edit-${entry.id}`}
                    onClick={() => openEdit(entry)}
                    className="shrink-0 p-0.5 text-gray-500 hover:text-gray-300"
                    title="编辑"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    data-testid={`case-library-delete-${entry.id}`}
                    onClick={() => setDeleteTarget(entry)}
                    className="shrink-0 p-0.5 text-gray-500 hover:text-red-400"
                    title="删除"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除案例？"
        message="删除后无法恢复。若已保存配置引用该案例，载入时会忽略并提示。"
        preview={
          deleteTarget
            ? `${deriveCaseDisplayName(deleteTarget.caseType, deleteTarget.title)} — ${deriveCaseBodyPreview(deleteTarget.body, 40)}`
            : undefined
        }
        danger
        confirming={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
