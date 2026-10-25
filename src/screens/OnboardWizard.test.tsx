import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardWizard } from './OnboardWizard';
import { NavCtx, ToastCtx } from '../components';

const mutate = vi.fn();
vi.mock('../api/hooks/useClientMutations', () => ({ useCreateClient: () => ({ mutate, isPending: false }) }));
vi.mock('../api/hooks/usePlans', () => ({
  usePlans: () => ({ data: { data: [
    { id: 'pl_gold', name: 'Gold', price: 50000, color: '#caa', description: 'Best value', limits: { students: 1000, staff: 80, storage_gb: 50 } },
    { id: 'pl_ps', name: 'Per Student', pricing: 'per_student', price: 0, per_student: 50, min_students: 100, color: '#5a5', description: 'Billed per student', limits: { students: 5000, staff: 200, storage_gb: 100 } },
  ] } }),
}));
vi.mock('../api/hooks/useTeam', () => ({
  useTeam: () => ({ data: { data: [
    { id: 'tm1', name: 'Ravi Sales', email: 'ravi@catre.app', role: 'sales', status: 'active', last_login: null, joined: '2026-01-01' },
  ] } }),
}));

// Mutable existing-client list the duplicate guard scans. Hoisted so the vi.mock
// factory can read it; each test sets it (default empty → no duplicates).
const existing = vi.hoisted(() => ({ clients: [] as Array<Record<string, unknown>> }));
vi.mock('../api/hooks/useClients', () => ({
  useClients: () => ({ data: { pages: [{ data: existing.clients }] } }),
}));

// Branch mode: the customer a new branch is being added for (undefined = normal onboarding).
const branch = vi.hoisted(() => ({ customer: undefined as Record<string, unknown> | undefined }));
vi.mock('../api/hooks/useClient', () => ({
  useClient: (id: string) => ({ data: id ? branch.customer : undefined }),
}));

function renderWizard(go = vi.fn(), toast: (t: unknown) => void = () => {}, params: Record<string, unknown> = {}) {
  return render(
    <NavCtx.Provider value={{ route: { name: 'onboard', params }, go }}>
      <ToastCtx.Provider value={toast}><OnboardWizard /></ToastCtx.Provider>
    </NavCtx.Provider>,
  );
}

