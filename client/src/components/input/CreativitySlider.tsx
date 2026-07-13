import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import Slider from '../shared/Slider';
import { SLIDER_CONFIG, getCreativityLabel } from '../../constants';

export default function CreativitySliderComponent() {
  const { state, dispatch } = useContext(AppContext);
  const cfg = SLIDER_CONFIG.creativity;
  const label = getCreativityLabel(state.settings.creativityLevel);

  return (
    <div className="space-y-1">
      <Slider
        label="🎨 创作自由度"
        value={state.settings.creativityLevel}
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        leftLabel={cfg.leftLabel}
        rightLabel={cfg.rightLabel}
        onChange={(v) => dispatch({ type: 'SET_CREATIVITY_LEVEL', payload: v })}
      />
      <p className="text-[10px] text-gray-500 light:text-gray-500 leading-tight px-0.5">{label}</p>
    </div>
  );
}
