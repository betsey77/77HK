import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { TONES } from '../../constants';
import { TONE_MODIFIERS } from '../../utils/w1Settings';
import type { BrandTone, ToneModifier } from '../../types';

export default function ToneSelector() {
  const { state, dispatch } = useContext(AppContext);
  const primary = state.settings.primaryTone ?? state.settings.tone;
  const modifiers = state.settings.toneModifiers ?? [];

  const toggleModifier = (value: ToneModifier) => {
    const has = modifiers.includes(value);
    let next: ToneModifier[];
    if (has) {
      next = modifiers.filter((m) => m !== value);
    } else if (modifiers.length >= 2) {
      next = [modifiers[1]!, value];
    } else {
      next = [...modifiers, value];
    }
    dispatch({ type: 'SET_TONE_MODIFIERS', payload: next });
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-xs text-gray-400 light:text-gray-600 font-medium">🎭 主语气</label>
        <select
          value={primary}
          onChange={(e) =>
            dispatch({ type: 'SET_PRIMARY_TONE', payload: e.target.value as BrandTone })
          }
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

      <div className="space-y-1">
        <label className="text-xs text-gray-400 light:text-gray-600 font-medium">
          修饰语气 <span className="text-gray-600 light:text-gray-400">（最多 2 个）</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TONE_MODIFIERS.map((item) => {
            const active = modifiers.includes(item.value);
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => toggleModifier(item.value)}
                className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 light:bg-orange-500/15 light:border-orange-400/40 light:text-orange-600'
                    : 'bg-gray-800/40 border-gray-700/50 text-gray-400 light:bg-gray-100 light:border-gray-300 light:text-gray-600 hover:border-gray-500'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
