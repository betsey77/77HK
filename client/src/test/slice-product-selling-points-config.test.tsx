import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useContext } from 'react';
import { AppContext, AppProvider } from '../context/AppContext';
import ConfigManager from '../components/input/ConfigManager';
import type { ProductSellingPoint } from '../types';

const points: ProductSellingPoint[] = [{
  id: 'point-1',
  sourceText: '轻便易携带',
  cantoneseText: '夠輕身，拎出街都方便',
  status: 'ready',
}];

function Harness() {
  const { state, dispatch } = useContext(AppContext);
  return (
    <div>
      <span data-testid="active-points">{JSON.stringify(state.settings.productSellingPoints)}</span>
      <span data-testid="saved-points">{JSON.stringify(state.savedConfigs[0]?.productSellingPoints ?? [])}</span>
      <button type="button" onClick={() => dispatch({ type: 'SET_PRODUCT_SELLING_POINTS', payload: points })}>
        set-points
      </button>
      <button type="button" onClick={() => dispatch({ type: 'SET_PRODUCT_SELLING_POINTS', payload: [] })}>
        clear-points
      </button>
      <ConfigManager />
    </div>
  );
}

describe('产品卖点本地配置保存与载入', () => {
  beforeEach(() => localStorage.clear());

  it('保存配置后可完整恢复原文与港话表达', () => {
    render(
      <AppProvider ownerId="selling-point-config-user">
        <Harness />
      </AppProvider>,
    );

    fireEvent.click(screen.getByText('set-points'));
    fireEvent.click(screen.getByText('+ 储存当前配置'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '产品卖点配置' } });
    fireEvent.click(screen.getByText('储存'));
    expect(screen.getByTestId('saved-points')).toHaveTextContent('夠輕身，拎出街都方便');

    fireEvent.click(screen.getByText('clear-points'));
    expect(screen.getByTestId('active-points')).toHaveTextContent('[]');
    fireEvent.click(screen.getByText('产品卖点配置'));
    expect(screen.getByTestId('active-points')).toHaveTextContent('轻便易携带');
    expect(screen.getByTestId('active-points')).toHaveTextContent('夠輕身，拎出街都方便');
  });
});
