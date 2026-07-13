import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { TONES } from '../../constants';
import type { BrandTone } from '../../types';

export default function ToneSelector() {
  const { state, dispatch } = useContext(AppContext);

  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400 light:text-gray-600 font-medium">品牌语气</label>
      <select
        value={state.settings.tone}
        onChange={(e) => dispatch({ type: 'SET_TONE', payload: e.target.value as BrandTone })}
        className="w-full bg-gray-800/50 light:bg-gray-200 border border-gray-700/50 light:border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-200 light:text-gray-800
          focus:outline-none focus:border-emerald-500/50 light:focus:border-orange-500/50 focus:ring-1 focus:ring-emerald-500/20 light:focus:ring-orange-500/20 transition-colors
          cursor-pointer"
      >
        {TONES.map((t) => (
          <option key={t.value} value={t.value} title={t.description}>
            {t.label} — {t.description}
          </option>
        ))}
      </select>
    </div>
  );
}
