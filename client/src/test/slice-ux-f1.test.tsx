/**
 * Slice UX-F1: Generation Progress + Header Menu — behavior tests (TDD)
 *
 * Tests written FIRST, expected to fail until implementation completes.
 *
 * Coverage:
 * - GenerationProgress component (4 stages, status icons, estimated labels)
 * - HeaderMenu component (open/close, keyboard, Escape, click-outside, accessibility)
 * - Header refactoring (high-frequency visible, low-frequency in menu)
 * - Reference case selector always visible (regression guard)
 * - Progress stages: reducer actions wired correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';
import { AppProvider } from '../context/AppContext';
import ReferenceCaseSelector from '../components/input/ReferenceCaseSelector';
import type { BookmarkedCopy } from '../types';

// ============================================================
// Local type definitions for the new UX-F1 types (will be added to types/index.ts)
// ============================================================

export type GenerationStage = 'diagnosis' | 'generation' | 'audit' | 'feedback';

export interface StageProgress {
  stage: GenerationStage;
  label: string;
  status: 'pending' | 'active' | 'done' | 'failed';
}

export interface GenerationProgress {
  stages: StageProgress[];
  startedAt: number;
  isEstimated: true;
}

const STAGE_LABELS: Record<GenerationStage, string> = {
  diagnosis: '诊断原文',
  generation: '生成变体',
  audit: '质量审核',
  feedback: '消费者反馈',
};

const STAGE_ORDER: GenerationStage[] = ['diagnosis', 'generation', 'audit', 'feedback'];

// ============================================================
// Helpers
// ============================================================

const OWNER_ID = 'ux-f1-test-user';

function AppWrapper({ children }: { children: ReactNode }) {
  return <AppProvider ownerId={OWNER_ID}>{children}</AppProvider>;
}

function makeBookmark(overrides: Partial<BookmarkedCopy> = {}): BookmarkedCopy {
  return {
    id: overrides.id ?? 'bm-ux-f1-1',
    savedAt: new Date().toISOString(),
    variantKey: 'ig',
    content: '返工赶时间，都想件装备够轻、够耐用。',
    source: '新品上线，适合通勤。',
    rating: 5,
    reasonTags: ['hook', 'tone'],
    favoriteReason: '开头节奏好',
    settings: {
      platform: 'ig',
      tone: '活潑',
      cantoneseLevel: 4,
      englishMixingLevel: 1,
      creativityLevel: 1,
      inputLanguage: 'mandarin',
      brandName: '',
      productName: '',
      brandRedLines: '',
      structuredBriefEnabled: false,
      consumerPersonas: [],
      competitorQueries: [],
      selectedReferenceCaseIds: [],
      selectedCalendarEventIds: [],
    },
    ...overrides,
  };
}

function makeProgress(overrides: Partial<StageProgress>[] = []): GenerationProgress {
  const stages: StageProgress[] = STAGE_ORDER.map((stage, i) => ({
    stage,
    label: STAGE_LABELS[stage],
    status: (overrides[i]?.status ?? 'pending') as StageProgress['status'],
  }));
  return { stages, startedAt: Date.now(), isEstimated: true };
}

beforeEach(() => {
  localStorage.clear();
});

// ============================================================
// 1. GENERATION PROGRESS — Component Rendering
// ============================================================

describe('GenerationProgress Component', () => {
  it('renders all 4 stages with estimated labels', async () => {
    // Dynamic import — will throw ModuleNotFound until component exists
    const mod = await import('../components/results/GenerationProgress');
    const GenerationProgress = mod.default;

    const progress = makeProgress();
    render(<GenerationProgress progress={progress} />, { wrapper: AppWrapper });

    // All 4 stage labels visible
    expect(screen.getByText('诊断原文')).toBeInTheDocument();
    expect(screen.getByText('生成变体')).toBeInTheDocument();
    expect(screen.getByText('质量审核')).toBeInTheDocument();
    expect(screen.getByText('消费者反馈')).toBeInTheDocument();

    // Estimated indicator
    expect(screen.getByText(/预估/)).toBeInTheDocument();
  });

  it('shows distinct visual states for pending, active, done, and failed', async () => {
    const mod = await import('../components/results/GenerationProgress');
    const GenerationProgress = mod.default;

    const progress: GenerationProgress = {
      stages: [
        { stage: 'diagnosis', label: '诊断原文', status: 'done' },
        { stage: 'generation', label: '生成变体', status: 'active' },
        { stage: 'audit', label: '质量审核', status: 'failed' },
        { stage: 'feedback', label: '消费者反馈', status: 'pending' },
      ],
      startedAt: Date.now(),
      isEstimated: true,
    };

    const { container } = render(
      <GenerationProgress progress={progress} />,
      { wrapper: AppWrapper },
    );

    // Done stage: should have a check icon or visual indicator
    const doneIndicator = container.querySelector('[data-stage-status="done"]');
    expect(doneIndicator).not.toBeNull();

    // Active stage: should have animated/spinner indicator
    const activeIndicator = container.querySelector('[data-stage-status="active"]');
    expect(activeIndicator).not.toBeNull();

    // Failed stage: should have error indicator
    const failedIndicator = container.querySelector('[data-stage-status="failed"]');
    expect(failedIndicator).not.toBeNull();

    // Pending stage: muted appearance
    const pendingIndicator = container.querySelector('[data-stage-status="pending"]');
    expect(pendingIndicator).not.toBeNull();
  });

  it('applies design system colors: dark=emerald, light=orange', async () => {
    const mod = await import('../components/results/GenerationProgress');
    const GenerationProgress = mod.default;

    const progress = makeProgress([{ status: 'active' }]);
    const { container } = render(
      <GenerationProgress progress={progress} />,
      { wrapper: AppWrapper },
    );

    const html = container.innerHTML;
    // Active element must have either emerald (dark mode) or orange (light mode) classes
    const hasDesignColor = html.includes('emerald') || html.includes('orange');
    expect(hasDesignColor).toBe(true);
  });

  it('shows the "预估" marker to indicate simulated timing', async () => {
    const mod = await import('../components/results/GenerationProgress');
    const GenerationProgress = mod.default;

    const progress = makeProgress();
    render(<GenerationProgress progress={progress} />, { wrapper: AppWrapper });

    // The 预估 marker distinguishes this from real SSE progress
    const estimated = screen.getByText(/预估/);
    expect(estimated).toBeInTheDocument();
    // Should be visually subtle
    expect(estimated.className).toMatch(/text-\[10px\]|text-xs/);
  });
});

// ============================================================
// 2. HEADER MENU — Dropdown Behavior
// ============================================================

describe('HeaderMenu Component', () => {
  it('renders a trigger button with aria attributes', async () => {
    const mod = await import('../components/layout/HeaderMenu');
    const HeaderMenu = mod.default;

    render(
      <HeaderMenu userEmail="test@example.com" onLogout={vi.fn()} />,
      { wrapper: AppWrapper },
    );

    const trigger = screen.getByRole('button');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'true');
  });

  it('opens dropdown on click and shows all menu items', async () => {
    const mod = await import('../components/layout/HeaderMenu');
    const HeaderMenu = mod.default;

    render(
      <HeaderMenu userEmail="test@example.com" onLogout={vi.fn()} />,
      { wrapper: AppWrapper },
    );

    const trigger = screen.getByRole('button');
    await userEvent.click(trigger);

    // aria-expanded updates
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // All expected menu items
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText(/官网/)).toBeInTheDocument();
    expect(screen.getByText(/复原创作配置/)).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /套餐与结算/ })).toHaveAttribute('href', '/app/billing');
    expect(screen.getByText(/切换.*模式/)).toBeInTheDocument();
    expect(screen.getByText(/退出登录/)).toBeInTheDocument();
  });

  it('closes on Escape key press', async () => {
    const mod = await import('../components/layout/HeaderMenu');
    const HeaderMenu = mod.default;

    render(
      <HeaderMenu userEmail="test@example.com" onLogout={vi.fn()} />,
      { wrapper: AppWrapper },
    );

    const trigger = screen.getByRole('button');
    await userEvent.click(trigger);
    expect(screen.getByText(/退出登录/)).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByText(/退出登录/)).not.toBeInTheDocument();
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on click outside', async () => {
    const mod = await import('../components/layout/HeaderMenu');
    const HeaderMenu = mod.default;

    render(
      <div>
        <div data-testid="outside">Outside</div>
        <HeaderMenu userEmail="test@example.com" onLogout={vi.fn()} />
      </div>,
      { wrapper: AppWrapper },
    );

    const trigger = screen.getByRole('button');
    await userEvent.click(trigger);
    expect(screen.getByText(/退出登录/)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('outside'));

    await waitFor(() => {
      expect(screen.queryByText(/退出登录/)).not.toBeInTheDocument();
    });
  });

  it('calls onLogout when 退出登录 is clicked', async () => {
    const mod = await import('../components/layout/HeaderMenu');
    const HeaderMenu = mod.default;
    const onLogout = vi.fn();

    render(
      <HeaderMenu userEmail="test@example.com" onLogout={onLogout} />,
      { wrapper: AppWrapper },
    );

    const trigger = screen.getByRole('button');
    await userEvent.click(trigger);

    // Click the logout item
    await userEvent.click(screen.getByText(/退出登录/));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('closes menu when a non-logout item is clicked', async () => {
    const mod = await import('../components/layout/HeaderMenu');
    const HeaderMenu = mod.default;

    render(
      <HeaderMenu userEmail="test@example.com" onLogout={vi.fn()} />,
      { wrapper: AppWrapper },
    );

    const trigger = screen.getByRole('button');
    await userEvent.click(trigger);

    // Click 复原创作配置
    await userEvent.click(screen.getByText(/复原创作配置/));

    await waitFor(() => {
      expect(screen.queryByText(/退出登录/)).not.toBeInTheDocument();
    });
  });

  it('has proper focus management: trigger button is focusable', async () => {
    const mod = await import('../components/layout/HeaderMenu');
    const HeaderMenu = mod.default;

    render(
      <HeaderMenu userEmail="test@example.com" onLogout={vi.fn()} />,
      { wrapper: AppWrapper },
    );

    const trigger = screen.getByRole('button');
    expect(document.activeElement).not.toBe(trigger);

    trigger.focus();
    expect(document.activeElement).toBe(trigger);
  });
});

// ============================================================
// 3. HEADER REFACTORING — Layout Verification
// ============================================================

describe('Header Refactoring', () => {
  it('high-frequency items remain visible: 历史, 收藏库, engine status', async () => {
    // The Header component will be refactored to use HeaderMenu
    // We test by verifying the header structure
    const mod = await import('../components/layout/Header');
    const Header = mod.default;

    render(
      <Header onLogout={vi.fn()} userEmail="user@example.com" />,
      { wrapper: AppWrapper },
    );

    // High-frequency items directly visible (not in menu)
    expect(screen.getByText(/历史/)).toBeInTheDocument();
    expect(screen.getByText(/收藏库/)).toBeInTheDocument();

    // Engine status visible
    expect(screen.getByText(/待命/)).toBeInTheDocument();

    // The trigger for the menu should be visible
    const menuTrigger = screen.getByRole('button', { name: /账户|更多|菜单|menu|user/i });
    expect(menuTrigger).toBeInTheDocument();
  });

  it('uses the shared 77 brand image in the workbench header', async () => {
    const { default: Header } = await import('../components/layout/Header');
    render(<Header />, { wrapper: AppWrapper });

    const homeLink = screen.getByRole('link', { name: '返回官网首页' });
    expect(homeLink.querySelector('img')).toHaveAttribute('src', '/brand/77-logo.png');
  });

  it('uses the shared 77 brand image on the marketing header', async () => {
    const { default: MarketingPage } = await import('../components/marketing/MarketingPage');
    render(<MarketingPage />);

    const homeLink = screen.getByRole('link', { name: '77港话通社媒文案器首页' });
    expect(homeLink.querySelector('img')).toHaveAttribute('src', '/brand/77-logo.png');
  });

  it('low-frequency items (官网 nav, 复原配置, 主题 toggle) are in menu, not header row', async () => {
    const mod = await import('../components/layout/Header');
    const Header = mod.default;

    render(
      <Header onLogout={vi.fn()} userEmail="user@example.com" />,
      { wrapper: AppWrapper },
    );

    // The "官网" text-link (previously a separate nav item) should not be visible
    // The logo icon link with aria-label="返回官网首页" is fine — that's the branding logo
    const homeTextLinks = screen.queryAllByText('官网');
    // "官网" text that was a separate nav item should be gone
    // (the logo doesn't contain the text "官网", just the icon)
    expect(homeTextLinks).toHaveLength(0);

    // "复原配置" text button should not be directly visible in header
    expect(screen.queryByText('复原配置')).toBeNull();

    // Theme toggle icon (Sun/Moon) should not be directly visible
    // It's now inside the menu
    const themeButtons = screen.queryAllByTitle(/切换至/);
    expect(themeButtons).toHaveLength(0);
  });
});

// ============================================================
// 4. REFERENCE CASE SELECTOR — Always Visible (Regression Guard)
// ============================================================

describe('ReferenceCaseSelector — Always Visible', () => {
  it('shows collapsed entry when no rated bookmarks exist', async () => {
    render(<ReferenceCaseSelector />, { wrapper: AppWrapper });

    const toggle = screen.getByRole('button', { name: /参考收藏案例/ });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    // Expand and verify empty state message
    await userEvent.click(toggle);
    expect(screen.getByText(/收藏并评分.*4.*星/)).toBeInTheDocument();
  });

  it('shows entry when rated bookmarks exist', async () => {
    localStorage.setItem(
      `hk-cantonese-bookmarks:${OWNER_ID}`,
      JSON.stringify([makeBookmark()]),
    );
    render(<ReferenceCaseSelector />, { wrapper: AppWrapper });

    const toggle = screen.getByRole('button', { name: /参考收藏案例/ });
    expect(toggle).toBeInTheDocument();
  });

  it('shows entry when bookmarks exist but none rated >= 4', async () => {
    localStorage.setItem(
      `hk-cantonese-bookmarks:${OWNER_ID}`,
      JSON.stringify([makeBookmark({ rating: 2, id: 'bm-low' })]),
    );
    render(<ReferenceCaseSelector />, { wrapper: AppWrapper });

    const toggle = screen.getByRole('button', { name: /参考收藏案例/ });
    expect(toggle).toBeInTheDocument();
  });
});
