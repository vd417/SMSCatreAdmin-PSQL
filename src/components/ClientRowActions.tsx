import React, { useState } from 'react';
import { Menu, MenuItem, ConfirmDialog, Modal, Btn, StatusBadge, useToast, useNav, fmt } from './index';
import { Icon } from '../lib/icons';
import { useAuth } from '../auth/AuthContext';
import {
  useSetClientStatus, useChangeClientPlan, useIncreaseSeats, useSetSeatSettings,
} from '../api/hooks/useClientMutations';
import { useInvoices } from '../api/hooks/useInvoices';
import { downloadInvoicePdf } from '../api/invoices';
import { ChangePlanModal, ManageSeatsModal, EditContactModal, ACTIONS } from './ClientActions';
import { QueryBoundary } from './QueryBoundary';
import type { ApiError } from '../api/ApiError';
import type { Client, Invoice } from '../api/types';

/* Compact per-school action menu for the Clients list (one school per menu).
   Reuses the same mutations and modals as the detail-screen ClientActions so the
   two stay in lock-step. */
export function ClientRowActions({ school }: { school: Client }): React.ReactElement {
  const { can } = useAuth();
  const toast = useToast();
  const { go } = useNav();

  const statusMut = useSetClientStatus(school.id);
  const planMut = useChangeClientPlan(school.id);
  const seatsMut = useIncreaseSeats(school.id);
  const seatSettingsMut = useSetSeatSettings(school.id);

  const [planOpen, setPlanOpen] = useState(false);
  const [seatsOpen, setSeatsOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirm, setConfirm] = useState<typeof ACTIONS[keyof typeof ACTIONS] | null>(null);

  const showEdit = can('clients.manage_people');
  const showPlan = can('clients.change_plan');
  const showSeats = can('clients.change_plan');
  const canSuspend = can('clients.suspend') && ['active', 'trial', 'hold'].includes(school.status);
  const canRevoke = can('clients.deactivate') && ['active', 'trial', 'hold', 'suspended'].includes(school.status);

  const fireStatus = (a: typeof ACTIONS[keyof typeof ACTIONS]) =>
    statusMut.mutate(a.key, {
      onSuccess: () => toast({ kind: a.toast.kind ?? 'success', title: a.toast.title, msg: a.toast.msg }),
      onError: (e) => toast({ kind: 'error', title: 'Action failed', msg: (e as ApiError).message }),
    });

  return (
    <>
      <Menu trigger={<Btn variant="ghost" size="sm" icon={Icon.moreH} />}>
        <MenuItem icon={Icon.eye} onClick={() => go('client', { id: school.id })}>View details</MenuItem>
        {showEdit && (
          <MenuItem icon={Icon.edit} onClick={() => setEditOpen(true)}>Edit client</MenuItem>
        )}
        {can('clients.start_trial') && (
          <MenuItem icon={Icon.building} onClick={() => go('onboard', { id: school.id })}>Add branch</MenuItem>
        )}
        {can('billing.view') && (
          <MenuItem icon={Icon.invoice} onClick={() => setInvOpen(true)}>Invoice history</MenuItem>
        )}
        {showPlan && (
          <MenuItem icon={Icon.plans} onClick={() => setPlanOpen(true)}>Plan upgrade</MenuItem>
        )}
        {showSeats && (
          <MenuItem icon={Icon.sliders} onClick={() => setSeatsOpen(true)}>Seat increase</MenuItem>
        )}
        {canSuspend && (
          <MenuItem icon={Icon.pause} danger onClick={() => setConfirm(ACTIONS.suspend)}>Suspend</MenuItem>
        )}
        {canRevoke && (
          <MenuItem icon={Icon.ban} danger onClick={() => setConfirm(ACTIONS.deactivate)}>Revoke access</MenuItem>
        )}
      </Menu>

      {confirm && (
        <ConfirmDialog open onClose={() => setConfirm(null)}
          onConfirm={() => { fireStatus(confirm); setConfirm(null); }}
          title={confirm.confirm!.title} message={confirm.confirm!.message}
          confirmLabel={confirm.confirm!.confirmLabel} danger={confirm.danger} />
      )}

      <ChangePlanModal open={planOpen} onClose={() => setPlanOpen(false)} client={school}
        onPick={(planId) => planMut.mutate(planId, {
          onSuccess: () => toast({ kind: 'success', title: 'Plan updated', msg: `${school.name} plan changed.` }),
          onError: (e) => toast({ kind: 'error', title: 'Plan change failed', msg: (e as ApiError).message }),
        })} />

      <ManageSeatsModal
        open={seatsOpen}
        onClose={() => setSeatsOpen(false)}
        client={school}
        increasePending={seatsMut.isPending}
        settingsPending={seatSettingsMut.isPending}
        onIncrease={(seatLimit, reason, done) => seatsMut.mutate({ seatLimit, reason }, {
          onSuccess: () => {
            toast({ kind: 'success', title: 'Seats increased', msg: `${school.name} → ${fmt.num(seatLimit)} billed seats.` });
            done();
          },
          onError: (e) => toast({ kind: 'error', title: 'Seat increase failed', msg: (e as ApiError).message }),
        })}
        onSaveSettings={(body, done) => seatSettingsMut.mutate(body, {
          onSuccess: () => {
            toast({ kind: 'success', title: 'Seat policy saved', msg: `${school.name} seat settings updated.` });
            done();
          },
          onError: (e) => toast({ kind: 'error', title: 'Save failed', msg: (e as ApiError).message }),
        })}
      />

      {invOpen && <InvoiceHistoryModal school={school} onClose={() => setInvOpen(false)} />}

      {editOpen && <EditContactModal client={school} onClose={() => setEditOpen(false)} />}
    </>
  );
}

function InvoiceHistoryModal({ school, onClose }: { school: Client; onClose: () => void }) {
  const toast = useToast();
  const query = useInvoices({ tenant_id: school.id }, { enabled: true });
  const invoices: Invoice[] = query.data?.pages.flatMap(p => p.data) ?? [];

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="modal-head">
        <div className="mh-ic" style={{ background: 'var(--accent-ghost)', color: 'var(--accent)' }}><Icon.invoice size={19} /></div>
        <div className="mh-text"><h3>Invoice history</h3><p>{school.name}</p></div>
      </div>
      <div className="modal-body">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Plan</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Status</th>
                <th>Issued</th>
                <th>Due</th>
                <th style={{ width: 56 }}></th>
              </tr>
            </thead>
            <QueryBoundary
              isLoading={query.isLoading}
              isError={query.isError}
              error={query.error}
              isEmpty={invoices.length === 0}
              emptyTitle="No invoices for this school"
            >
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="mono" style={{ fontWeight: 600 }}>{inv.id}</td>
                    <td className="muted">{inv.plan_name}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{fmt.money(inv.amount, 2)}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td className="tiny muted mono">{inv.issued}</td>
                    <td className="tiny muted mono" style={{ color: inv.status === 'past_due' ? 'var(--red)' : undefined }}>{inv.due}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <Btn variant="default" size="sm" icon={Icon.download}
                        onClick={() => downloadInvoicePdf(inv.id).then(
                          () => toast({ title: 'Invoice downloaded', msg: inv.id }),
                          (e) => toast({ title: 'Download failed', msg: (e as ApiError).message, kind: 'error' }),
                        )}>PDF</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </QueryBoundary>
          </table>
        </div>
      </div>
      <div className="modal-foot">
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  );
}
