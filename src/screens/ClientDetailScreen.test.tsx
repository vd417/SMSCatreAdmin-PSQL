import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClientDetailScreen } from './ClientDetailScreen';
import { NavCtx, ToastCtx } from '../components';

vi.mock('../api/hooks/useClient', () => ({
  useClient: () => ({ isLoading: false, isError: false,
    data: { id: 'c1', name: 'Greenwood High', status: 'active', plan_name: 'Gold', mrr: 50000,
      tier: 'gold', country: 'Mumbai, MH', contact: 'a@b.c', csm: 'Ravi', health_score: 88, plan_id: 'pl_gold',
      slug: 'greenwood', contact_name: 'Anita', contact_email: 'a@b.c', contact_phone: '9999999999',
      address: 'Andheri East', students_count: 400, staff_count: 30, storage_gb: 12,
      id_proof_type: 'pan', id_proof_url: 'data:application/pdf;base64,AAA',
      limits: { students: 1000, staff: 80, storage_gb: 50 }, created: '2026-01-01', gateway: 'razorpay' } }),
}));
vi.mock('../api/hooks/useClients', () => ({
  useClients: () => ({
    isLoading: false, isError: false,
    data: { pages: [{ data: [
      { id: 'c1', name: 'Greenwood High', status: 'active', plan_name: 'Gold', mrr: 50000, tier: 'gold',
        contact_email: 'a@b.c', slug: 'greenwood' },
      { id: 'c2', name: 'Greenwood East', status: 'trial', plan_name: 'Silver', mrr: 0, tier: 'silver',
        contact_email: 'a@b.c', slug: 'greenwood-east' },
    ], next_cursor: null }] },
  }),
  useClientUsage: () => ({ isLoading: false, isError: false, data: { students_count: 400, staff_count: 30, storage_gb: 12, limits: { students: 1000 }, usage_series: [1,2], usage_pct: 40 } }),
  useClientActivity: () => ({ isLoading: false, isError: false, data: { data: [], next_cursor: null } }),
}));
vi.mock('../api/hooks/useClientMutations', () => ({
  useSetClientStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useChangeClientPlan: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteClient: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../api/hooks/usePlans', () => ({ usePlans: () => ({ data: { data: [] } }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }));

describe('ClientDetailScreen', () => {
  it('renders the client name from detail data', () => {
    render(<NavCtx.Provider value={{ route: { name: 'client', params: { id: 'c1' } }, go: () => {} }}>
      <ToastCtx.Provider value={() => {}}><ClientDetailScreen /></ToastCtx.Provider></NavCtx.Provider>);
    expect(screen.getAllByText('Greenwood High').length).toBeGreaterThanOrEqual(1);
  });

  it('lists sibling schools that share the owner email', () => {
    render(<NavCtx.Provider value={{ route: { name: 'client', params: { id: 'c1' } }, go: () => {} }}>
      <ToastCtx.Provider value={() => {}}><ClientDetailScreen /></ToastCtx.Provider></NavCtx.Provider>);
    expect(screen.getByText('Schools under this owner')).toBeInTheDocument();
    expect(screen.getByText('Greenwood East')).toBeInTheDocument();
    expect(screen.getByText('2 schools')).toBeInTheDocument();
  });

  it('shows the ID proof with a view link when present', () => {
    render(<NavCtx.Provider value={{ route: { name: 'client', params: { id: 'c1' } }, go: () => {} }}>
      <ToastCtx.Provider value={() => {}}><ClientDetailScreen /></ToastCtx.Provider></NavCtx.Provider>);
    expect(screen.getByText('ID proof')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /view/i });
    expect(link).toHaveAttribute('href', 'data:application/pdf;base64,AAA');
  });

  it('renders client lifecycle actions for an active client', () => {
    render(<NavCtx.Provider value={{ route: { name: 'client', params: { id: 'c1' } }, go: () => {} }}>
      <ToastCtx.Provider value={() => {}}><ClientDetailScreen /></ToastCtx.Provider></NavCtx.Provider>);
    expect(screen.getByText('Hold school')).toBeInTheDocument();
  });
});
