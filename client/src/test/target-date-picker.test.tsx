import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import TargetDatePicker from '../components/input/TargetDatePicker';
import { AppProvider } from '../context/AppContext';

describe('TargetDatePicker', () => {
  it('keeps the native date input over the visible field so the picker anchors locally', () => {
    render(
      <AppProvider ownerId="target-date-picker-test">
        <TargetDatePicker />
      </AppProvider>,
    );

    const input = screen.getByLabelText('发布日期');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).not.toHaveAttribute('aria-hidden', 'true');
    expect(input).not.toHaveClass('sr-only');
    expect(input).toHaveClass('absolute', 'inset-0', 'w-full', 'h-full', 'opacity-0');
    expect(input.parentElement).toHaveClass('relative');

    fireEvent.change(input, { target: { value: '2026-08-08' } });
    expect(screen.getByText('2026年8月8日')).toBeInTheDocument();
  });
});
