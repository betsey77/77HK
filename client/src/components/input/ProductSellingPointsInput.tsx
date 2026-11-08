import { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { localizeSellingPoint } from '../../services/api';
import type { ProductSellingPoint } from '../../types';
import {
  MAX_PRODUCT_SELLING_POINTS,
  MAX_PRODUCT_SELLING_POINT_LENGTH,
} from '../../utils/productSellingPoints';

function makeSellingPointId() {
  return `selling_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ProductSellingPointsInput() {
  const { state, dispatch } = useContext(AppContext);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const points = state.settings.productSellingPoints;

  const updatePoints = (next: ProductSellingPoint[]) => {
    dispatch({ type: 'SET_PRODUCT_SELLING_POINTS', payload: next });
  };

  const runLocalization = async (point: ProductSellingPoint, current: ProductSellingPoint[]) => {
    setBusyId(point.id);
    setError('');
    updatePoints(current.map((item) => (
      item.id === point.id ? { ...item, status: 'localizing' } : item
    )));

    try {
      const cantoneseText = await localizeSellingPoint(point.sourceText);
      updatePoints(current.map((item) => (
        item.id === point.id ? { ...item, cantoneseText, status: 'ready' } : item
      )));
    } catch {
      updatePoints(current.map((item) => (
        item.id === point.id ? { ...item, status: 'error' } : item
      )));
    } finally {
      setBusyId(null);
    }
  };

  const addPoint = async () => {
    const sourceText = draft.trim();
    if (!sourceText) {
      setError('请输入产品卖点');
      return;
    }
    if (sourceText.length > MAX_PRODUCT_SELLING_POINT_LENGTH) {
      setError(`每条卖点最多 ${MAX_PRODUCT_SELLING_POINT_LENGTH} 字`);
      return;
    }
    if (points.length >= MAX_PRODUCT_SELLING_POINTS) {
      setError(`最多添加 ${MAX_PRODUCT_SELLING_POINTS} 条卖点`);
      return;
    }

    const point: ProductSellingPoint = {
      id: makeSellingPointId(),
      sourceText,
      cantoneseText: '',
      status: 'idle',
    };
    const next = [...points, point];
    setDraft('');
    await runLocalization(point, next);
  };

  return (
    <div data-testid="product-selling-points" className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-medium text-emerald-400 light:text-orange-600">
          ✨ 产品卖点（可选）
        </label>
        <span className="text-[10px] text-gray-500">
          {points.length}/{MAX_PRODUCT_SELLING_POINTS}
        </span>
      </div>
      <p className="text-[10px] text-gray-500">
        逐条加入后自动转成自然港话；原文与港话表达都会保留
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void addPoint();
            }
          }}
          placeholder="输入一条产品卖点（最多 200 字）"
          disabled={busyId !== null || points.length >= MAX_PRODUCT_SELLING_POINTS}
          className="min-w-0 flex-1 rounded-lg border border-gray-700/50 bg-gray-800/50 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 transition-colors focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 light:border-gray-300 light:bg-gray-200 light:text-gray-800 light:placeholder-gray-400"
        />
        <button
          type="button"
          onClick={() => void addPoint()}
          disabled={busyId !== null || points.length >= MAX_PRODUCT_SELLING_POINTS}
          className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 light:bg-orange-600 light:hover:bg-orange-500"
        >
          添加并港化
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {points.length >= MAX_PRODUCT_SELLING_POINTS && (
        <p className="text-xs text-amber-400">已达 10 条上限</p>
      )}

      {points.length > 0 && (
        <div className="space-y-2">
          {points.map((point) => (
            <div
              key={point.id}
              className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-2.5 light:border-gray-300 light:bg-white/60"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1 text-xs">
                  <p className="break-words text-gray-300 light:text-gray-700">
                    <span className="text-gray-500">原文：</span>{point.sourceText}
                  </p>
                  {point.status === 'localizing' && (
                    <p className="text-emerald-400">正在港化...</p>
                  )}
                  {point.status === 'idle' && (
                    <p className="text-amber-400">尚未港化，可重试</p>
                  )}
                  {point.status === 'ready' && (
                    <p className="break-words text-emerald-300 light:text-orange-700">
                      <span className="text-gray-500">港话：</span>{point.cantoneseText}
                    </p>
                  )}
                  {point.status === 'error' && (
                    <p className="text-red-400">港化失败，可重试</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {(point.status === 'idle' || point.status === 'error') && (
                    <button
                      type="button"
                      aria-label="重试港化"
                      disabled={busyId !== null}
                      onClick={() => void runLocalization(point, points)}
                      className="rounded px-2 py-1 text-[11px] text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      重试
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="删除卖点"
                    disabled={busyId !== null}
                    onClick={() => updatePoints(points.filter((item) => item.id !== point.id))}
                    className="rounded px-2 py-1 text-[11px] text-gray-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