beforeEach(() => { existing.clients = []; branch.customer = undefined; });

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
  async function fillAdminStep(
    user: ReturnType<typeof userEvent.setup>, container: HTMLElement,
    email = 'a@b.co', phone = '',
  ) {
    await user.type(screen.getByPlaceholderText('e.g. Priya Sharma'), 'Priya');
    await user.type(screen.getByPlaceholderText('admin@school.edu'), email);
    if (phone) await user.type(screen.getByPlaceholderText('+91 90000 00000'), phone);
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

  it('blocks onboarding and opens the existing customer when the admin email already belongs to a client', async () => {
    existing.clients = [{ id: 'cl_dup', name: 'Greenwood High', contact_email: 'dup@school.edu', contact_phone: null }];
    const go = vi.fn();
    const toast = vi.fn();
    const user = userEvent.setup();
    const { container } = renderWizard(go, toast);
    await user.type(screen.getByPlaceholderText('e.g. Greenwood High'), 'New School');
    fireEvent.click(screen.getByText('Continue')); // -> admin
    await fillAdminStep(user, container, 'dup@school.edu');
    fireEvent.click(screen.getByText('Continue')); // duplicate -> blocked

    expect(go).toHaveBeenCalledWith('client', { id: 'cl_dup' });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Customer already registered' }));
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.queryByText('Payment method')).toBeNull(); // did not advance to Plan & payment
  });

  it('flags a duplicate by phone even when the email is new', async () => {
    existing.clients = [{ id: 'cl_phone', name: 'Blue Valley', contact_email: 'other@school.edu', contact_phone: '+91 90000 12345' }];
    const go = vi.fn();
    const user = userEvent.setup();
    const { container } = renderWizard(go);
    await user.type(screen.getByPlaceholderText('e.g. Greenwood High'), 'New School');
    fireEvent.click(screen.getByText('Continue')); // -> admin
    await fillAdminStep(user, container, 'fresh@school.edu', '9000012345');
    fireEvent.click(screen.getByText('Continue')); // duplicate -> blocked

    expect(go).toHaveBeenCalledWith('client', { id: 'cl_phone' });
  });

  it('lets onboarding continue when the email and phone are new', async () => {
    existing.clients = [{ id: 'cl_other', name: 'Other', contact_email: 'other@school.edu', contact_phone: '9999999999' }];
    const go = vi.fn();
    const user = userEvent.setup();
    const { container } = renderWizard(go);
    await user.type(screen.getByPlaceholderText('e.g. Greenwood High'), 'New School');
    fireEvent.click(screen.getByText('Continue')); // -> admin
    await fillAdminStep(user, container, 'brand-new@school.edu', '9000012345');
    fireEvent.click(screen.getByText('Continue')); // no duplicate -> advances

    expect(go).not.toHaveBeenCalledWith('client', expect.anything());
    expect(screen.getByText('Payment method')).toBeInTheDocument(); // reached Plan & payment
  });

  const CUSTOMER = {
    id: 'cl_cust', name: 'Greenwood High',
    contact_name: 'Priya Sharma', contact_email: 'owner@school.edu', contact_phone: '9000011111',
  };

  it('in branch mode, shows the customer in the title and skips the admin step', () => {
    branch.customer = CUSTOMER;
    renderWizard(vi.fn(), () => {}, { id: 'cl_cust' });

    expect(screen.getByText('Add a branch for Greenwood High')).toBeInTheDocument();
    expect(screen.queryByText('Admin contact')).toBeNull(); // admin step is gone
    fireEvent.change(screen.getByPlaceholderText('e.g. Greenwood High'), { target: { value: 'Greenwood North' } });
    fireEvent.click(screen.getByText('Continue')); // -> plan (admin skipped)

    expect(screen.getByText('Payment method')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('admin@school.edu')).toBeNull(); // never asked for admin
  });

  it('in branch mode, does not trigger the duplicate guard even with the same email on file', () => {
    branch.customer = CUSTOMER;
    existing.clients = [{ id: 'cl_cust', name: 'Greenwood High', contact_email: 'owner@school.edu', contact_phone: '9000011111' }];
    const go = vi.fn();
    renderWizard(go, () => {}, { id: 'cl_cust' });

    fireEvent.change(screen.getByPlaceholderText('e.g. Greenwood High'), { target: { value: 'Greenwood North' } });
    fireEvent.click(screen.getByText('Continue')); // -> plan directly

    expect(go).not.toHaveBeenCalledWith('client', expect.anything());
    expect(screen.getByText('Payment method')).toBeInTheDocument();
  });

  it('in branch mode, creates the school with the customer’s email', () => {
    branch.customer = CUSTOMER;
    renderWizard(vi.fn(), () => {}, { id: 'cl_cust' });

    fireEvent.change(screen.getByPlaceholderText('e.g. Greenwood High'), { target: { value: 'Greenwood North' } });
    fireEvent.click(screen.getByText('Continue')); // -> plan (trial default)
    fireEvent.click(screen.getByText('Continue')); // -> trial
    fireEvent.click(screen.getByText('Continue')); // -> review
    fireEvent.click(screen.getByText('Create client'));

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ admin_email: 'owner@school.edu', name: 'Greenwood North' }),
      expect.anything(),
    );
  });

  it('defaults the trial to 7 days', async () => {
    const user = userEvent.setup();
    const { container } = renderWizard();
    await user.type(screen.getByPlaceholderText('e.g. Greenwood High'), 'Greenwood');
    fireEvent.click(screen.getByText('Continue')); // -> admin
    await fillAdminStep(user, container);
    fireEvent.click(screen.getByText('Continue')); // -> plan (Gold default, flat)
    fireEvent.click(screen.getByText('Continue')); // -> trial
    fireEvent.click(screen.getByText('Continue')); // -> review
    expect(screen.getByText(/7 days/)).toBeInTheDocument();
  });

  it('shows the trial end date on the trial step', async () => {
    const user = userEvent.setup();
    const { container } = renderWizard();
    await user.type(screen.getByPlaceholderText('e.g. Greenwood High'), 'Greenwood');
    fireEvent.click(screen.getByText('Continue'));
    await fillAdminStep(user, container);
    fireEvent.click(screen.getByText('Continue')); // -> plan
    fireEvent.click(screen.getByText('Continue')); // -> trial
    expect(screen.getByText(/Ends /)).toBeInTheDocument();
  });

  it('shows the per-student rate on a per-student plan card', async () => {
    const user = userEvent.setup();
    const { container } = renderWizard();
    await user.type(screen.getByPlaceholderText('e.g. Greenwood High'), 'Greenwood');
    fireEvent.click(screen.getByText('Continue'));
    await fillAdminStep(user, container);
    fireEvent.click(screen.getByText('Continue')); // -> plan
    expect(screen.getByText('/student/mo')).toBeInTheDocument();
  });

  it('requires a student count for a per-student plan before continuing', async () => {
    const user = userEvent.setup();
    const { container } = renderWizard();
    await user.type(screen.getByPlaceholderText('e.g. Greenwood High'), 'Greenwood');
    fireEvent.click(screen.getByText('Continue'));
    await fillAdminStep(user, container);
    fireEvent.click(screen.getByText('Continue')); // -> plan
    fireEvent.click(screen.getByText('Per Student')); // select per-student plan
    fireEvent.click(screen.getByText('Continue')); // blocked: no student count
    expect(screen.getByText('Enter the number of students')).toBeInTheDocument();
    expect(screen.queryByText(/Ends /)).toBeNull(); // did not advance to trial

    fireEvent.change(screen.getByPlaceholderText('e.g. 350'), { target: { value: '150' } });
    fireEvent.click(screen.getByText('Continue')); // -> trial
    expect(screen.getByText(/Ends /)).toBeInTheDocument();
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
