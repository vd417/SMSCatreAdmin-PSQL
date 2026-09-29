import React, { useState } from 'react';
import { useNav, useToast, Btn, Avatar, fmt } from '../components';
import { Icon } from '../lib/icons';
import { usePlans } from '../api/hooks/usePlans';
import { useTeam } from '../api/hooks/useTeam';
import { useCreateClient } from '../api/hooks/useClientMutations';
import type { ApiError } from '../api/ApiError';
import type { Plan, CreateClientBody, ClientStatus, Client } from '../api/types';
import {
  createClientPlanPayment,
  createUpgradeRazorpayOrder,
  confirmUpgradePayment,
  loadRazorpayScript,
  type UpgradeMode,
} from '../api/upgradeRequests';

type PayChoice = 'trial' | 'offline' | 'online';

type Form = {
  name: string; slug: string; city: string; address: string; size: string; status: ClientStatus;
  adminName: string; adminEmail: string; adminPhone: string;
  plan_id: string; trial: number; csm: string;
  payChoice: PayChoice;
};

const CITIES = ['Mumbai, MH', 'New Delhi, DL', 'Bengaluru, KA', 'Hyderabad, TS', 'Chennai, TN', 'Pune, MH', 'Kolkata, WB', 'Ahmedabad, GJ'];
const SIZES = ['Under 200', '200–500', '500–1,200', '1,200–5,000', '5,000+'];
const TRIAL_PRESETS: { days: number; note: string }[] = [
  { days: 7, note: 'week' }, { days: 14, note: 'default' }, { days: 30, note: 'month' },
  { days: 60, note: '2 months' }, { days: 90, note: 'quarter' }, { days: 365, note: 'year' },
];

function Field({ label, k, form, set, errors, placeholder, type = 'text', prefix, hint }: {
  label: string; k: keyof Form; form: Form; set: (k: keyof Form, v: string | number) => void;
  errors: Record<string, string>; placeholder?: string; type?: string; prefix?: string; hint?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {prefix
        ? <div className="input-group" style={{ height: 38 }}><span className="tiny muted">{prefix}</span>
            <input value={String(form[k])} onChange={e => set(k, e.target.value)} placeholder={placeholder} /></div>
        : <input className="input" type={type} value={String(form[k])} onChange={e => set(k, e.target.value)} placeholder={placeholder} />}
      {hint && !errors[k] && <span className="hint">{hint}</span>}
      {errors[k] && <span className="err">{errors[k]}</span>}
    </div>
  );
}

