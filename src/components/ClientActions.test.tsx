import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientActions, EditOwnerModal } from './ClientActions';
import { ToastCtx, NavCtx } from './index';
import type { Client } from '../api/types';
import type { OwnerGroup } from '../lib/ownerSchools';

const updateMutate = vi.hoisted(() => vi.fn());
const ownerMutate = vi.hoisted(() => vi.fn());
vi.mock('../api/hooks/useClientMutations', () => ({
  useSetClientStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useChangeClientPlan: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteClient: () => ({ mutate: vi.fn(), isPending: false }),
  useIncreaseSeats: () => ({ mutate: vi.fn(), isPending: false }),
  useSetSeatSettings: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateClient: () => ({ mutate: updateMutate, isPending: false }),
  useUpdateOwnerContact: () => ({ mutate: ownerMutate, isPending: false }),
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

  it('offers Add branch that opens the onboard wizard for the customer', () => {
    const go = vi.fn();
    const client = { id: 'c1', status: 'active', plan_id: 'pl_gold', name: 'Greenwood', students_count: 1, staff_count: 0 } as Client;
    render(
      <NavCtx.Provider value={{ route: { name: 'client', params: {} }, go }}>
        <ToastCtx.Provider value={() => {}}><ClientActions client={client} /></ToastCtx.Provider>
      </NavCtx.Provider>,
    );
    fireEvent.click(screen.getByText('Add branch'));
    expect(go).toHaveBeenCalledWith('onboard', { id: 'c1' });
  });

  it('edits the customer contact from the detail screen and PATCHes the changed phone', () => {
    updateMutate.mockClear();
    const client = { id: 'c1', status: 'active', plan_id: 'pl_gold', name: 'Greenwood', students_count: 1, staff_count: 0,
      contact_name: 'Priya Sharma', contact_email: 'priya@school.edu', contact_phone: '9000012345' } as Client;
    renderWithToast(<ClientActions client={client} />);
    fireEvent.click(screen.getByText('Edit client'));
    fireEvent.change(screen.getByDisplayValue('9000012345'), { target: { value: '9876543210' } });
    fireEvent.click(screen.getByText('Save changes'));
    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0][0]).toEqual({
      contact_name: 'Priya Sharma', contact_email: 'priya@school.edu', contact_phone: '9876543210',
    });
  });

  it('edits the school name/slug and PATCHes the changed identity fields alongside contact', () => {
    updateMutate.mockClear();
    const client = { id: 'c1', status: 'active', plan_id: 'pl_gold', name: 'Greenwood', slug: 'greenwood',
      country: 'India', address: '12 MG Road', students_count: 1, staff_count: 0,
      contact_name: 'Priya Sharma', contact_email: 'priya@school.edu', contact_phone: '9000012345' } as Client;
    renderWithToast(<ClientActions client={client} />);
    fireEvent.click(screen.getByText('Edit client'));
    fireEvent.change(screen.getByDisplayValue('Greenwood'), { target: { value: 'Greenwood High' } });
    fireEvent.change(screen.getByDisplayValue('greenwood'), { target: { value: 'greenwood-high' } });
    fireEvent.click(screen.getByText('Save changes'));
    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0][0]).toEqual({
      contact_name: 'Priya Sharma', contact_email: 'priya@school.edu', contact_phone: '9000012345',
      name: 'Greenwood High', slug: 'greenwood-high',
    });
  });

  it('blocks saving an invalid slug and does not call the mutation', () => {
    updateMutate.mockClear();
    const client = { id: 'c1', status: 'active', plan_id: 'pl_gold', name: 'Greenwood', slug: 'greenwood',
      students_count: 1, staff_count: 0 } as Client;
    renderWithToast(<ClientActions client={client} />);
    fireEvent.click(screen.getByText('Edit client'));
    fireEvent.change(screen.getByDisplayValue('greenwood'), { target: { value: 'Green Wood!' } });
    fireEvent.click(screen.getByText('Save changes'));
    expect(screen.getByText('Slug can use only lowercase letters, numbers, and hyphens.')).toBeInTheDocument();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it('edits the owner and bulk-PATCHes the contact to every school in the portfolio', () => {
    ownerMutate.mockClear();
    const group = {
      key: 'akash@yopmail.com', email: 'akash@yopmail.com', ownerName: 'Akash Gupta', mrr: 10000,
      schools: [
        { id: 's1', name: 'ITM', contact_name: 'Akash Gupta', contact_email: 'akash@yopmail.com', contact_phone: '900001' },
        { id: 's2', name: 'VITM', contact_name: 'Akash Gupta', contact_email: 'akash@yopmail.com', contact_phone: '900001' },
      ],
    } as unknown as OwnerGroup;
    renderWithToast(<EditOwnerModal group={group} onClose={() => {}} />);
    fireEvent.change(screen.getByDisplayValue('900001'), { target: { value: '9998887776' } });
    fireEvent.click(screen.getByText('Save changes'));         // step 1: review
    expect(ownerMutate).not.toHaveBeenCalled();                 // nothing saved yet
    fireEvent.click(screen.getByText('Update 2 schools'));      // step 2: confirm
    expect(ownerMutate).toHaveBeenCalledTimes(1);
    expect(ownerMutate.mock.calls[0][0]).toEqual({
      ids: ['s1', 's2'],
      body: { contact_name: 'Akash Gupta', contact_email: 'akash@yopmail.com', contact_phone: '9998887776' },
    });
  });

  it('blocks owner edit with an invalid email and does not call the mutation', () => {
    ownerMutate.mockClear();
    const group = {
      key: 'solo', email: null, ownerName: 'Solo', mrr: 0,
      schools: [{ id: 's1', name: 'Solo', contact_name: 'Solo', contact_email: 'x@y.com', contact_phone: '' }],
    } as unknown as OwnerGroup;
    renderWithToast(<EditOwnerModal group={group} onClose={() => {}} />);
    fireEvent.change(screen.getByDisplayValue('x@y.com'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByText('Save changes'));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(ownerMutate).not.toHaveBeenCalled();
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
      useIncreaseSeats: () => ({ mutate: vi.fn(), isPending: false }),
      useSetSeatSettings: () => ({ mutate: vi.fn(), isPending: false }),
      useUpdateClient: () => ({ mutate: vi.fn(), isPending: false }),
    }));
    vi.doMock('../api/hooks/usePlans', () => ({ usePlans: () => ({ data: { data: [] } }) }));
    const { ClientActions: Gated } = await import('./ClientActions');
    const client = { id: 'c1', status: 'active', plan_id: 'pl_gold', name: 'Greenwood', students_count: 1, staff_count: 1 } as Client;
    renderWithToast(<Gated client={client} />);
    expect(screen.queryByText('Hold school')).not.toBeInTheDocument();
    expect(screen.getByText('Deactivate')).toBeInTheDocument();
  });
});
