import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { MAX_SOURCE_LENGTH, SOURCE_WARN_LENGTH } from '../../constants';

export default function SourceEditor() {
  const { state, dispatch } = useContext(AppContext);
  const charCount = state.source.length;
  const isWarn = charCount > SOURCE_WARN_LENGTH;
  const isOver = charCount > MAX_SOURCE_LENGTH;

  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400 light:text-gray-600 font-medium">原文输入</label>
      <textarea
        value={state.source}
        onChange={(e) => dispatch({ type: 'SET_SOURCE', payload: e.target.value })}
        placeholder="喺度贴上普通话/简体中文/英文嘅社媒文案或 campaign brief..."
        rows={8}
        className="w-full bg-gray-800/50 light:bg-gray-200 border border-gray-700/50 light:border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-200 light:text-gray-800
          placeholder-gray-500 light:placeholder-gray-400 resize-y focus:outline-none focus:border-emerald-500/50 light:focus:border-orange-500/50 focus:ring-1 focus:ring-emerald-500/20 light:focus:ring-orange-500/20
          transition-colors"
      />
      <div className="flex justify-between text-[11px]">
        <span className={isWarn ? (isOver ? 'text-red-400' : 'text-amber-400') : 'text-gray-500 light:text-gray-500'}>
          {charCount} / {MAX_SOURCE_LENGTH} 字
        </span>
        {isOver && (
          <span className="text-red-400">超出字数限制，将自动截断</span>
        )}
      </div>
    </div>
  );
}
