import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import Slider from '../shared/Slider';
import { SLIDER_CONFIG } from '../../constants';

export default function EnglishMixingSlider() {
  const { state, dispatch } = useContext(AppContext);
  const cfg = SLIDER_CONFIG.englishMixing;

  return (
    <Slider
      label="中英夹杂"
      value={state.settings.englishMixingLevel}
      min={cfg.min}
      max={cfg.max}
      step={cfg.step}
      leftLabel={cfg.leftLabel}
      rightLabel={cfg.rightLabel}
      onChange={(v) => dispatch({ type: 'SET_ENGLISH_LEVEL', payload: v })}
    />
  );
}
