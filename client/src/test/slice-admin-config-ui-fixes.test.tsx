/**
 * Admin review modal layout + Chinese labels, config date save/restore, input label emoji.
 * Frontend-only; no billing/migration/admin write APIs.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React, { useContext } from 'react';
import { AppContext, AppProvider } from '../context/AppContext';
import ConfigManager from '../components/input/ConfigManager';
import CopyTypeSelector from '../components/input/CopyTypeSelector';
import PlatformSelector from '../components/input/PlatformSelector';
import ToneSelector from '../components/input/ToneSelector';
import TargetDatePicker from '../components/input/TargetDatePicker';
import { getHongKongDateString } from '../utils/hongKongDate';

const mockApi = vi.hoisted(() => ({
  checkAdminAccess: vi.fn().mockResolvedValue(true),
  getAdminStats: vi.fn().mockResolvedValue({
    totalUsers: 1,
    activeSubscriptions: 0,
    totalGenerations: 0,
    totalFeedback: 0,
    adminUsers: 1,
    role: 'admin' as const,
  }),
  getAdminUsers: vi.fn().mockResolvedValue({ users: [], total: 0 }),
  getAdminGenerations: vi.fn().mockResolvedValue({ jobs: [], total: 0 }),
  getAdminFeedback: vi.fn().mockResolvedValue({ feedback: [], total: 0 }),
  getAdminSubscriptions: vi.fn().mockResolvedValue({ subscriptions: [], total: 0 }),
  getAdminAuditLog: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
  getAdminFavorites: vi.fn().mockResolvedValue({
    favorites: [{
      id: 'favorite-spoken',
      ownerDisplayName: '用户 abc',
      userEmail: 'user@example.com',
      // platform=all falls back to variantKey for display (no longer show 全部平台)
      variantKey: 'ig',
      rating: 5,
      notes: null as string | null,
      favoriteReason: null as string | null,
      reasonTags: ['hook'] as string[],
      savedAt: '2026-07-14T10:00:00Z',
      brandName: '港饮',
      productName: null as string | null,
      copyType: 'spoken',
      platform: 'all',
      publishPlatform: null as string | null,
    }, {
      id: 'favorite-missing',
      ownerDisplayName: '用户 def',
      userEmail: 'def@example.com',
      variantKey: 'standardHK',
      rating: null as number | null,
      notes: null as string | null,
      favoriteReason: null as string | null,
      reasonTags: [] as string[],
      savedAt: '2026-07-14T11:00:00Z',
      brandName: null as string | null,
      productName: null as string | null,
      copyType: null as string | null,
      platform: null as string | null,
      publishPlatform: null as string | null,
    }],
    total: 2,
  }),
  getAdminFavoriteDetail: vi.fn().mockResolvedValue({
    id: 'favorite-spoken',
    ownerDisplayName: '用户 abc',
    userEmail: 'user@example.com',
    variantKey: 'ig',
    content: `${'很长的收藏正文段落。'.repeat(80)}\n末尾可见性测试`,
    rating: 5,
    notes: '备注',
    favoriteReason: '原因',
    reasonTags: ['hook'],
    savedAt: '2026-07-14T10:00:00Z',
    brandName: '港饮',
    productName: null as string | null,
    copyType: 'spoken',
    platform: 'all',
    publishPlatform: null as string | null,
  }),
  getAdminCaseLibraryDetail: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/api', () => mockApi);

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  mockApi.checkAdminAccess.mockResolvedValue(true);
  mockApi.getAdminStats.mockResolvedValue({
    totalUsers: 1,
    activeSubscriptions: 0,
    totalGenerations: 0,
    totalFeedback: 0,
    adminUsers: 1,
    role: 'admin',
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('管理员收藏详情弹窗布局', () => {
  it('长正文可拉伸和滚动，关闭与复制固定可见，摘要在正文前', async () => {
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('用户收藏')).toBeInTheDocument());
    fireEvent.click(screen.getByText('用户收藏'));
    await waitFor(() => expect(screen.getAllByRole('button', { name: '查看收藏详情' }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole('button', { name: '查看收藏详情' })[0]!);

    await waitFor(() => expect(screen.getByTestId('favorite-review-dialog')).toBeInTheDocument());
    const dialog = screen.getByTestId('favorite-review-dialog');
    const className = dialog.className;
    expect(className).toMatch(/max-h-/);
    expect(className).toMatch(/flex/);
    expect(className).toMatch(/flex-col/);
    expect(className).toMatch(/overflow-hidden/);

    expect(screen.getByRole('button', { name: '关闭收藏详情' })).toBeInTheDocument();
    const footer = screen.getByTestId('favorite-review-footer');
    expect(within(footer).getByRole('button', { name: '复制文案' })).toBeInTheDocument();

    const summary = screen.getByTestId('favorite-review-summary');
    const body = screen.getByTestId('favorite-review-body');
    const contentRegion = screen.getByTestId('favorite-review-content-region');
    expect(summary.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(contentRegion.className).toMatch(/overflow-y-auto/);
    expect(body.className).toMatch(/overflow-y-auto|overflow-auto/);
    expect(body.className).toMatch(/resize-y/);
    expect(body.className).toMatch(/min-h-/);

    fireEvent.click(within(footer).getByRole('button', { name: '复制文案' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('很长的收藏正文段落'),
    );
    expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(
      expect.stringContaining('user@example.com'),
    );
  });
});

describe('管理员中文可读标签', () => {
  it('列表与详情将 spoken 映射口播稿；platform=all 回退 variantKey；标签中文', async () => {
    const { default: AdminPage } = await import('../pages/AdminPage');
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByText('用户收藏')).toBeInTheDocument());
    fireEvent.click(screen.getByText('用户收藏'));
    await waitFor(() => expect(screen.getByText('口播稿')).toBeInTheDocument());
    // platform=all + variantKey=ig → IG（不再默认全部平台）
    expect(screen.getByText('IG')).toBeInTheDocument();
    expect(screen.queryByText('全部平台')).not.toBeInTheDocument();
    expect(screen.queryByText('spoken')).not.toBeInTheDocument();
    expect(screen.queryByText(/^all$/)).not.toBeInTheDocument();
    expect(screen.getByText(/开场吸睛/)).toBeInTheDocument();
    expect(screen.queryByText(/\bhook\b/)).not.toBeInTheDocument();

    // missing platform falls back to variantKey mapping → 标准繁中
    expect(screen.getByText('标准繁中')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '查看收藏详情' })[0]!);
    await waitFor(() => expect(screen.getByTestId('favorite-review-summary')).toBeInTheDocument());
    const summary = screen.getByTestId('favorite-review-summary');
    expect(summary).toHaveTextContent('口播稿');
    expect(summary).toHaveTextContent('IG');
    expect(summary).toHaveTextContent('开场吸睛');
    expect(summary).toHaveTextContent('未填写');
    expect(summary).not.toHaveTextContent('spoken');
    expect(summary).not.toHaveTextContent('hook');
    expect(summary.textContent).not.toMatch(/\ball\b/);
  });
});

function ConfigDateHarness() {
  const { state, dispatch } = useContext(AppContext);
  return (
    <div>
      <span data-testid="saved-target-date">{state.savedConfigs[0]?.targetDate ?? ''}</span>
      <span data-testid="saved-calendar-ids">
        {(state.savedConfigs[0]?.selectedCalendarEventIds ?? []).join(',')}
      </span>
      <span data-testid="active-target-date">{state.settings.targetDate ?? ''}</span>
      <span data-testid="active-calendar-ids">
        {(state.settings.selectedCalendarEventIds ?? []).join(',')}
      </span>
      <span data-testid="structured">{String(state.settings.structuredBriefEnabled)}</span>
      <span data-testid="creativity">{state.settings.creativityLevel}</span>
      <span data-testid="cantonese">{state.settings.cantoneseLevel}</span>
      <span data-testid="english">{state.settings.englishMixingLevel}</span>
      <span data-testid="personas">{state.settings.consumerPersonas.length}</span>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: 'SET_TARGET_DATE', payload: '2026-01-15' });
          dispatch({ type: 'SET_SELECTED_CALENDAR_EVENTS', payload: ['evt-a', 'evt-b'] });
        }}
      >
        set-date-calendar
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch({ type: 'SET_TARGET_DATE', payload: '2026-03-20' });
        }}
      >
        change-date-only
      </button>
      <button
        type="button"
        onClick={() => {
          dispatch({
            type: 'LOAD_CONFIG',
            payload: {
              id: 'legacy-cfg',
              name: '旧配置',
              brandName: '旧品牌',
              productName: '',
              brandRedLines: '',
              structuredBriefEnabled: true,
              creativityLevel: 3,
              cantoneseLevel: 2,
              englishMixingLevel: 3,
              tone: '穩妥',
              platform: 'ig',
              inputLanguage: 'mandarin',
              consumerPersonas: [],
              createdAt: '2026-01-01T00:00:00.000Z',
              // no targetDate / selectedCalendarEventIds
            },
          });
        }}
      >
        load-legacy
      </button>
      <button type="button" onClick={() => dispatch({ type: 'RESTORE_DEFAULT_GENERATION_SETTINGS' })}>
        restore-defaults
      </button>
      <ConfigManager />
    </div>
  );
}

describe('配置保存与日期恢复', () => {
  const ownerId = 'admin-config-ui-user';

  it('saveConfig 写入 targetDate 与 selectedCalendarEventIds，并纳入未储存判断；LOAD 可恢复', async () => {
    render(
      <AppProvider ownerId={ownerId}>
        <ConfigDateHarness />
      </AppProvider>,
    );

    fireEvent.click(screen.getByText('set-date-calendar'));
    expect(screen.getByText('未储存')).toBeInTheDocument();

    fireEvent.click(screen.getByText('+ 储存当前配置'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '含日期配置' } });
    fireEvent.click(screen.getByText('储存'));

    expect(screen.getByTestId('saved-target-date')).toHaveTextContent('2026-01-15');
    expect(screen.getByTestId('saved-calendar-ids')).toHaveTextContent('evt-a,evt-b');
    expect(screen.queryByText('未储存')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('change-date-only'));
    expect(screen.getByText('未储存')).toBeInTheDocument();

    // reload from saved config name
    fireEvent.click(screen.getByText('含日期配置'));
    expect(screen.getByTestId('active-target-date')).toHaveTextContent('2026-01-15');
    expect(screen.getByTestId('active-calendar-ids')).toHaveTextContent('evt-a,evt-b');
  });

  it('旧配置缺字段时恢复为当前默认日期与空日历；复原默认使用香港自然日并清空日历', () => {
    const fixedNow = new Date('2026-07-14T16:30:00.000Z'); // HK = 2026-07-15 00:30
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(fixedNow);
    const hkToday = getHongKongDateString(fixedNow);
    expect(hkToday).toBe('2026-07-15');

    try {
      render(
        <AppProvider ownerId={`${ownerId}-restore`}>
          <ConfigDateHarness />
        </AppProvider>,
      );

      fireEvent.click(screen.getByText('set-date-calendar'));
      fireEvent.click(screen.getByText('load-legacy'));
      expect(screen.getByTestId('active-target-date')).toHaveTextContent(hkToday);
      expect(screen.getByTestId('active-calendar-ids')).toHaveTextContent('');

      fireEvent.click(screen.getByText('set-date-calendar'));
      fireEvent.click(screen.getByText('restore-defaults'));
      expect(screen.getByTestId('active-target-date')).toHaveTextContent(hkToday);
      expect(screen.getByTestId('active-calendar-ids')).toHaveTextContent('');
      expect(screen.getByTestId('structured')).toHaveTextContent('false');
      expect(screen.getByTestId('creativity')).toHaveTextContent('1');
      expect(screen.getByTestId('cantonese')).toHaveTextContent('4');
      expect(screen.getByTestId('english')).toHaveTextContent('1');
      expect(screen.getByTestId('personas')).toHaveTextContent('0');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('左侧输入标签 emoji', () => {
  it('主要模块标签带指定 emoji，且不引入 Accordion/details', () => {
    const ownerId = 'emoji-label-user';
    const { container } = render(
      <AppProvider ownerId={ownerId}>
        <CopyTypeSelector />
        <PlatformSelector />
        <ToneSelector />
        <TargetDatePicker />
      </AppProvider>,
    );

    expect(screen.getByText(/📝\s*文案类型/)).toBeInTheDocument();
    expect(screen.getByText(/📱\s*目标平台/)).toBeInTheDocument();
    expect(screen.getByText(/🎭\s*主语气/)).toBeInTheDocument();
    expect(screen.getByText(/🗓️\s*发布日期|🗓️\s*目标发布时间/)).toBeInTheDocument();

    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('[data-accordion]')).toBeNull();
    expect(container.textContent).not.toMatch(/Accordion|CollapsibleSection/);
  });
});
