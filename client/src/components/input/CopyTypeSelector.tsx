import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { COPY_TYPES, isValidCustomCopyType } from '../../utils/w1Settings';
import type { CopyType } from '../../types';

export default function CopyTypeSelector() {
  const { state, dispatch } = useContext(AppContext);
  const { copyType, customCopyType } = state.settings;
  const showCustom = copyType === 'custom';
  const customOk = !showCustom || isValidCustomCopyType(customCopyType);

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-gray-400 light:text-gray-600 font-medium">📝 文案类型</label>
      <select
        value={copyType}
        onChange={(e) => dispatch({ type: 'SET_COPY_TYPE', payload: e.target.value as CopyType })}
        className="w-full bg-gray-800/50 light:bg-gray-200 border border-gray-700/50 light:border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-200 light:text-gray-800
          focus:outline-none focus:border-emerald-500/50 light:focus:border-orange-500/50 focus:ring-1 focus:ring-emerald-500/20 light:focus:ring-orange-500/20 transition-colors
          cursor-pointer"
      >
        {COPY_TYPES.map((item) => (
          <option key={item.value} value={item.value} title={item.description}>
            {item.label} — {item.description}
          </option>
        ))}
      </select>
      {showCustom && (
        <div className="space-y-1">
          <input
            type="text"
            value={customCopyType}
            maxLength={20}
            placeholder="请填写类型说明（2–20 字）"
            onChange={(e) => dispatch({ type: 'SET_CUSTOM_COPY_TYPE', payload: e.target.value })}
            className={`w-full bg-gray-800/50 light:bg-gray-200 border rounded-lg px-3 py-2 text-sm text-gray-200 light:text-gray-800
              placeholder-gray-600 light:placeholder-gray-400 focus:outline-none transition-colors
              ${customOk
                ? 'border-gray-700/50 light:border-gray-300 focus:border-emerald-500/50 light:focus:border-orange-500/50'
                : 'border-red-500/60 focus:border-red-500'}`}
          />
          {!customOk && (
            <p className="text-[10px] text-red-400">其他类型需填写 2–20 字补充说明</p>
          )}
        </div>
      )}
    </div>
  );
}
