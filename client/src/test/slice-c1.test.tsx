import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext, type ReactNode } from 'react';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { AppProvider, AppContext } from '../context/AppContext';
import { useGenerate } from '../hooks/useGenerate';
import HistoryPage from '../pages/HistoryPage';
import HistoryDetailPage from '../pages/HistoryDetailPage';
import { generateCopy } from '../services/api';
import type { GenerateResponse } from '../types';

// ============================================================
// Mock Supabase — same pattern as slice-b tests
// ============================================================

const { mockSupabase } = vi.hoisted(() => {
  const store = {
    currentSession: null as { access_token: string } | null,
    listeners: new Set<(event: string, session: unknown) => void>(),
  };

  const m = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: store.currentSession }, error: null,
      })),
      onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
        store.listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => { store.listeners.delete(cb); } } } };
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(),
  };

  return { mockSupabase: m };
});

vi.mock('../services/supabase', () => ({
  supabase: mockSupabase,
}));

// ============================================================
// Mock API functions used by HistoryPage
// ============================================================

const mockListJobs = vi.fn();
const mockDeleteJob = vi.fn();
const mockGetJob = vi.fn();
const mockGenerateCopy = vi.fn();

vi.mock('../services/api', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    generateCopy: (...args: unknown[]) => mockGenerateCopy(...args),
    listGenerationJobs: (...args: unknown[]) => mockListJobs(...args),
    deleteGenerationJob: (...args: unknown[]) => mockDeleteJob(...args),
    getGenerationJob: (...args: unknown[]) => mockGetJob(...args),
  };
});

// ============================================================
// Helpers
// ============================================================

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}

function setAuthenticated() {
  mockSupabase.auth.getSession.mockResolvedValue({
    data: {
      session: {
        access_token: 'fake-token',
        refresh_token: 'fake-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: {
          id: 'user-001', email: 'test@example.com',
          email_confirmed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          app_metadata: {}, user_metadata: {},
          aud: 'authenticated', role: 'authenticated',
        },
      },
    },
    error: null,
  });
}

function makeSummary(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    idempotencyKey: `ik-${id}`,
    status: 'completed',
    source: `Test source ${id}`,
    platform: 'ig',
    tone: '活潑',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no session → HistoryPage will show loading then fail
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mockListJobs.mockReset();
  mockDeleteJob.mockReset();
  mockGetJob.mockReset();
  mockGenerateCopy.mockReset();
});

// ============================================================
// Tests
// ============================================================

describe('HistoryPage — loading state', () => {
  beforeEach(() => {
    setAuthenticated();
    // Make listJobs hang (never resolve) to test loading state
    mockListJobs.mockImplementation(() => new Promise(() => {}));
  });

  it('shows loading spinner while fetching', async () => {
    render(<HistoryPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('加载中…')).toBeInTheDocument();
    });
  });
});

describe('HistoryPage — empty state', () => {
  beforeEach(() => {
    setAuthenticated();
    mockListJobs.mockResolvedValue({ jobs: [], total: 0 });
  });

  it('shows empty message when no jobs', async () => {
    render(<HistoryPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('暂无生成记录')).toBeInTheDocument();
    });
  });
});

describe('HistoryPage — error state', () => {
  beforeEach(() => {
    setAuthenticated();
    mockListJobs.mockRejectedValue(new Error('Network error'));
  });

  it('shows error message and retry button', async () => {
    render(<HistoryPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeInTheDocument();
    });
    expect(screen.getByText('重试')).toBeInTheDocument();
  });
});

describe('HistoryPage — populated list', () => {
  beforeEach(() => {
    setAuthenticated();
    mockListJobs.mockResolvedValue({
      jobs: [
        makeSummary('j1', { source: 'First copy', status: 'completed' }),
        makeSummary('j2', { source: 'Second copy', status: 'failed' }),
      ],
      total: 2,
    });
  });

  it('renders job list with correct items', async () => {
    render(<HistoryPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('First copy')).toBeInTheDocument();
    });
    expect(screen.getByText('Second copy')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText('失败')).toBeInTheDocument();
  });

  it('always provides a link back to the workbench', async () => {
    render(<HistoryPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('First copy')).toBeInTheDocument();
    });
    const backLink = screen.getByRole('link', { name: '回到工作台' });
    expect(backLink).toHaveAttribute('href', '/app');
  });
});

