import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardWizard } from './OnboardWizard';
import { NavCtx, ToastCtx } from '../components';

const mutate = vi.fn();
vi.mock('../api/hooks/useClientMutations', () => ({ useCreateClient: () => ({ mutate, isPending: false }) }));
vi.mock('../api/hooks/usePlans', () => ({
  usePlans: () => ({ data: { data: [
    { id: 'pl_gold', name: 'Gold', price: 50000, color: '#caa', description: 'Best value', limits: { students: 1000, staff: 80, storage_gb: 50 } },
  ] } }),
}));
vi.mock('../api/hooks/useTeam', () => ({
  useTeam: () => ({ data: { data: [
    { id: 'tm1', name: 'Ravi Sales', email: 'ravi@catre.app', role: 'sales', status: 'active', last_login: null, joined: '2026-01-01' },
  ] } }),
}));

function renderWizard(go = vi.fn()) {
  return render(
    <NavCtx.Provider value={{ route: { name: 'onboard', params: {} }, go }}>
      <ToastCtx.Provider value={() => {}}><OnboardWizard /></ToastCtx.Provider>
    </NavCtx.Provider>,
  );
}

describe('OnboardWizard', () => {
  it('blocks Continue on step 0 until a school name is entered', () => {
    renderWizard();
    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByText('School name is required')).toBeInTheDocument();
  });

  it('labels location as State (not Country/City) and adds Address, relabeled size', () => {
    renderWizard();
    expect(screen.getByText('State')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Maharashtra' })).toBeInTheDocument();
    expect(screen.getByText('Address')).toBeInTheDocument();
    expect(screen.getByText('School size (students)')).toBeInTheDocument();
    expect(screen.queryByText('Country')).toBeNull();
    expect(screen.queryByText('City')).toBeNull();
    expect(screen.queryByText('Approx. size')).toBeNull();
  });

  // Fill the admin step's required fields, including the ID proof (type + document).
  async function fillAdminStep(user: ReturnType<typeof userEvent.setup>, container: HTMLElement) {
    await user.type(screen.getByPlaceholderText('e.g. Priya Sharma'), 'Priya');
    await user.type(screen.getByPlaceholderText('admin@school.edu'), 'a@b.co');
    const typeSelect = screen.getAllByRole('combobox').find(s => s.querySelector('option[value="pan"]'))!;
    fireEvent.change(typeSelect, { target: { value: 'pan' } });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array(10)], 'pan.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    await screen.findByText(/Attached:/);
  }

  it('requires an ID proof type and document on the admin step', async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.type(screen.getByPlaceholderText('e.g. Greenwood High'), 'Greenwood');
    fireEvent.click(screen.getByText('Continue')); // -> admin
    await user.type(screen.getByPlaceholderText('e.g. Priya Sharma'), 'Priya');
    await user.type(screen.getByPlaceholderText('admin@school.edu'), 'a@b.co');
    fireEvent.click(screen.getByText('Continue')); // blocked: no ID proof
    expect(screen.getByText('ID proof document is required')).toBeInTheDocument();
  });

  it('lets the user enter a custom trial length on the trial step', async () => {
    const user = userEvent.setup();
    const { container } = renderWizard();
    await user.type(screen.getByPlaceholderText('e.g. Greenwood High'), 'Greenwood');
    fireEvent.click(screen.getByText('Continue')); // -> admin
    await fillAdminStep(user, container);
    fireEvent.click(screen.getByText('Continue')); // -> plan
    fireEvent.click(screen.getByText('Continue')); // -> trial
    const custom = screen.getByPlaceholderText('Custom days');
    fireEvent.change(custom, { target: { value: '120' } });
    expect((custom as HTMLInputElement).value).toBe('120');
  });

  it('keeps focus while typing the school name (input not remounted per keystroke)', async () => {
    const user = userEvent.setup();
    renderWizard();
    const input = screen.getByPlaceholderText('e.g. Greenwood High');
    await user.click(input);
    await user.type(input, 'Greenwood High');
    expect((screen.getByPlaceholderText('e.g. Greenwood High') as HTMLInputElement).value).toBe('Greenwood High');
    expect(document.activeElement).toBe(screen.getByPlaceholderText('e.g. Greenwood High'));
  });
});
