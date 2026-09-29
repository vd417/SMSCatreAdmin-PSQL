import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BillingScreen } from './BillingScreen';

vi.mock('../components/billing/PlansTab', () => ({ PlansTab: () => <div>PLANS_TAB</div> }));
vi.mock('../components/billing/SubscriptionsTab', () => ({ SubscriptionsTab: () => <div>SUBS_TAB</div> }));
vi.mock('../components/billing/InvoicesTab', () => ({ InvoicesTab: () => <div>INV_TAB</div> }));
vi.mock('../components/billing/UpgradeRequestsTab', () => ({ UpgradeRequestsTab: () => <div>UPGRADES_TAB</div> }));
vi.mock('../api/hooks/useInvoices', () => ({ useInvoices: () => ({ data: { pages: [{ data: [], next_cursor: null }] } }) }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ can: () => true }) }));

describe('BillingScreen', () => {
  it('plansOnly mode shows only the Plans tab content', () => {
    render(<BillingScreen plansOnly />);
    expect(screen.getByText('PLANS_TAB')).toBeInTheDocument();
    expect(screen.queryByText('SUBS_TAB')).not.toBeInTheDocument();
  });
  it('full mode renders the tab bar with Subscriptions + Invoices', () => {
    render(<BillingScreen />);
    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
  });
});