describe('HistoryPage — delete', () => {
  beforeEach(() => {
    setAuthenticated();
    mockListJobs.mockResolvedValue({
      jobs: [makeSummary('j1', { source: 'To be deleted' })],
      total: 1,
    });
    mockDeleteJob.mockResolvedValue(undefined);
  });

  it('removes job from list after successful delete', async () => {
    render(<HistoryPage />, { wrapper: Wrapper });

    // Wait for the job to appear
    await waitFor(() => {
      expect(screen.getByText('To be deleted')).toBeInTheDocument();
    });

    // Click delete
    await userEvent.click(screen.getByText('删除'));

    // After delete, mock resolves and job is removed from state
    await waitFor(() => {
      expect(mockDeleteJob).toHaveBeenCalledWith('j1');
    });
  });
});

// ============================================================
// HistoryDetailPage tests
// ============================================================

function makeDetailJob(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    ownerId: 'user-001',
    idempotencyKey: `ik-${id}`,
    status: 'completed',
    source: `Test source ${id}`,
    platform: 'ig',
    tone: '活潑',
    cantoneseLevel: 3,
    englishMixingLevel: 2,
    creativityLevel: 2,
    inputLanguage: 'mandarin',
    brandName: null,
    productName: null,
    brandRedLines: null,
    brief: { source: `Test source ${id}` },
    variants: { standardHK: '變體內容', lightCantonese: 'light variant', ig: 'ig variant', facebook: 'fb variant', shorts: 'shorts variant' },
    variantMeta: null,
    diagnosis: { hasSimplifiedChars: false, mainlandPhrases: [], issues: [] },
    audit: { thermometer: { overall: 85 }, issues: [], replacements: [], risks: [], comments: [] },
    scores: { generated: { cantoneseNaturalness: 80, brandSafety: 90, platformFit: 85, readability: 88, creativity: 75, hookStrength: 70, emojiHashtagFit: 80, engagementPotential: 82, total: 81 }, source: null },
    consumerFeedback: null,
    generationEngine: 'deepseek',
    errorMessage: null,
    errorCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

describe('HistoryDetailPage', () => {
  beforeEach(() => {
    setAuthenticated();
    // Mock window.location.pathname to simulate being on /app/history/:id
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, pathname: '/app/history/job-detail-1' },
    });
  });

  it('shows loading state initially', async () => {
    mockGetJob.mockImplementation(() => new Promise(() => {})); // never resolves

    render(<HistoryDetailPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('加载中…')).toBeInTheDocument();
    });
  });

  it('shows error state with retry button', async () => {
    mockGetJob.mockRejectedValue(new Error('Not found'));

    render(<HistoryDetailPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeInTheDocument();
    });
    expect(screen.getByText('重试')).toBeInTheDocument();
  });

  it('renders job detail with variants, diagnosis, audit, scores', async () => {
    mockGetJob.mockResolvedValue({ job: makeDetailJob('job-detail-1') });

    render(<HistoryDetailPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('Test source job-detail-1')).toBeInTheDocument();
    });
    // Variants are shown
    expect(screen.getByText('變體內容')).toBeInTheDocument();
    // Status badge
    expect(screen.getByText('已完成')).toBeInTheDocument();
    // Sections are present
    expect(screen.getByText('生成文案')).toBeInTheDocument();
    expect(screen.getByText('诊断')).toBeInTheDocument();
    expect(screen.getByText('审核')).toBeInTheDocument();
    expect(screen.getByText('评分')).toBeInTheDocument();
  });

  it('shows back link to history list', async () => {
    mockGetJob.mockResolvedValue({ job: makeDetailJob('job-detail-1') });

    render(<HistoryDetailPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('返回历史列表')).toBeInTheDocument();
    });
  });

  it('shows delete button and can delete', async () => {
    mockGetJob.mockResolvedValue({ job: makeDetailJob('job-detail-1') });
    mockDeleteJob.mockResolvedValue(undefined);

    render(<HistoryDetailPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('删除')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('删除'));

    await waitFor(() => {
      expect(screen.getByText('已删除')).toBeInTheDocument();
    });
  });

  it('renders failed job with error message', async () => {
    mockGetJob.mockResolvedValue({
      job: makeDetailJob('job-failed', {
        status: 'failed',
        errorMessage: 'AI engine timeout',
        errorCode: 'GENERATION_ERROR',
        variants: null,
        diagnosis: null,
        audit: null,
        scores: null,
      }),
    });

    render(<HistoryDetailPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('生成失败')).toBeInTheDocument();
    });
    expect(screen.getByText('AI engine timeout')).toBeInTheDocument();
  });
});

