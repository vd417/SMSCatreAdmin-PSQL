import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ClientActions } from './ClientActions';
import { ToastCtx } from './index';
import type { Client } from '../api/types';

vi.mock('../api/hooks/useClientMutations', () => ({
  useSetClientStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useChangeClientPlan: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteClient: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('../api/hooks/usePlans', () => ({ usePlans: () => ({ data: { data: [] } }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }));

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastCtx.Provider value={() => {}}>{ui}</ToastCtx.Provider>);
}

describe('ClientActions', () => {
  it('shows delete for empty schools (no students/staff)', () => {
    const empty = { id: 'c1', status: 'trial', plan_id: 'pl_gold', name: 'Empty', students_count: 0, staff_count: 0 } as Client;
    renderWithToast(<ClientActions client={empty} />);
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides delete when school has students or staff', () => {
    const filled = { id: 'c1', status: 'active', plan_id: 'pl_gold', name: 'Greenwood', students_count: 12, staff_count: 0 } as Client;
    renderWithToast(<ClientActions client={filled} />);
    expect(screen.getByText('Hold school')).toBeInTheDocument();
    expect(screen.getByText('Deactivate')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    expect(screen.queryByText('Impersonate')).not.toBeInTheDocument();
  });

  it('hides actions the role cannot perform', async () => {
    vi.resetModules();
    vi.doMock('../auth/AuthContext', () => ({ useAuth: () => ({ can: (p: string) => p !== 'clients.hold' }) }));
    vi.doMock('../api/hooks/useClientMutations', () => ({
      useSetClientStatus: () => ({ mutate: vi.fn(), isPending: false }),
      useChangeClientPlan: () => ({ mutate: vi.fn(), isPending: false }),
      useDeleteClient: () => ({ mutate: vi.fn(), isPending: false }),
    }));
    vi.doMock('../api/hooks/usePlans', () => ({ usePlans: () => ({ data: { data: [] } }) }));
    const { ClientActions: Gated } = await import('./ClientActions');
    const client = { id: 'c1', status: 'active', plan_id: 'pl_gold', name: 'Greenwood', students_count: 1, staff_count: 1 } as Client;
    renderWithToast(<Gated client={client} />);
    expect(screen.queryByText('Hold school')).not.toBeInTheDocument();
    expect(screen.getByText('Deactivate')).toBeInTheDocument();
  });
});
