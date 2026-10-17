import React, { useState } from 'react';
import { Btn, ConfirmDialog, Modal, useToast, fmt } from './index';
import { Icon } from '../lib/icons';
import { useAuth } from '../auth/AuthContext';
import { useSetClientStatus, useChangeClientPlan, useDeleteClient, useIncreaseSeats, useSetSeatSettings } from '../api/hooks/useClientMutations';
import { usePlans } from '../api/hooks/usePlans';
import type { ApiError } from '../api/ApiError';
import type { Client, Plan, ClientStatusAction } from '../api/types';

export type ActionDef = {
  key: ClientStatusAction; label: string; icon: typeof Icon.zap; perm: string;
  variant?: 'primary' | 'default' | 'danger'; danger?: boolean;
  confirm?: { title: string; message: string; confirmLabel: string };
  toast: { title: string; msg: string; kind?: 'success' | 'info' };
};

export const ACTIONS: Record<ClientStatusAction, ActionDef> = {
  start_trial: { key: 'start_trial', label: 'Start trial', icon: Icon.zap, perm: 'clients.start_trial', variant: 'primary',
    confirm: { title: 'Start a new trial?', message: 'A 14-day trial will begin and the client becomes active in onboarding.', confirmLabel: 'Start trial' },
    toast: { title: 'Trial started', msg: '14-day trial is now active.' } },
  activate: { key: 'activate', label: 'Activate', icon: Icon.checkCircle, perm: 'clients.activate', variant: 'primary',
    confirm: { title: 'Activate this client?', message: 'Creates an active subscription, generates an invoice, and emails the school contact.', confirmLabel: 'Activate' },
    toast: { title: 'Client activated', msg: 'Subscription + invoice created; billing email sent if contact email is set.' } },
  hold: { key: 'hold', label: 'Hold school', icon: Icon.pause, perm: 'clients.hold', variant: 'default',
    confirm: { title: 'Put this school on hold?', message: 'School console is locked until you Release hold. Owner can still see the school in their portfolio. Reversible.', confirmLabel: 'Hold school' },
    toast: { title: 'School on hold', msg: 'Access locked until hold is released.', kind: 'info' } },
  release: { key: 'release', label: 'Release hold', icon: Icon.play, perm: 'clients.release', variant: 'primary',
    confirm: { title: 'Release hold?', message: 'School returns to active — staff and students can use it again.', confirmLabel: 'Release hold' },
    toast: { title: 'Hold released', msg: 'School is active again.' } },
  deactivate: { key: 'deactivate', label: 'Deactivate', icon: Icon.ban, perm: 'clients.deactivate', variant: 'default', danger: true,
    confirm: { title: 'Deactivate this school?', message: 'School console is locked until Reactivate. Stronger than Hold. Data is kept.', confirmLabel: 'Deactivate school' },
    toast: { title: 'School deactivated', msg: 'Access revoked until reactivated.', kind: 'info' } },
  reactivate: { key: 'reactivate', label: 'Reactivate', icon: Icon.checkCircle, perm: 'clients.reactivate', variant: 'primary',
    confirm: { title: 'Reactivate this school?', message: 'School returns to active and billing is ensured.', confirmLabel: 'Reactivate' },
    toast: { title: 'School reactivated', msg: 'Access restored.' } },
  suspend: { key: 'suspend', label: 'Suspend', icon: Icon.pause, perm: 'clients.suspend', variant: 'default', danger: true,
    confirm: { title: 'Suspend this client?', message: 'Users will lose access until reinstated. This is reversible. The action is logged.', confirmLabel: 'Suspend client' },
    toast: { title: 'Client suspended', msg: 'Access has been revoked.', kind: 'info' } },
  reinstate: { key: 'reinstate', label: 'Reinstate', icon: Icon.play, perm: 'clients.reinstate', variant: 'primary',
    confirm: { title: 'Reinstate this client?', message: 'Access is restored. If no open invoice exists, a new bill is generated and emailed.', confirmLabel: 'Reinstate' },
    toast: { title: 'Client reinstated', msg: 'Access restored; billing ensured.' } },
  cancel: { key: 'cancel', label: 'Cancel', icon: Icon.ban, perm: 'clients.cancel', variant: 'default', danger: true,
    confirm: { title: 'Cancel this subscription?', message: 'The subscription will be cancelled at period end. Data is retained for 90 days.', confirmLabel: 'Cancel subscription' },
    toast: { title: 'Subscription cancelled', msg: 'Cancels at period end.', kind: 'info' } },
};

