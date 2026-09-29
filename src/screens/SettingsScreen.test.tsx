import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsScreen } from './SettingsScreen';

describe('SettingsScreen', () => {
  it('switches the theme to dark', async () => {
    const setTheme = vi.fn();
    render(<SettingsScreen theme="light" setTheme={setTheme} />);
    await userEvent.click(screen.getByRole('button', { name: /^dark$/i }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('switches the theme to light', async () => {
    const setTheme = vi.fn();
    render(<SettingsScreen theme="dark" setTheme={setTheme} />);
    await userEvent.click(screen.getByRole('button', { name: /^light$/i }));
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