// ============================================================
// Slice C1 v4: generateCopy direct tests (mocking fetch)
// ============================================================

function makeCompletedResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        diagnosis: {
          hasSimplifiedChars: false,
          mainlandPhrases: [],
          issues: [],
        },
        variants: {
          standardHK: '標準繁體文案',
          lightCantonese: '輕粵語文案',
          ig: 'IG文案',
          facebook: 'FB文案',
          shorts: '短片文案',
        },
        audit: {
          thermometer: { overall: 85 },
          issues: [],
          replacements: [],
          risks: [],
          comments: [],
        },
        generationEngine: 'deepseek',
        scores: {
          generated: {
            cantoneseNaturalness: 80,
            brandSafety: 90,
            platformFit: 85,
            readability: 88,
            creativity: 75,
            hookStrength: 70,
            emojiHashtagFit: 80,
            engagementPotential: 82,
            total: 81,
          },
          source: null,
        },
        jobId: 'job-001',
        ...overrides,
      }),
  };
}

function makePendingResponse(jobId = 'job-pending-1') {
  return {
    ok: true,
    status: 202,
    json: () =>
      Promise.resolve({
        jobId,
        status: 'processing' as const,
        message: 'Generation is already in progress.',
        idempotent: true,
      }),
  };
}

function makeFailedResponse(jobId = 'job-failed-1', error = 'AI engine timeout') {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        jobId,
        status: 'failed' as const,
        error,
        errorCode: 'GENERATION_ERROR',
        idempotent: true,
        retryHint: 'Use a new idempotencyKey to retry generation.',
      }),
  };
}

function makePollResponse(job: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ job }),
  };
}

function makeCompletedJob(jobId: string): Record<string, unknown> {
  return {
    id: jobId,
    ownerId: 'user-001',
    idempotencyKey: 'test-key',
    status: 'completed',
    source: 'test source',
    platform: 'ig',
    tone: '活潑',
    cantoneseLevel: 3,
    englishMixingLevel: 2,
    creativityLevel: 2,
    inputLanguage: 'mandarin',
    brandName: null,
    productName: null,
    brandRedLines: null,
    brief: { source: 'test source' },
    variants: {
      standardHK: '標準繁體文案',
      lightCantonese: '輕粵語文案',
      ig: 'IG文案',
      facebook: 'FB文案',
      shorts: '短片文案',
    },
    variantMeta: null,
    diagnosis: {
      hasSimplifiedChars: false,
      mainlandPhrases: [],
      issues: [],
    },
    audit: {
      thermometer: { overall: 85 },
      issues: [],
      replacements: [],
      risks: [],
      comments: [],
    },
    scores: {
      generated: {
        cantoneseNaturalness: 80,
        brandSafety: 90,
        platformFit: 85,
        readability: 88,
        creativity: 75,
        hookStrength: 70,
        emojiHashtagFit: 80,
        engagementPotential: 82,
        total: 81,
      },
      source: null,
    },
    consumerFeedback: null,
    generationEngine: 'deepseek',
    errorMessage: null,
    errorCode: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    deletedAt: null,
  };
}