const BY_STATUS: Record<string, ClientStatusAction[]> = {
  trial: ['activate', 'hold', 'suspend', 'deactivate', 'cancel'],
  active: ['hold', 'suspend', 'deactivate', 'cancel'],
  hold: ['release', 'suspend', 'deactivate', 'cancel'],
  deactivated: ['reactivate', 'cancel'],
  suspended: ['reinstate', 'reactivate', 'cancel'],
  cancelled: ['start_trial'],
};

export function ClientActions({ client, onDeleted }: { client: Client; onDeleted?: () => void }): React.ReactElement {
  const { can } = useAuth();
  const toast = useToast();
  const statusMut = useSetClientStatus(client.id);
  const planMut = useChangeClientPlan(client.id);
  const deleteMut = useDeleteClient(client.id);
  const seatsMut = useIncreaseSeats(client.id);
  const seatSettingsMut = useSetSeatSettings(client.id);
  const [confirm, setConfirm] = useState<ActionDef | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [seatsOpen, setSeatsOpen] = useState(false);

  const fire = (a: ActionDef) =>
    statusMut.mutate(a.key, {
      onSuccess: () => toast({ kind: a.toast.kind ?? 'success', title: a.toast.title, msg: a.toast.msg }),
      onError: (e) => toast({ kind: 'error', title: 'Action failed', msg: (e as ApiError).message }),
    });

  const onClick = (a: ActionDef) => { if (a.confirm) setConfirm(a); else fire(a); };

  const keys = BY_STATUS[client.status] ?? [];
  const showChangePlan = (client.status === 'trial' || client.status === 'active') && can('clients.change_plan');
  const showSeats = can('clients.change_plan');
  const emptySchool = (client.students_count ?? 0) === 0 && (client.staff_count ?? 0) === 0;
  const showDelete = emptySchool && can('clients.delete');

  return (
    <div className="row gap8">
      {showChangePlan && (
        <Btn variant="default" icon={Icon.plans} disabled={planMut.isPending} onClick={() => setPlanOpen(true)}>Force change (no payment)</Btn>
      )}
      {showSeats && (
        <Btn variant="default" icon={Icon.sliders} onClick={() => setSeatsOpen(true)}>Manage seats</Btn>
      )}
      {keys.filter(k => can(ACTIONS[k].perm)).map(k => {
        const a = ACTIONS[k];
        return (
          <Btn key={k} variant={a.variant} icon={a.icon} disabled={statusMut.isPending} onClick={() => onClick(a)}>
            {a.label}
          </Btn>
        );
      })}
      {showDelete && (
        <Btn variant="danger" icon={Icon.trash} disabled={deleteMut.isPending} onClick={() => setDeleteOpen(true)}>Delete</Btn>
      )}

      {confirm && (
        <ConfirmDialog open onClose={() => setConfirm(null)} onConfirm={() => fire(confirm)}
          title={confirm.confirm!.title} message={confirm.confirm!.message}
          confirmLabel={confirm.confirm!.confirmLabel} danger={confirm.danger} />
      )}

      {deleteOpen && (
        <ConfirmDialog
          open
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => deleteMut.mutate(undefined, {
            onSuccess: () => {
              toast({ kind: 'success', title: 'School deleted', msg: `${client.name} was removed.` });
              setDeleteOpen(false);
              onDeleted?.();
            },
            onError: (e) => toast({ kind: 'error', title: 'Delete failed', msg: (e as ApiError).message }),
          })}
          title="Delete this school permanently?"
          message="Only allowed when there are no students and no staff/teachers. Billing records and the school owner login for this tenant will be removed. This cannot be undone."
          confirmLabel="Delete school"
          danger
        />
      )}

      <ChangePlanModal open={planOpen} onClose={() => setPlanOpen(false)} client={client}
        onPick={(planId) => planMut.mutate(planId, {
          onSuccess: () => toast({ kind: 'success', title: 'Plan updated', msg: 'The subscription plan was changed.' }),
          onError: (e) => toast({ kind: 'error', title: 'Plan change failed', msg: (e as ApiError).message }),
        })} />

      <ManageSeatsModal
        open={seatsOpen}
        onClose={() => setSeatsOpen(false)}
        client={client}
        increasePending={seatsMut.isPending}
        settingsPending={seatSettingsMut.isPending}
        onIncrease={(seatLimit, reason, done) => seatsMut.mutate({ seatLimit, reason }, {
          onSuccess: () => {
            toast({ kind: 'success', title: 'Seats increased', msg: `${client.name} → ${fmt.num(seatLimit)} billed seats.` });
            done();
          },
          onError: (e) => toast({ kind: 'error', title: 'Seat increase failed', msg: (e as ApiError).message }),
        })}
        onSaveSettings={(body, done) => seatSettingsMut.mutate(body, {
          onSuccess: () => {
            toast({ kind: 'success', title: 'Seat policy saved', msg: `${client.name} seat settings updated.` });
            done();
          },
          onError: (e) => toast({ kind: 'error', title: 'Save failed', msg: (e as ApiError).message }),
        })}
      />
    </div>
  );
}

