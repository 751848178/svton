import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsSwitch } from '../src/components/settings/SettingsSwitch';

describe('SettingsSwitch', () => {
  it('keeps its accessible name stable while exposing a high-contrast checked state', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    const { rerender } = render(<SettingsSwitch checked={false} onCheckedChange={onCheckedChange} label="Browser access" />);
    const control = screen.getByRole('switch', { name: 'Browser access' });
    expect(control).toHaveAttribute('aria-checked', 'false');
    expect(control.firstElementChild).toHaveClass('border-input', 'bg-muted');
    await user.click(control);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    rerender(<SettingsSwitch checked onCheckedChange={onCheckedChange} label="Browser access" />);
    expect(screen.getByRole('switch', { name: 'Browser access' })).toHaveAttribute('aria-checked', 'true');
    expect(control.firstElementChild).toHaveClass('border-status-info', 'bg-status-info');
  });
});