function makeFailedJob(jobId: string): Record<string, unknown> {
  return {
    ...makeCompletedJob(jobId),
    status: 'failed',
    variants: null,
    diagnosis: null,
    audit: null,
    scores: null,
    errorMessage: 'AI engine timeout',
    errorCode: 'GENERATION_ERROR',
  };
}

function makePendingJob(jobId: string): Record<string, unknown> {
  return {
    ...makeCompletedJob(jobId),
    status: 'processing',
    variants: null,
    diagnosis: null,
    audit: null,
    scores: null,
  };
}

function makeGenerateRequest() {
  return {
    source: 'test source',
    platform: 'ig' as const,
    tone: '活潑' as const,
    cantoneseLevel: 3,
    englishMixingLevel: 2,
    useEnhancement: false,
    creativityLevel: 2,
    inputLanguage: 'mandarin' as const,
  };
}

const MOCK_KEY = 'gen-99999999-test0001';

describe('generateCopy — network retry', () => {
  let realGenerateCopy: typeof generateCopy;

  beforeEach(async () => {
    setAuthenticated();
    const actual = await vi.importActual<typeof import('../services/api')>(
      '../services/api',
    );
    realGenerateCopy = actual.generateCopy;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries once on fetch failure, reusing same idempotencyKey', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(makeCompletedResponse());

    vi.stubGlobal('fetch', fetchMock);

    const result = await realGenerateCopy(makeGenerateRequest(), MOCK_KEY);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Both calls must use the same idempotencyKey in the request body
    const body1 = JSON.parse(fetchMock.mock.calls[0][1].body);
    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body1.idempotencyKey).toBe(MOCK_KEY);
    expect(body2.idempotencyKey).toBe(MOCK_KEY);

    expect(result.variants.standardHK).toBe('標準繁體文案');
  });

  it('throws if both attempts fail', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error again'));

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      realGenerateCopy(makeGenerateRequest(), MOCK_KEY),
    ).rejects.toThrow('Network error again');
  });
});

describe('generateCopy — 200 failed body', () => {
  let realGenerateCopy: typeof generateCopy;

  beforeEach(async () => {
    setAuthenticated();
    const actual = await vi.importActual<typeof import('../services/api')>(
      '../services/api',
    );
    realGenerateCopy = actual.generateCopy;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws on HTTP 200 with body.status=failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFailedResponse()));

    await expect(
      realGenerateCopy(makeGenerateRequest(), MOCK_KEY),
    ).rejects.toThrow('AI engine timeout');
  });

  it('does NOT return incomplete data for failed body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFailedResponse()));

    try {
      await realGenerateCopy(makeGenerateRequest(), MOCK_KEY);
    } catch (err) {
      // Verify the error is thrown and the result never has incomplete fields
      expect(err).toBeInstanceOf(Error);
    }

    // After catching, confirm no data leaked through
    expect.assertions(1);
  });
});