export function ChangePlanModal({ open, onClose, client, onPick }:
  { open: boolean; onClose: () => void; client: Client; onPick: (planId: string) => void }) {
  const { data } = usePlans();
  const plans: Plan[] = data?.data ?? [];
  const [sel, setSel] = useState(client.plan_id);
  React.useEffect(() => { setSel(client.plan_id); }, [client.plan_id, open]);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="modal-head">
        <div className="mh-ic" style={{ background: 'var(--accent-ghost)', color: 'var(--accent)' }}><Icon.plans size={19} /></div>
        <div className="mh-text"><h3>Force change plan</h3><p>{client.name} · skips payment &amp; approval queue</p></div>
      </div>
      <div className="modal-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, padding: '8px 0' }}>
          {plans.map(p => (
            <button key={p.id} onClick={() => setSel(p.id)} style={{ textAlign: 'left', padding: '13px 15px', borderRadius: 11,
              border: '1.5px solid ' + (sel === p.id ? 'var(--accent)' : 'var(--border)'),
              background: sel === p.id ? 'var(--accent-ghost)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} />
              <div className="f1">
                <div style={{ fontWeight: 650, fontSize: 14 }}>{p.name}{client.plan_id === p.id && <span className="tiny muted" style={{ fontWeight: 500 }}>  · current</span>}</div>
                <div className="tiny muted">{fmt.num(p.limits.students)} students · {fmt.num(p.limits.staff)} staff</div>
              </div>
              <div className="mono" style={{ fontWeight: 700 }}>{fmt.money(p.price)}<span className="tiny muted">/mo</span></div>
            </button>
          ))}
        </div>
      </div>
      <div className="modal-foot">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={sel === client.plan_id} onClick={() => { onPick(sel); onClose(); }}>Update plan</Btn>
      </div>
    </Modal>
  );
}

export function ManageSeatsModal({ open, onClose, client, increasePending, settingsPending, onIncrease, onSaveSettings }: {
  open: boolean;
  onClose: () => void;
  client: Client;
  increasePending: boolean;
  settingsPending: boolean;
  onIncrease: (seatLimit: number, reason: string | undefined, done: () => void) => void;
  onSaveSettings: (body: { seat_increase_mode?: 'auto' | 'manual'; seat_alert_threshold?: number }, done: () => void) => void;
}) {
  const billed = client.students_count ?? 0;
  const enrolled = client.enrolled_students ?? billed;
  const [limit, setLimit] = useState(billed);
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'auto' | 'manual'>(client.seat_increase_mode ?? 'manual');
  const [threshold, setThreshold] = useState<number>(client.seat_alert_threshold ?? 0);

  React.useEffect(() => {
    if (!open) return;
    setLimit(billed);
    setReason('');
    setMode(client.seat_increase_mode ?? 'manual');
    setThreshold(client.seat_alert_threshold ?? 0);
  }, [open, billed, client.seat_increase_mode, client.seat_alert_threshold]);

  // Backend requires the new limit to exceed the current billed cap and cover live enrolment.
  const increaseInvalid = limit <= billed || limit < enrolled;
  const settingsChanged = mode !== (client.seat_increase_mode ?? 'manual')
    || threshold !== (client.seat_alert_threshold ?? 0);

  return (
    <Modal open={open} onClose={onClose}>
      <div className="modal-head">
        <div className="mh-ic" style={{ background: 'var(--accent-ghost)', color: 'var(--accent)' }}><Icon.sliders size={19} /></div>
        <div className="mh-text"><h3>Manage seats</h3><p>{client.name} · billed cap, per-student proration &amp; policy</p></div>
      </div>
      <div className="modal-body">
        <div className="row gap8" style={{ marginBottom: 14 }}>
          <div className="card f1" style={{ padding: '11px 14px' }}>
            <div className="tiny muted">Billed seats</div>
            <div style={{ fontWeight: 700, fontSize: 18 }} className="mono">{fmt.num(billed)}</div>
          </div>
          <div className="card f1" style={{ padding: '11px 14px' }}>
            <div className="tiny muted">Live enrolled</div>
            <div style={{ fontWeight: 700, fontSize: 18 }} className="mono">{fmt.num(enrolled)}</div>
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label className="tiny muted" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>New billed seat limit</label>
          <input
            type="number"
            className="input"
            min={billed + 1}
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <input
            type="text"
            className="input"
            placeholder="Reason (optional — shown on the audit log)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{ width: '100%', marginTop: 8 }}
          />
          {increaseInvalid && (
            <div className="tiny" style={{ color: 'var(--red)', marginTop: 6 }}>
              Must be greater than {fmt.num(billed)} and cover {fmt.num(enrolled)} enrolled.
            </div>
          )}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
            <Btn variant="primary" disabled={increaseInvalid || increasePending}
              onClick={() => onIncrease(limit, reason.trim() || undefined, onClose)}>
              Apply increase &amp; bill
            </Btn>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <label className="tiny muted" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Seat policy</label>
          <div className="row gap8" style={{ marginBottom: 10 }}>
            {(['manual', 'auto'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} className="f1" style={{ textAlign: 'left', padding: '11px 13px', borderRadius: 10,
                border: '1.5px solid ' + (mode === m ? 'var(--accent)' : 'var(--border)'),
                background: mode === m ? 'var(--accent-ghost)' : 'var(--surface-2)', cursor: 'pointer' }}>
                <div style={{ fontWeight: 650, fontSize: 13.5 }}>{m === 'auto' ? 'Auto-increase' : 'Manual review'}</div>
                <div className="tiny muted">{m === 'auto' ? 'Raise the cap automatically when full' : 'Require admin approval of each request'}</div>
              </button>
            ))}
          </div>
          <label className="tiny muted" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Near-limit alert gap (0 = plan default)</label>
          <input
            type="number"
            className="input"
            min={0}
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            style={{ width: '100%' }}
          />
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
            <Btn variant="default" disabled={!settingsChanged || settingsPending}
              onClick={() => onSaveSettings({ seat_increase_mode: mode, seat_alert_threshold: threshold }, onClose)}>
              Save policy
            </Btn>
          </div>
        </div>
      </div>
      <div className="modal-foot">
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  );
}