export function OnboardWizard(): React.ReactElement {
  const nav = useNav();
  const toast = useToast();
  const { data } = usePlans();
  const plans: Plan[] = data?.data ?? [];
  const team = useTeam();
  const create = useCreateClient();

  const salesPeople = (team.data?.data ?? []).filter(m =>
    m.status === 'active' && (m.role === 'sales' || m.role === 'admin' || m.role === 'owner'));

  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);
  const [form, setForm] = useState<Form>({
    name: '', slug: '', city: 'Mumbai, MH', address: '', size: '', status: 'trial',
    adminName: '', adminEmail: '', adminPhone: '', plan_id: plans[0]?.id ?? '', trial: 14, csm: '',
    payChoice: 'trial',
  });
  const set = (k: keyof Form, v: string | number) =>
    setForm(d => ({ ...d, [k]: v, ...(k === 'name' ? { slug: String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') } : {}) }));

  const steps = [
    { title: 'School details', desc: 'Tell us about the school' },
    { title: 'Admin contact', desc: 'Who will administer the account' },
    { title: 'Plan & payment', desc: 'Choose plan and how they pay' },
    { title: 'Trial length', desc: 'Set the evaluation period' },
    { title: 'Review', desc: 'Confirm and create' },
  ];

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (step === 0) { if (!form.name.trim()) e.name = 'School name is required'; if (!form.slug.trim()) e.slug = 'Slug is required'; }
    if (step === 1) {
      if (!form.adminName.trim()) e.adminName = 'Admin name is required';
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.adminEmail)) e.adminEmail = 'Valid email required';
    }
    if (step === 2) {
      if (!form.plan_id) e.plan_id = 'Select a plan';
      if (!form.payChoice) e.payChoice = 'Select a payment method';
    }
    setErrors(e); return Object.keys(e).length === 0;
  };
  const next = () => {
    if (!validate()) return;
    if (step === 2 && form.payChoice !== 'trial') {
      setStep(4); // skip trial length when collecting payment now
      return;
    }
    setStep(s => Math.min(s + 1, steps.length - 1));
  };
  const back = () => {
    if (step === 4 && form.payChoice !== 'trial') { setStep(2); return; }
    setStep(s => Math.max(s - 1, 0));
  };

  const afterCreatePayment = async (client: Client) => {
    const mode: UpgradeMode = form.payChoice === 'online' ? 'online' : 'offline';
    const payReq = await createClientPlanPayment(client.id, form.plan_id || plans[0]?.id || '', mode);

    if (mode === 'offline') {
      toast({
        kind: 'success',
        title: 'Client created · offline payment pending',
        msg: `${form.name} is on trial. Confirm payment under Billing → Upgrade requests, then Approve to activate.`,
      });
      nav.go('billing');
      return;
    }

    try {
      const order = await createUpgradeRazorpayOrder(payReq.id);

      const ok = await loadRazorpayScript();
      if (!ok || !window.Razorpay) {
        toast({
          kind: 'info',
          title: 'Payment not done',
          msg: 'Client created. Razorpay did not load — payment is still pending. Finish checkout later or use offline.',
        });
        nav.go('billing');
        return;
      }

      await new Promise<void>((resolve) => {
        const rzp = new window.Razorpay!({
          key: order.key_id,
          amount: order.amount_paise,
          currency: order.currency,
          name: 'SchoolMate',
          description: `Plan for ${form.name}`,
          order_id: order.order_id,
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await confirmUpgradePayment(payReq.id, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              toast({
                kind: 'success',
                title: 'Payment received',
                msg: 'Approve under Billing → Upgrade requests to activate the school plan.',
              });
            } catch (err) {
              toast({ kind: 'error', title: 'Payment confirm failed', msg: (err as ApiError).message });
            }
            resolve();
          },
          modal: {
            ondismiss: () => {
              toast({
                kind: 'info',
                title: 'Payment not completed',
                msg: 'Checkout closed — payment is still pending (not paid).',
              });
              resolve();
            },
          },
        });
        rzp.open();
      });
      nav.go('billing');
    } catch (err) {
      const ae = err as ApiError;
      toast({
        kind: 'info',
        title: ae.code === 'payment_not_configured' ? 'Payment not done' : 'Payment setup failed',
        msg: ae.code === 'payment_not_configured'
          ? 'Client created. Razorpay is not configured — payment is still pending. Use offline pay, or add keys and finish checkout. Not treated as paid.'
          : ae.message,
      });
      nav.go('billing');
    }
  };

  const submit = () => {
    const body: CreateClientBody = {
      name: form.name, slug: form.slug, country: form.city, size: form.size,
      address: form.address, status: 'trial',
      admin_name: form.adminName, admin_email: form.adminEmail, admin_phone: form.adminPhone,
      plan_id: form.plan_id || plans[0]?.id || '', trial_days: form.payChoice === 'trial' ? form.trial : 0,
      csm: form.csm || null,
    };
    setPaying(true);
    create.mutate(body, {
      onSuccess: async (client) => {
        try {
          if (form.payChoice === 'trial') {
            toast({ kind: 'success', title: 'Client created', msg: `${form.name} is now in trial.` });
            nav.go('clients');
            return;
          }
          await afterCreatePayment(client);
        } finally {
          setPaying(false);
        }
      },
      onError: (err) => {
        setPaying(false);
        toast({ kind: 'error', title: 'Could not create client', msg: (err as ApiError).message });
      },
    });
  };

  const plan = plans.find(p => p.id === form.plan_id) ?? plans[0];
  const busy = create.isPending || paying;

  return (
    <div className="page" style={{ maxWidth: 880 }}>
      <button className="row gap6 muted tiny" style={{ marginBottom: 14, fontWeight: 600 }} onClick={() => nav.go('clients')}>
        <Icon.chevLeft size={14} /> Cancel
      </button>
      <h1 className="page-title" style={{ marginBottom: 22 }}>Onboard a new client</h1>

      <div className="split split-left aside-210" style={{ gap: 28 }}>
        <div className="fc gap2">
          {steps.map((s, i) => (
            <button key={i} onClick={() => i < step && setStep(i)} className="row gap10"
              style={{ padding: '9px 10px', borderRadius: 9, textAlign: 'left', cursor: i < step ? 'pointer' : 'default', background: i === step ? 'var(--surface-2)' : 'transparent' }}>
              <span style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
                background: i < step ? 'var(--green)' : i === step ? 'var(--accent)' : 'var(--surface-3)', color: i <= step ? '#fff' : 'var(--text-3)' }}>
                {i < step ? <Icon.check size={13} /> : i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: i === step ? 'var(--text)' : 'var(--text-3)' }}>{s.title}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="card">
          <div className="card-head"><div className="f1"><h3>{steps[step].title}</h3><div className="sub">{steps[step].desc}</div></div></div>
          <div className="card-pad" style={{ minHeight: 260 }}>
            {step === 0 && (
              <div className="fc gap16">
                <Field label="School name" k="name" form={form} set={set} errors={errors} placeholder="e.g. Greenwood High" />
                <Field label="Workspace slug" k="slug" form={form} set={set} errors={errors} prefix="catre.app/" hint="Auto-generated from the name; editable." />
                <div className="grid-auto cols-200">
                  <div className="field"><label>City</label>
                    <select className="select" value={form.city} onChange={e => set('city', e.target.value)}>
                      {CITIES.map(c => <option key={c}>{c}</option>)}
                    </select></div>
                  <div className="field"><label>School size (students)</label>
                    <select className="select" value={form.size} onChange={e => set('size', e.target.value)}>
                      <option value="">Select…</option>{SIZES.map(c => <option key={c}>{c}</option>)}
                    </select></div>
                </div>
                <Field label="Address" k="address" form={form} set={set} errors={errors} placeholder="Street, area, PIN code" />
              </div>
            )}

            {step === 1 && (
              <div className="fc gap16">
                <Field label="Admin full name" k="adminName" form={form} set={set} errors={errors} placeholder="e.g. Priya Sharma" />
                <Field label="Admin email" k="adminEmail" form={form} set={set} errors={errors} type="email" placeholder="admin@school.edu" hint="They'll receive an invite to set up the account." />
                <Field label="Phone (optional)" k="adminPhone" form={form} set={set} errors={errors} placeholder="+91 90000 00000" />
                <div className="field">
                  <label>Sales / CSM</label>
                  <select className="select" value={form.csm} onChange={e => set('csm', e.target.value)}>
                    <option value="">Unassigned</option>
                    {salesPeople.map(m => (
                      <option key={m.id} value={m.name}>{m.name} ({m.role})</option>
                    ))}
                  </select>
                  <span className="hint">Assign a sales or admin teammate as CSM for this school.</span>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="fc gap16">
                <div className="fc gap10">
                  {plans.map(p => (
                    <button key={p.id} onClick={() => set('plan_id', p.id)}
                      style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                        border: '1.5px solid ' + (form.plan_id === p.id ? 'var(--accent)' : 'var(--border)'),
                        background: form.plan_id === p.id ? 'var(--accent-ghost)' : 'var(--surface-2)' }}>
                      <div className="row jb">
                        <div className="row gap10"><span style={{ width: 11, height: 11, borderRadius: 3, background: p.color }} />
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</span></div>
                        <span className="mono" style={{ fontWeight: 700 }}>{fmt.money(p.price)}<span className="tiny muted">/mo</span></span>
                      </div>
                      <div className="tiny muted" style={{ marginTop: 6 }}>{p.description}</div>
                      <div className="tiny muted mono" style={{ marginTop: 8 }}>{fmt.num(p.limits.students)} students · {fmt.num(p.limits.staff)} staff · {p.limits.storage_gb} GB</div>
                    </button>
                  ))}
                  {errors.plan_id && <span className="err">{errors.plan_id}</span>}
                </div>

                <div>
                  <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>Payment method</label>
                  <div className="fc gap8" style={{ marginTop: 10 }}>
                    {([
                      { value: 'trial' as const, title: 'Start on trial', desc: 'No payment now. Activate later from the client page.' },
                      { value: 'offline' as const, title: 'Pay offline', desc: 'Bank / NEFT / cheque. Approve under Billing → Upgrade requests after money is received.' },
                      { value: 'online' as const, title: 'Pay online (Razorpay)', desc: 'Collect payment now, then Approve to activate the plan.' },
                    ]).map(opt => (
                      <button key={opt.value} type="button" onClick={() => set('payChoice', opt.value)}
                        style={{ textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                          border: '1.5px solid ' + (form.payChoice === opt.value ? 'var(--accent)' : 'var(--border)'),
                          background: form.payChoice === opt.value ? 'var(--accent-ghost)' : 'var(--surface-2)' }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{opt.title}</div>
                        <div className="tiny muted" style={{ marginTop: 4 }}>{opt.desc}</div>
                      </button>
                    ))}
                  </div>
                  {errors.payChoice && <span className="err">{errors.payChoice}</span>}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>Trial length</label>
                <div className="row gap8 fw" style={{ marginTop: 12 }}>
                  {TRIAL_PRESETS.map(({ days, note }) => (
                    <button key={days} onClick={() => set('trial', days)} className={'chip' + (form.trial === days ? ' active' : '')}
                      style={{ height: 'auto', padding: '14px 20px', flexDirection: 'column' }}>
                      <span className="mono" style={{ fontSize: 22, fontWeight: 750, color: form.trial === days ? 'var(--accent-text)' : 'var(--text)' }}>{days}</span>
                      <span className="tiny">days · {note}</span>
                    </button>
                  ))}
                </div>
                <div className="field" style={{ marginTop: 16, maxWidth: 220 }}>
                  <label>Custom length</label>
                  <div className="input-group" style={{ height: 38 }}>
                    <input type="text" inputMode="numeric" placeholder="Custom days"
                      value={TRIAL_PRESETS.some(p => p.days === form.trial) ? '' : (form.trial || '')}
                      onChange={e => { const n = Number(e.target.value.trim()); if (e.target.value.trim() === '' || !Number.isNaN(n)) set('trial', e.target.value.trim() === '' ? 0 : n); }} />
                    <span className="tiny muted">days</span>
                  </div>
                </div>
                <p className="tiny muted" style={{ marginTop: 16 }}>The trial begins immediately. The client can be activated any time before it ends.</p>
              </div>
            )}

            {step === 4 && (
              <div className="fc gap16">
                <div className="row gap12" style={{ padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border-soft)' }}>
                  <Avatar name={form.name || 'New School'} size={44} square />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{form.name || 'Untitled School'}</div>
                    <div className="tiny muted mono">catre.app/{form.slug || 'slug'}</div>
                  </div>
                </div>
                <dl className="dl">
                  <dt>City</dt><dd>{form.city}</dd>
                  <dt>Address</dt><dd>{form.address || '—'}</dd>
                  <dt>Admin</dt><dd>{form.adminName || '—'} · {form.adminEmail || '—'}</dd>
                  <dt>CSM</dt><dd>{form.csm || 'Unassigned'}</dd>
                  <dt>Plan</dt><dd>{plan ? `${plan.name} · ${fmt.money(plan.price)}/mo` : '—'}</dd>
                  <dt>Payment</dt>
                  <dd>
                    {form.payChoice === 'trial' && `Trial · ${form.trial} days (no payment now)`}
                    {form.payChoice === 'offline' && 'Offline (approve after payment received)'}
                    {form.payChoice === 'online' && 'Razorpay (collect now, then approve)'}
                  </dd>
                  <dt>First charge</dt>
                  <dd>
                    {form.payChoice === 'trial' ? 'After trial ends / activation' : plan ? fmt.money(plan.price) + '/mo on approval' : '—'}
                  </dd>
                </dl>
                <div className="row gap10" style={{ padding: '11px 14px', background: 'var(--accent-ghost)', borderRadius: 10, color: 'var(--accent-text)', fontSize: 12.5 }}>
                  <Icon.info size={15} /> An invite email will be sent to the admin to complete setup.
                </div>
              </div>
            )}
          </div>

          <div className="modal-foot between" style={{ borderTop: '1px solid var(--border-soft)' }}>
            <div>{step > 0 && <Btn variant="ghost" icon={Icon.chevLeft} onClick={back}>Back</Btn>}</div>
            {step < steps.length - 1
              ? <Btn variant="primary" onClick={next}>Continue <Icon.arrowRight size={16} /></Btn>
              : <Btn variant="primary" icon={Icon.rocket} disabled={busy} onClick={submit}>
                  {busy ? 'Working…' : form.payChoice === 'online' ? 'Create & collect payment' : form.payChoice === 'offline' ? 'Create & request offline payment' : 'Create client'}
                </Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}
