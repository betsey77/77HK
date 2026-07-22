import { useContext } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppContext, AppProvider } from '../context/AppContext';
import ResultsPanel from '../components/results/ResultsPanel';
import type { GenerateResponse } from '../types';

function makeResult(prefix: string): GenerateResponse {
  return {
    diagnosis: {
      hasSimplifiedChars: false,
      mainlandPhrases: [],
      issues: [],
    },
    variants: {
      standardHK: `${prefix}標準繁體`,
      lightCantonese: `${prefix}輕粵語`,
      ig: `${prefix}IG`,
      facebook: `${prefix}Facebook`,
      shorts: `${prefix}Shorts`,
    },
    audit: {
      thermometer: {
        overall: 90,
        dimensions: {
          cantoneseFeel: 4,
          culturalFit: 4,
          platformFit: 4,
          brandSafety: 5,
          tradConsistency: 5,
          hookStrength: 4,
          visualStrategy: 4,
          engagementFit: 4,
        },
      },
      issues: [],
      replacements: [],
      risks: [],
      comments: [],
    },
    generationEngine: 'deepseek',
  };
}

function RegenerationHarness() {
  const { state, dispatch } = useContext(AppContext);
  const first = makeResult('第一版');
  const second = makeResult('第二版');

  return (
    <>
      <button type="button" onClick={() => dispatch({ type: 'SET_RESULTS', payload: first })}>
        生成第一版
      </button>
      <button
        type="button"
        onClick={() => {
          const originalText = state.variants?.lightCantonese ?? '';
          dispatch({
            type: 'MARK_VARIANT_MODIFIED',
            payload: { key: 'lightCantonese', originalText },
          });
          dispatch({
            type: 'UPDATE_VARIANT',
            payload: { key: 'lightCantonese', text: `${originalText}（人工修改）` },
          });
        }}
      >
        模拟修改
      </button>
      <button type="button" onClick={() => dispatch({ type: 'SET_RESULTS', payload: second })}>
        再次生成
      </button>
      <div className="h-[600px]">
        <ResultsPanel />
      </div>
    </>
  );
}

describe('V2.1 release UI regressions', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('treats a regenerated response as a fresh baseline instead of marking all copy red', async () => {
    const user = userEvent.setup();
    render(
      <AppProvider ownerId="release-regression-owner">
        <RegenerationHarness />
      </AppProvider>,
    );

    await user.click(screen.getByRole('button', { name: '生成第一版' }));
    await user.click(screen.getByRole('button', { name: '模拟修改' }));
    expect(screen.getByText('红色标记为修改内容')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '再次生成' }));

    expect(
      screen.getByText((_, element) =>
        element?.tagName === 'P' && element.textContent === '第二版輕粵語'),
    ).toBeInTheDocument();
    expect(screen.queryByText('红色标记为修改内容')).not.toBeInTheDocument();
  });
});
