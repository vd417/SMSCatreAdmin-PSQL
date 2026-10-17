import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientsScreen } from './ClientsScreen';

// The per-row action menu uses real mutation hooks, so provide a QueryClient.
const renderScreen = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ClientsScreen />
    </QueryClientProvider>,
  );

vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }));
vi.mock('../api/hooks/useClients', () => ({
  useClients: () => ({
    isLoading: false, isError: false,
    data: { pages: [{ data: [
      { id: 'c1', name: 'Greenwood High', status: 'active', tier: 'gold', plan_name: 'Gold', mrr: 50000,
        last_active_days: 1, contact_email: 'owner@school.com', contact_name: 'Anita', slug: 'greenwood',
        limits: { students: 100 }, students_count: 10, created: '2026-01-01' },
      { id: 'c2', name: 'Greenwood East', status: 'trial', tier: 'silver', plan_name: 'Silver', mrr: 0,
        last_active_days: 2, contact_email: 'owner@school.com', contact_name: 'Anita', slug: 'greenwood-east',
        limits: { students: 100 }, students_count: 0, created: '2026-02-01' },
    ], next_cursor: null }] },
    hasNextPage: false, fetchNextPage: vi.fn(), isFetchingNextPage: false,
  }),
}));

describe('ClientsScreen', () => {
  it('shows one client row per owner, not each school', () => {
    renderScreen();
    expect(screen.getByText('Anita')).toBeInTheDocument();
    expect(screen.getByText('owner@school.com')).toBeInTheDocument();
    expect(screen.queryByText('Greenwood High')).not.toBeInTheDocument();
    expect(screen.getByText(/1 client · 2 schools/)).toBeInTheDocument();
  });

  it('expands owner click to list schools with details', () => {
    renderScreen();
    fireEvent.click(screen.getByText('Anita'));
    expect(screen.getByText('Schools under this owner')).toBeInTheDocument();
    expect(screen.getByText('Greenwood High')).toBeInTheDocument();
    expect(screen.getByText('Greenwood East')).toBeInTheDocument();
  });
});
