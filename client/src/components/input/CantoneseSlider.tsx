import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import Slider from '../shared/Slider';
import { SLIDER_CONFIG } from '../../constants';

export default function CantoneseSlider() {
  const { state, dispatch } = useContext(AppContext);
  const cfg = SLIDER_CONFIG.cantonese;

  return (
    <Slider
      label="粤语程度"
      value={state.settings.cantoneseLevel}
      min={cfg.min}
      max={cfg.max}
      step={cfg.step}
      leftLabel={cfg.leftLabel}
      rightLabel={cfg.rightLabel}
      onChange={(v) => dispatch({ type: 'SET_CANTO_LEVEL', payload: v })}
    />
  );
}
