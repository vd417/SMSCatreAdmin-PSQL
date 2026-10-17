import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { useInvoices } from '../api/hooks/useInvoices';
import type { Invoice } from '../api/types';
import { PlansTab } from '../components/billing/PlansTab';
import { SubscriptionsTab } from '../components/billing/SubscriptionsTab';
import { InvoicesTab } from '../components/billing/InvoicesTab';
import { UpgradeRequestsTab } from '../components/billing/UpgradeRequestsTab';
import { SeatRequestsTab } from '../components/billing/SeatRequestsTab';
import { Btn, useNav } from '../components';
import { Icon } from '../lib/icons';

type TabKey = 'plans' | 'subscriptions' | 'invoices' | 'upgrades' | 'seats';

interface TabDef {
  key: TabKey;
  label: string;
  perm: string;
}

export function BillingScreen({ plansOnly }: { plansOnly?: boolean }): React.ReactElement {
  const { can } = useAuth();

  const allTabs: TabDef[] = plansOnly
    ? [{ key: 'plans', label: 'Plans catalog', perm: 'plans.view' }]
    : [
        { key: 'upgrades', label: 'Upgrade requests', perm: 'billing.view' },
        { key: 'seats', label: 'Seat requests', perm: 'billing.view' },
        { key: 'plans', label: 'Plans', perm: 'plans.view' },
        { key: 'subscriptions', label: 'Subscriptions', perm: 'billing.view' },
        { key: 'invoices', label: 'Invoices', perm: 'billing.view' },
      ];

  const tabs = allTabs.filter(t => can(t.perm));

  // In the full billing view the active sub-tab lives in the URL (/billing/:tab) so
  // tabs are deep-linkable and show up in the address bar on click. The plans-only
  // view (its own /plans route) has a single tab and stays local.
  const { route, go } = useNav();
  const fallbackTab: TabKey = tabs[0]?.key ?? 'plans';
  const urlTab = route.params.tab as TabKey | undefined;
  const tab: TabKey = plansOnly
    ? 'plans'
    : (urlTab && tabs.some(t => t.key === urlTab) ? urlTab : fallbackTab);
  const setTab = (k: TabKey) => go('billing', { tab: k });

  const pastDueQuery = useInvoices({ status: 'past_due' }, { enabled: !plansOnly });
  const pastDue = pastDueQuery.data?.pages.flatMap(p => p.data) ?? [];

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div className="ph-text">
          <h1 className="page-title">{plansOnly ? 'Plans' : 'Billing & payments'}</h1>
          <p className="page-desc">
            {plansOnly
              ? 'Care plans — pricing, offers and publishing.'
              : 'Plans, subscriptions and invoices across all clients.'}
          </p>
        </div>
      </div>

      {!plansOnly && pastDue.length > 0 && tab !== 'plans' && (
        <div
          className="banner banner-pastdue"
          style={{ borderRadius: 10, marginBottom: 16, border: '1px solid var(--red-line)' }}
        >
          <Icon.warn />
          <span>
            <b>{pastDue.length} invoices</b> are past due across{' '}
            {new Set(pastDue.map((i: Invoice) => i.tenant_id)).size} clients.
          </span>
          <div className="banner-act">
            <Btn variant="danger" size="sm" onClick={() => setTab('invoices')}>
              Review
            </Btn>
          </div>
        </div>
      )}

      {!plansOnly && (
        <div className="tabs" style={{ marginBottom: 18 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              className={'tab' + (tab === t.key ? ' active' : '')}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'upgrades' && <UpgradeRequestsTab />}
      {tab === 'seats' && <SeatRequestsTab />}
      {tab === 'plans' && <PlansTab />}
      {tab === 'subscriptions' && <SubscriptionsTab />}
      {tab === 'invoices' && <InvoicesTab />}
    </div>
  );
}
