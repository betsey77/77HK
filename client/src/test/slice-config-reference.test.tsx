import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { AppContext, AppProvider } from '../context/AppContext';
import ConfigManager from '../components/input/ConfigManager';

function ConfigTracker() {
  const { state, dispatch } = React.useContext(AppContext);
  return (
    <div>
      <span data-testid="saved-reference-ids">
        {(state.savedConfigs[0]?.selectedReferenceCaseIds ?? []).join(',')}
      </span>
      <span data-testid="active-reference-ids">
        {(state.settings.selectedReferenceCaseIds ?? []).join(',')}
      </span>
      <button
        type="button"
        onClick={() => dispatch({ type: 'SET_SELECTED_REFERENCE_CASES', payload: [] })}
      >
        清空参考选择
      </button>
    </div>
  );
}

describe('配置管理保存参考收藏案例', () => {
  const ownerId = 'config-reference-user';

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(`hk-cantonese-settings:${ownerId}`, JSON.stringify({
      settings: { selectedReferenceCaseIds: ['favorite-a', 'favorite-b'] },
    }));
  });

  it('保存配置后可从配置中恢复参考案例 ID，并显示参考数量', () => {
    render(
      <AppProvider ownerId={ownerId}>
        <ConfigTracker />
        <ConfigManager />
      </AppProvider>,
    );

    fireEvent.click(screen.getByText('+ 储存当前配置'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '带参考案例的配置' } });
    fireEvent.click(screen.getByText('储存'));

    expect(screen.getByTestId('saved-reference-ids')).toHaveTextContent('favorite-a,favorite-b');
    expect(screen.getByText('带参考案例的配置')).toHaveAttribute('title', expect.stringContaining('参考2'));

    fireEvent.click(screen.getByText('清空参考选择'));
    expect(screen.getByTestId('active-reference-ids')).toBeEmptyDOMElement();

    fireEvent.click(screen.getByText('带参考案例的配置'));
    expect(screen.getByTestId('active-reference-ids')).toHaveTextContent('favorite-a,favorite-b');
  });
});
