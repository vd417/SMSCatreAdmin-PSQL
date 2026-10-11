import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandSearch, type CommandItem } from './CommandSearch';

const items: CommandItem[] = [
  { key: 'dashboard', label: 'Dashboard', route: 'dashboard', group: 'Overview' },
  { key: 'clients', label: 'Clients', route: 'clients', group: 'Clients' },
  { key: 'billing', label: 'Billing', route: 'billing', group: 'Revenue' },
];

describe('CommandSearch', () => {
  it('filters pages as you type', async () => {
    const user = userEvent.setup();
    render(<CommandSearch items={items} onNavigate={() => {}} />);
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'bill');
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).toBeNull();
  });

  it('navigates on Enter to the highlighted result', async () => {
    const user = userEvent.setup();
    const onNav = vi.fn();
    render(<CommandSearch items={items} onNavigate={onNav} />);
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'client');
    await user.keyboard('{Enter}');
    expect(onNav).toHaveBeenCalledWith('clients');
  });

  it('navigates on click', async () => {
    const user = userEvent.setup();
    const onNav = vi.fn();
    render(<CommandSearch items={items} onNavigate={onNav} />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: /Billing/ }));
    expect(onNav).toHaveBeenCalledWith('billing');
  });

  it('focuses the input on ⌘K', () => {
    render(<CommandSearch items={items} onNavigate={() => {}} />);
    const input = screen.getByRole('combobox');
    expect(input).not.toHaveFocus();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(input).toHaveFocus();
  });

  it('clears and closes on Escape', async () => {
    const user = userEvent.setup();
    render(<CommandSearch items={items} onNavigate={() => {}} />);
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'bill');
    await user.keyboard('{Escape}');
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('shows an empty state when nothing matches', async () => {
    const user = userEvent.setup();
    render(<CommandSearch items={items} onNavigate={() => {}} />);
    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), 'zzzz');
    expect(screen.getByText('No pages found')).toBeInTheDocument();
  });
});
