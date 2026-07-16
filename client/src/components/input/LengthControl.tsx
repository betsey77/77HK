import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import Slider from '../shared/Slider';
import { LENGTH_LEVEL_LABELS } from '../../utils/w1Settings';

export default function LengthControl() {
  const { state, dispatch } = useContext(AppContext);
  const enabled = state.settings.lengthControlEnabled;
  const level = state.settings.copyLengthLevel;
  const label = LENGTH_LEVEL_LABELS[level] ?? '标准';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-emerald-400 light:text-orange-600">长度控制</label>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => dispatch({ type: 'SET_LENGTH_CONTROL_ENABLED', payload: !enabled })}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            enabled
              ? 'bg-emerald-500 light:bg-orange-500'
              : 'bg-gray-700 light:bg-gray-300'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </div>
      <p className="text-[10px] text-gray-500 light:text-gray-500">
        {enabled
          ? `已开启软目标：${label}（不做硬截断）`
          : '关闭时不向模型注入长度要求'}
      </p>
      {enabled && (
        <Slider
          label="长度档位"
          value={level}
          min={1}
          max={5}
          step={1}
          leftLabel="极短"
          rightLabel="加长"
          onChange={(v) => dispatch({ type: 'SET_COPY_LENGTH_LEVEL', payload: v })}
        />
      )}
    </div>
  );
}
