import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import {
  listBadCaseReviewPacks,
  userFacingReviewPackError,
  type BadCaseReviewPackListItem,
  type OwnerTeam,
} from '../../services/badCaseReviewPackApi';
import BadCaseReviewPackDialog from './BadCaseReviewPackDialog';

type AdminRole = 'admin' | 'super_admin';

const OWNER_TEAMS: Array<OwnerTeam | ''> = [
  '',
  'content_prompt',
  'knowledge_rules',
  'model_provider',
  'backend_platform',
  'frontend_experience',
  'unassigned',
];

const STATUS_FILTERS = ['', 'open', 'triaging', 'in_progress', 'resolved', 'wont_fix', 'duplicate'];

export default function BadCaseReviewPackPanel({ role }: { role: AdminRole }) {
  const requestVersion = useRef(0);
  const [items, setItems] = useState<BadCaseReviewPackListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [ownerTeam, setOwnerTeam] = useState('');
  const [triggerKind, setTriggerKind] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (role !== 'super_admin') return;
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listBadCaseReviewPacks({
        status: status || undefined,
        ownerTeam: ownerTeam || undefined,
        triggerKind: triggerKind || undefined,
        limit: 20,
        offset: 0,
      });
      if (version !== requestVersion.current) return;
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      if (version !== requestVersion.current) return;
      setItems([]);
      setTotal(0);
      setError(userFacingReviewPackError(err));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [ownerTeam, role, status, triggerKind]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current += 1;
    };
  }, [load]);

  if (role !== 'super_admin') return null;

  return (
    <section
      data-testid="bad-case-review-pack-panel"
      className="mb-6 space-y-4 rounded-xl border border-gray-800 bg-gray-900/20 p-4 light:border-gray-200 light:bg-white"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ClipboardList className="h-4 w-4 text-emerald-400 light:text-orange-600" />
            <h2 className="text-sm font-semibold">Bad Case 审阅包</h2>
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400 light:text-amber-700">
              仅超级管理员
            </span>
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            列表仅元数据；正文与工件只在详情（服务端审计后）可见。入口隐藏不是权限边界。
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void load(); }}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-gray-700 px-2.5 py-1.5 text-xs text-gray-400 transition-colors hover:text-gray-200 disabled:opacity-50 light:border-gray-300 light:text-gray-600 light:hover:text-gray-900"
          aria-label="刷新审阅包"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-[10px] text-gray-500">
          状态
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="min-h-9 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 light:border-gray-300 light:bg-white light:text-gray-800"
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value || 'all'} value={value}>
                {value || '全部'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-[10px] text-gray-500">
          责任团队
          <select
            value={ownerTeam}
            onChange={(e) => setOwnerTeam(e.target.value)}
            className="min-h-9 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 light:border-gray-300 light:bg-white light:text-gray-800"
          >
            {OWNER_TEAMS.map((value) => (
              <option key={value || 'all'} value={value}>
                {value || '全部'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-[10px] text-gray-500">
          触发类型
          <input
            value={triggerKind}
            onChange={(e) => setTriggerKind(e.target.value)}
            placeholder="如 score_below_threshold"
            className="min-h-9 rounded-md border border-gray-700 bg-gray-900 px-2 text-xs text-gray-200 light:border-gray-300 light:bg-white light:text-gray-800"
          />
        </label>
      </div>

      {loading && items.length === 0 && (
        <div className="flex items-center gap-2 py-5 text-xs text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> 加载审阅包列表…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="py-6 text-center text-xs text-gray-500">
          暂无审阅包
          {(status || ownerTeam || triggerKind) ? '（当前筛选条件下）' : ''}
        </p>
      )}

      {items.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              aria-label={`打开审阅包 ${item.id}`}
              className="rounded-md bg-gray-900/50 p-3 text-left transition-colors hover:bg-gray-800/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 light:bg-gray-50 light:hover:bg-gray-100 light:focus:ring-orange-500/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-gray-500" title={item.id}>
                  {item.id.slice(0, 8)}
                </span>
                {item.score != null && (
                  <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-semibold text-red-400 light:text-red-700">
                    {item.score} 分
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs font-medium">{item.summary || item.triggerKind}</p>
              <p className="mt-1 text-[10px] text-gray-500">
                {item.status} · {item.ownerTeam}
              </p>
              <p className="mt-1 text-[10px] text-gray-600">
                {item.subjectOwner.displayName ?? item.subjectOwner.ownerId.slice(0, 8)}
                {item.subjectOwner.reviewGroup ? ` · ${item.subjectOwner.reviewGroup}` : ''}
              </p>
              <p className="mt-1 text-[10px] text-gray-600">
                job {item.generationJobId.slice(0, 8)} · {(item.createdAt || '').slice(0, 10)}
              </p>
            </button>
          ))}
        </div>
      )}

      {total > 0 && (
        <p className="text-[10px] text-gray-600">共 {total} 条（当前展示 {items.length} 条）</p>
      )}

      {selectedId && (
        <BadCaseReviewPackDialog packId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </section>
  );
}
