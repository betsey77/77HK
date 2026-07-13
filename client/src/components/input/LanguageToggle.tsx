import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { INPUT_LANGUAGES } from '../../constants';
import type { InputLanguage } from '../../types';

export default function LanguageToggle() {
  const { state, dispatch } = useContext(AppContext);

  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400 light:text-gray-600 font-medium">原文语言</label>
      <div className="flex rounded-lg bg-gray-800/50 light:bg-gray-200 border border-gray-700/50 light:border-gray-300 p-0.5">
        {INPUT_LANGUAGES.map((opt) => {
          const active = state.settings.inputLanguage === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() =>
                dispatch({ type: 'SET_INPUT_LANGUAGE', payload: opt.value as InputLanguage })
              }
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
                active
                  ? 'bg-emerald-500/20 light:bg-orange-500/20 text-emerald-300 light:text-orange-700 border border-emerald-500/30 light:border-orange-500/30'
                  : 'text-gray-500 light:text-gray-500 hover:text-gray-300 border border-transparent'
              }`}
              title={opt.hint}
            >
              <div>{opt.label}</div>
              <div className={`text-[10px] mt-0.5 ${active ? 'text-emerald-400/70 light:text-orange-600/70' : 'text-gray-600 light:text-gray-500'}`}>
                {opt.hint}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
