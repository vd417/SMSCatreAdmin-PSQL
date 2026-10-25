import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientRowActions } from './ClientRowActions';
import { ToastCtx, NavCtx } from './index';
import type { Client } from '../api/types';

const updateMutate = vi.hoisted(() => vi.fn());
vi.mock('../api/hooks/useClientMutations', () => ({
  useSetClientStatus: () => ({ mutate: vi.fn(), isPending: false }),
  useChangeClientPlan: () => ({ mutate: vi.fn(), isPending: false }),
  useIncreaseSeats: () => ({ mutate: vi.fn(), isPending: false }),
  useSetSeatSettings: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateClient: () => ({ mutate: updateMutate, isPending: false }),
}));
vi.mock('../api/hooks/usePlans', () => ({ usePlans: () => ({ data: { data: [] } }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }));

function renderRow(go = vi.fn(), client: Partial<Client> = {}) {
  const school = { id: 'c1', status: 'active', plan_id: 'pl_gold', name: 'Greenwood', students_count: 1, staff_count: 1, ...client } as Client;
  render(
    <NavCtx.Provider value={{ route: { name: 'clients', params: {} }, go }}>
      <ToastCtx.Provider value={() => {}}><ClientRowActions school={school} /></ToastCtx.Provider>
    </NavCtx.Provider>,
  );
}

describe('ClientRowActions', () => {
  it('offers Add branch and opens the onboard wizard for that customer', () => {
    const go = vi.fn();
    renderRow(go);
    fireEvent.click(screen.getByRole('button')); // the ⋮ trigger
    fireEvent.click(screen.getByText('Add branch'));
    expect(go).toHaveBeenCalledWith('onboard', { id: 'c1' });
  });

  it('edits the customer contact and PATCHes the changed email with existing name/phone', () => {
    updateMutate.mockClear();
    renderRow(vi.fn(), { contact_name: 'Priya Sharma', contact_email: 'old@school.edu', contact_phone: '9000012345' });
    fireEvent.click(screen.getByRole('button')); // the ⋮ trigger
    fireEvent.click(screen.getByText('Edit client'));

    fireEvent.change(screen.getByDisplayValue('old@school.edu'), { target: { value: 'new@school.edu' } });
    fireEvent.click(screen.getByText('Save changes'));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    expect(updateMutate.mock.calls[0][0]).toEqual({
      contact_name: 'Priya Sharma', contact_email: 'new@school.edu', contact_phone: '9000012345',
    });
  });

  it('blocks saving an invalid email and does not call the mutation', () => {
    updateMutate.mockClear();
    renderRow(vi.fn(), { contact_email: 'old@school.edu' });
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('Edit client'));
    fireEvent.change(screen.getByDisplayValue('old@school.edu'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByText('Save changes'));

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(updateMutate).not.toHaveBeenCalled();
  });
});
