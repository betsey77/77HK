import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThreePanel from '../components/layout/ThreePanel';

/** True only for standalone Tailwind `hidden`, not `overflow-hidden`. */
function hasHiddenClass(el: HTMLElement): boolean {
  return el.classList.contains('hidden');
}

describe('ThreePanel mobile segment switcher', () => {
  function renderPanels() {
    return render(
      <ThreePanel
        left={<div data-testid="probe-left">LEFT_PANEL_CONTENT</div>}
        center={<div data-testid="probe-center">CENTER_PANEL_CONTENT</div>}
        right={<div data-testid="probe-right">RIGHT_PANEL_CONTENT</div>}
      />,
    );
  }

  it('defaults to 输入 tab selected with ARIA wiring', () => {
    renderPanels();

    const tablist = screen.getByTestId('workbench-mobile-tablist');
    expect(tablist).toHaveAttribute('role', 'tablist');

    const inputTab = screen.getByTestId('workbench-tab-input');
    const resultsTab = screen.getByTestId('workbench-tab-results');
    const auditTab = screen.getByTestId('workbench-tab-audit');

    expect(inputTab).toHaveAttribute('role', 'tab');
    expect(inputTab).toHaveAttribute('aria-selected', 'true');
    expect(inputTab).toHaveAttribute('aria-controls', 'workbench-panel-input');
    expect(resultsTab).toHaveAttribute('aria-selected', 'false');
    expect(auditTab).toHaveAttribute('aria-selected', 'false');

    expect(screen.getByTestId('workbench-panel-input')).toHaveAttribute(
      'aria-labelledby',
      'workbench-tab-input',
    );
    expect(screen.getByTestId('workbench-panel-results')).toHaveAttribute(
      'aria-labelledby',
      'workbench-tab-results',
    );
    expect(screen.getByTestId('workbench-panel-audit')).toHaveAttribute(
      'aria-labelledby',
      'workbench-tab-audit',
    );

    // Active panel visible (no standalone `hidden` class)
    expect(hasHiddenClass(screen.getByTestId('workbench-panel-input'))).toBe(false);
    expect(hasHiddenClass(screen.getByTestId('workbench-panel-results'))).toBe(true);
    expect(hasHiddenClass(screen.getByTestId('workbench-panel-audit'))).toBe(true);
  });

  it('switches panels on tab click without unmounting any panel content', async () => {
    const user = userEvent.setup();
    renderPanels();

    // All three contents always mounted (not deleted / not conditional-rendered away)
    expect(screen.getByTestId('probe-left')).toHaveTextContent('LEFT_PANEL_CONTENT');
    expect(screen.getByTestId('probe-center')).toHaveTextContent('CENTER_PANEL_CONTENT');
    expect(screen.getByTestId('probe-right')).toHaveTextContent('RIGHT_PANEL_CONTENT');

    await user.click(screen.getByRole('tab', { name: /文案/ }));

    expect(screen.getByTestId('workbench-tab-results')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('workbench-tab-input')).toHaveAttribute('aria-selected', 'false');
    expect(hasHiddenClass(screen.getByTestId('workbench-panel-results'))).toBe(false);
    expect(hasHiddenClass(screen.getByTestId('workbench-panel-input'))).toBe(true);
    expect(hasHiddenClass(screen.getByTestId('workbench-panel-audit'))).toBe(true);

    // Still all present after switch
    expect(screen.getByTestId('probe-left')).toBeInTheDocument();
    expect(screen.getByTestId('probe-center')).toBeInTheDocument();
    expect(screen.getByTestId('probe-right')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /审核/ }));

    expect(screen.getByTestId('workbench-tab-audit')).toHaveAttribute('aria-selected', 'true');
    expect(hasHiddenClass(screen.getByTestId('workbench-panel-audit'))).toBe(false);
    expect(hasHiddenClass(screen.getByTestId('workbench-panel-input'))).toBe(true);
    expect(hasHiddenClass(screen.getByTestId('workbench-panel-results'))).toBe(true);

    // Content nodes still exist inside their panels
    expect(
      within(screen.getByTestId('workbench-panel-input')).getByTestId('probe-left'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('workbench-panel-results')).getByTestId('probe-center'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('workbench-panel-audit')).getByTestId('probe-right'),
    ).toBeInTheDocument();
  });
});
