import { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import SegmentedControl from '../shared/SegmentedControl';
import { PLATFORMS } from '../../constants';
import type { Platform } from '../../types';

export default function PlatformSelector() {
  const { state, dispatch } = useContext(AppContext);

  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400 light:text-gray-600 font-medium">📱 目标平台</label>
      <SegmentedControl<Platform>
        options={PLATFORMS}
        value={state.settings.platform}
        onChange={(v) => dispatch({ type: 'SET_PLATFORM', payload: v })}
      />
    </div>
  );
}
