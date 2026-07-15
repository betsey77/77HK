/**
 * Slice C: HTTP 402 → quota upgrade dialog (status-based, not message matching)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext, type ReactNode } from 'react';
import { AppContext, AppProvider } from '../context/AppContext';
import { PlanAccessContext, type PlanAccessContextValue } from '../context/PlanAccessContext';
import { useGenerate } from '../hooks/useGenerate';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import { ApiError } from '../services/api';

const OWNER_ID = 'quota-dialog-user';

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

const mockGenerateCopy = vi.fn();
vi.mock('../services/api', async () => {
  const actual = await vi.importActual<typeof import('../services/api')>('../services/api');
  return {
    ...actual,
    generateCopy: (...args: unknown[]) => mockGenerateCopy(...args),
  };
});

function wrapper() {
  const plan: PlanAccessContextValue = {
    planId: 'free',
    isLoading: false,
    error: null,
    refresh: async () => {},
  };
  return function W({ children }: { children: ReactNode }) {
    return (
      <PlanAccessContext.Provider value={plan}>
        <AppProvider ownerId={OWNER_ID}>{children}</AppProvider>
      </PlanAccessContext.Provider>
    );
  };
}

function QuotaHarness() {
  const { state, dispatch } = useContext(AppContext);
  const { generate, quotaDialogOpen, closeQuotaDialog } = useGenerate();

  return (
    <div>
      <button
        type="button"
        data-testid="set-source"
        onClick={() => dispatch({ type: 'SET_SOURCE', payload: '测试原文内容足够长' })}
      >
        set source
      </button>
      <button type="button" data-testid="generate" onClick={() => generate()}>
        generate
      </button>
      <span data-testid="source">{state.source}</span>
      <span data-testid="ui-state">{state.uiState}</span>
      <span data-testid="error">{state.error ?? ''}</span>
      <span data-testid="quota-open">{quotaDialogOpen ? 'yes' : 'no'}</span>

      <ConfirmDialog
        open={quotaDialogOpen}
        title="账户配额不足"
        message="当前 Free 套餐的生成额度已用完。升级 Pro 后可继续生成，并解锁完整收藏与历史访问。"
        cancelLabel="暂不充值"
        confirmLabel="充值 Pro"
        onCancel={closeQuotaDialog}
        onConfirm={() => {
          closeQuotaDialog();
          window.location.assign('/app/billing');
        }}
      />
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  mockGenerateCopy.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiError status branching', () => {
  it('ApiError carries numeric status', () => {
    const err = new ApiError('quota', 402);
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(402);
    expect(err.message).toBe('quota');
  });
});

describe('useGenerate 402 quota dialog', () => {
  it('opens dialog on ApiError 402 and keeps source text', async () => {
    mockGenerateCopy.mockRejectedValue(new ApiError('Quota exceeded', 402));

    render(<QuotaHarness />, { wrapper: wrapper() });
    await userEvent.click(screen.getByTestId('set-source'));
    await userEvent.click(screen.getByTestId('generate'));

    await waitFor(() => {
      expect(screen.getByTestId('quota-open')).toHaveTextContent('yes');
    });
    expect(screen.getByRole('alertdialog')).toHaveTextContent('账户配额不足');
    expect(screen.getByTestId('source')).toHaveTextContent('测试原文内容足够长');

    await userEvent.click(screen.getByRole('button', { name: '暂不充值' }));
    expect(screen.getByTestId('quota-open')).toHaveTextContent('no');
    expect(screen.getByTestId('source')).toHaveTextContent('测试原文内容足够长');
  });

  it('does not open dialog on HTTP 500-style ApiError', async () => {
    mockGenerateCopy.mockRejectedValue(new ApiError('Internal Server Error', 500));

    render(<QuotaHarness />, { wrapper: wrapper() });
    await userEvent.click(screen.getByTestId('set-source'));
    await userEvent.click(screen.getByTestId('generate'));

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Internal Server Error');
    });
    expect(screen.getByTestId('quota-open')).toHaveTextContent('no');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('充值 Pro navigates to /app/billing', async () => {
    mockGenerateCopy.mockRejectedValue(new ApiError('Quota exceeded', 402));
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });

    render(<QuotaHarness />, { wrapper: wrapper() });
    await userEvent.click(screen.getByTestId('set-source'));
    await userEvent.click(screen.getByTestId('generate'));

    await waitFor(() => expect(screen.getByTestId('quota-open')).toHaveTextContent('yes'));
    await userEvent.click(screen.getByRole('button', { name: '充值 Pro' }));
    expect(assign).toHaveBeenCalledWith('/app/billing');
  });
});

describe('generateCopy throws ApiError with status on non-OK', () => {
  it('maps res.status into ApiError.status', async () => {
    // Use real generateCopy (not the mock in this describe — re-import actual)
    const actual = await vi.importActual<typeof import('../services/api')>('../services/api');

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 402,
        json: async () => ({ error: 'quota reserved failed' }),
      }),
    );

    // Bypass module mock by calling actual.generateCopy
    await expect(
      actual.generateCopy(
        {
          source: 'x',
          platform: 'all',
          tone: '活潑',
          cantoneseLevel: 4,
          englishMixingLevel: 1,
          useEnhancement: false,
          creativityLevel: 2,
          inputLanguage: 'mandarin',
        },
        'key-402',
      ),
    ).rejects.toMatchObject({ name: 'ApiError', status: 402 });
  });
});
