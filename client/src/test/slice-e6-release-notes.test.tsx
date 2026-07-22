import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AppProvider } from '../context/AppContext';
import HeaderMenu from '../components/layout/HeaderMenu';
import Footer from '../components/layout/Footer';
import {
  RELEASE_NOTES,
  RELEASE_NOTES_EMPTY_COPY,
  getDeployedReleaseNotes,
  type ReleaseNote,
} from '../constants/releaseNotes';

vi.mock('../services/api', () => ({
  checkAdminAccess: vi.fn().mockResolvedValue(false),
  getAdminPendingReviewSummary: vi.fn().mockResolvedValue({ count: 0, latestRequestedAt: null }),
}));

describe('E6 release notes static data', () => {
  it('only returns deployed notes and sorts newest first', () => {
    const fixture: ReleaseNote[] = [
      {
        version: '1.0.0',
        status: 'deployed',
        releasedAt: '2026-01-01',
        sections: [{ title: '功能', items: ['旧版'] }],
      },
      {
        version: '1.2.0',
        status: 'staging',
        releasedAt: '2026-06-01',
        sections: [{ title: '功能', items: ['不应展示'] }],
      },
      {
        version: '1.1.0',
        status: 'deployed',
        releasedAt: '2026-03-01',
        sections: [{ title: '功能', items: ['中间版'] }],
      },
      {
        version: '2.1',
        status: 'draft',
        releasedAt: null,
        sections: [{ title: '功能', items: ['未上线'] }],
      },
    ];
    const deployed = getDeployedReleaseNotes(fixture);
    expect(deployed.map((n) => n.version)).toEqual(['1.1.0', '1.0.0']);
    expect(deployed.every((n) => n.status === 'deployed')).toBe(true);
  });

  it('does not ship a deployed 2.1 entry in the static source', () => {
    expect(
      RELEASE_NOTES.some((n) => n.version === '2.1' && n.status === 'deployed'),
    ).toBe(false);
  });

  it('uses the approved empty-state copy', () => {
    expect(RELEASE_NOTES_EMPTY_COPY).toBe('2.1 更新将在正式上线后公布');
    expect(getDeployedReleaseNotes([])).toEqual([]);
  });
});

describe('E6 HeaderMenu release notes dialog', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('opens a non-navigating dialog, locks body scroll, supports Escape and empty state', async () => {
    render(
      <AppProvider ownerId="release-notes-user">
        <HeaderMenu userEmail="user@test.com" />
      </AppProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: '账户与更多选项' }));
    const menuItem = await screen.findByRole('menuitem', { name: '更新日志' });
    fireEvent.click(menuItem);

    const dialog = await screen.findByRole('dialog', { name: '更新日志' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(RELEASE_NOTES_EMPTY_COPY)).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    expect(window.location.pathname).not.toMatch(/release|changelog/i);

    // Internal scroll container contract for 390px
    expect(dialog.className).toMatch(/max-h-/);
    const scrollRegion = dialog.querySelector('[data-testid="release-notes-scroll"]');
    expect(scrollRegion?.className ?? '').toMatch(/overflow-y-auto/);

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '更新日志' })).toBeNull();
    });
    expect(document.body.style.overflow).toBe('');
  });

  it('does not reset workbench generation settings when opening release notes', async () => {
    const { container } = render(
      <AppProvider ownerId="release-notes-user">
        <HeaderMenu userEmail="user@test.com" />
        <span data-testid="settings-probe" />
      </AppProvider>,
    );

    // Touch local storage the way the app does for settings persistence.
    const before = window.localStorage.getItem('hk-cantonese-settings');
    fireEvent.click(screen.getByRole('button', { name: '账户与更多选项' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '更新日志' }));
    expect(await screen.findByRole('dialog', { name: '更新日志' })).toBeInTheDocument();
    expect(window.localStorage.getItem('hk-cantonese-settings')).toBe(before);
    expect(container.querySelector('[data-testid="settings-probe"]')).toBeInTheDocument();
  });
});

describe('E6 Footer version', () => {
  it('shows product version 2.1', () => {
    render(<Footer />);
    expect(screen.getByText('v2.1')).toBeInTheDocument();
  });
});
