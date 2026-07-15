import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MarketingPage from '../components/marketing/MarketingPage';
import { PLATFORMS, VARIANT_TABS } from '../constants';
import { formatAdminPlatform } from '../utils/adminDisplayLabels';
import { publishPlatformLabel } from '../utils/publishPlatform';

describe('Shorts/TK user-visible labels', () => {
  it('keeps the internal shorts key while exposing Shorts/TK in shared labels', () => {
    expect(PLATFORMS.find((item) => item.value === 'shorts')).toEqual({
      value: 'shorts',
      label: 'Shorts/TK',
    });
    expect(VARIANT_TABS.find((item) => item.key === 'shorts')).toEqual({
      key: 'shorts',
      label: 'Shorts/TK',
    });
    expect(formatAdminPlatform('shorts')).toBe('Shorts/TK');
    expect(publishPlatformLabel('shorts')).toBe('Shorts/TK');
  });

  it('uses Shorts/TK on the public website', () => {
    render(<MarketingPage />);

    expect(screen.getAllByText('Shorts/TK').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/IG \/ FB \/ Shorts\/TK/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Facebook、Shorts\/TK/).length).toBeGreaterThan(0);
  });
});