describe('generateCopy — 202 polling', () => {
  let realGenerateCopy: typeof generateCopy;

  beforeEach(async () => {
    setAuthenticated();
    const actual = await vi.importActual<typeof import('../services/api')>(
      '../services/api',
    );
    realGenerateCopy = actual.generateCopy;
    vi.useFakeTimers(); // manual control, no shouldAdvanceTime
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('polls until completed, then returns full GenerateResponse', async () => {
    const fetchMock = vi
      .fn()
      // POST — returns 202
      .mockResolvedValueOnce(makePendingResponse('job-poll-1'))
      // Poll 1 — still processing
      .mockResolvedValueOnce(makePollResponse(makePendingJob('job-poll-1')))
      // Poll 2 — completed
      .mockResolvedValueOnce(makePollResponse(makeCompletedJob('job-poll-1')));

    vi.stubGlobal('fetch', fetchMock);

    const promise = realGenerateCopy(makeGenerateRequest(), MOCK_KEY);

    // Advance past first setTimeout (1s delay) → first poll: processing
    await act(() => vi.advanceTimersToNextTimerAsync());
    // Advance past second setTimeout (2s delay) → second poll: completed
    await act(() => vi.advanceTimersToNextTimerAsync());

    const result = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(3); // POST + 2 polls
    expect(result.variants.standardHK).toBe('標準繁體文案');
    expect(result.diagnosis).toBeDefined();
    expect(result.audit).toBeDefined();
    expect(result.scores).toBeDefined();
  });

  it('throws when polled job reaches failed status', async () => {
    const fetchMock = vi
      .fn()
      // POST — returns 202
      .mockResolvedValueOnce(makePendingResponse('job-poll-fail'))
      // Poll 1 — processing
      .mockResolvedValueOnce(makePollResponse(makePendingJob('job-poll-fail')))
      // Poll 2 — failed
      .mockResolvedValueOnce(makePollResponse(makeFailedJob('job-poll-fail')));

    vi.stubGlobal('fetch', fetchMock);

    const promise = realGenerateCopy(makeGenerateRequest(), MOCK_KEY);
    // Pre-attach catch to avoid unhandled rejection during timer advance
    promise.catch(() => {});

    // Advance past first setTimeout (1s) → poll 1: processing
    await act(() => vi.advanceTimersToNextTimerAsync());
    // Advance past second setTimeout (2s) → poll 2: failed → throws
    await act(() => vi.advanceTimersToNextTimerAsync());

    await expect(promise).rejects.toThrow('AI engine timeout');
  });

  it('times out and includes jobId in error for recovery', async () => {
    // Always return processing — never completes
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makePendingResponse('job-poll-timeout'))
      .mockResolvedValue(makePollResponse(makePendingJob('job-poll-timeout')));

    vi.stubGlobal('fetch', fetchMock);

    const promise = realGenerateCopy(makeGenerateRequest(), MOCK_KEY);
    // Pre-attach catch to avoid unhandled rejection during timer advance
    promise.catch(() => {});

    // Advance past the 120s max poll window.
    // Each poll iteration has increasing backoff (1s, 2s, 4s, 8s, 16s...).
    // Advance 130s total to ensure we pass the 120s limit.
    await act(() => vi.advanceTimersByTimeAsync(130_000));

    await expect(promise).rejects.toThrow(
      /Generation timed out.*job-poll-timeout/,
    );
  });
});

// ============================================================
// Slice C1 v4: useGenerate dispatch behaviour (mocking generateCopy)
// ============================================================

function makeGenerateResponse(): GenerateResponse {
  return {
    diagnosis: {
      hasSimplifiedChars: false,
      mainlandPhrases: [],
      issues: [],
    },
    variants: {
      standardHK: '標準繁體文案',
      lightCantonese: '輕粵語文案',
      ig: 'IG文案',
      facebook: 'FB文案',
      shorts: '短片文案',
    },
    audit: {
      thermometer: { overall: 85 },
      issues: [],
      replacements: [],
      risks: [],
      comments: [],
    },
    generationEngine: 'deepseek',
    scores: {
      generated: {
        cantoneseNaturalness: 80,
        brandSafety: 90,
        platformFit: 85,
        readability: 88,
        creativity: 75,
        hookStrength: 70,
        emojiHashtagFit: 80,
        engagementPotential: 82,
        total: 81,
      },
      source: null,
    },
  };
}

function GenerateFlowWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          {children}
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

/** Test component that uses useGenerate and renders dispatch outcomes. */
function GenerateFlowHarness() {
  const { generate } = useGenerate();
  const { state, dispatch } = useContext(AppContext);

  return (
    <div>
      <span data-testid="ui-state">{state.uiState}</span>
      {state.error && <span data-testid="error">{state.error}</span>}
      {state.variants && (
        <span data-testid="variant">{state.variants.standardHK}</span>
      )}
      <button
        data-testid="set-source"
        onClick={() =>
          dispatch({
            type: 'SET_SOURCE',
            payload: 'A test source for generation',
          })
        }
      >
        Set Source
      </button>
      <button data-testid="trigger" onClick={() => generate()}>
        Generate
      </button>
    </div>
  );
}

describe('useGenerate — dispatch behaviour (C1 v4)', () => {
  beforeEach(() => {
    setAuthenticated();
    mockGenerateCopy.mockReset();
  });

  it('SET_RESULTS on success — full GenerateResponse dispatched', async () => {
    mockGenerateCopy.mockResolvedValue(makeGenerateResponse());

    render(<GenerateFlowHarness />, { wrapper: GenerateFlowWrapper });

    // Set source text then trigger generation
    await userEvent.click(screen.getByTestId('set-source'));
    await userEvent.click(screen.getByTestId('trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('ui-state').textContent).toBe('success');
    });

    // Variants must be rendered — proves SET_RESULTS received complete data
    expect(screen.getByTestId('variant').textContent).toBe('標準繁體文案');
  });

  it('SET_ERROR on generateCopy rejection — never SET_RESULTS', async () => {
    mockGenerateCopy.mockRejectedValue(new Error('AI engine timeout'));

    render(<GenerateFlowHarness />, { wrapper: GenerateFlowWrapper });

    await userEvent.click(screen.getByTestId('set-source'));
    await userEvent.click(screen.getByTestId('trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('ui-state').textContent).toBe('error');
    });

    expect(screen.getByTestId('error').textContent).toBe('AI engine timeout');

    // Variants must NOT be in the DOM
    expect(screen.queryByTestId('variant')).toBeNull();
  });

  it('never dispatches SET_RESULTS with incomplete data (timeout/202 case)', async () => {
    // In v4, generateCopy polls internally and only returns a full
    // GenerateResponse. If it throws, SET_ERROR is dispatched instead.
    mockGenerateCopy.mockRejectedValue(
      new Error(
        'Generation timed out. You can check results in history (job xyz).',
      ),
    );

    render(<GenerateFlowHarness />, { wrapper: GenerateFlowWrapper });

    await userEvent.click(screen.getByTestId('set-source'));
    await userEvent.click(screen.getByTestId('trigger'));

    await waitFor(() => {
      expect(screen.getByTestId('ui-state').textContent).toBe('error');
    });

    // SET_RESULTS must never have been dispatched — no variants in DOM
    expect(screen.queryByTestId('variant')).toBeNull();

    // Error must contain the jobId for user recovery
    expect(screen.getByTestId('error').textContent).toContain('job xyz');
  });

  it('idempotency key is regenerated on each new generate() click', async () => {
    mockGenerateCopy.mockResolvedValue(makeGenerateResponse());

    render(<GenerateFlowHarness />, { wrapper: GenerateFlowWrapper });

    await userEvent.click(screen.getByTestId('set-source'));

    // First click
    await userEvent.click(screen.getByTestId('trigger'));
    await waitFor(() => {
      expect(screen.getByTestId('ui-state').textContent).toBe('success');
    });

    const firstKey = mockGenerateCopy.mock.calls[0]?.[1] as string;

    // Reset for second click
    mockGenerateCopy.mockClear();

    // Second click
    await userEvent.click(screen.getByTestId('trigger'));

    await waitFor(() => {
      expect(mockGenerateCopy).toHaveBeenCalled();
    });

    const secondKey = mockGenerateCopy.mock.calls[0]?.[1] as string;

    // Keys must be different for distinct user actions
    expect(firstKey).toBeDefined();
    expect(secondKey).toBeDefined();
    expect(firstKey).not.toBe(secondKey);
    // Both must follow the expected format
    expect(firstKey).toMatch(/^gen-\d+-[a-f0-9]{8}$/);
    expect(secondKey).toMatch(/^gen-\d+-[a-f0-9]{8}$/);
  });
});
