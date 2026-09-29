import React, { useState } from 'react';
import { Modal, Btn } from '../index';
import { Icon } from '../../lib/icons';
import {
  FEATURE_LABELS, FEATURE_NOTE, FEATURE_GROUPS, TIER_META, FEATURE_TIER,
  featuresForTier,
} from '../../lib/featureCatalog';
import type { FeatureTier } from '../../lib/featureCatalog';
import type { CreatePlanBody } from '../../api/types';

export type PlanDraft = {
  name: string;
  band: string;
  pricing: 'flat' | 'per_student';
  price: number;
  per_student: number;
  min_students: number;
  period: string;
  limits: { students: number; staff: number; storage_gb: number };
  features: string[];
  feature_tiers: Record<string, string>;
  visibility: 'published' | 'draft';
  audience: 'all' | 'new' | 'exclusive';
  offer: { label: string; pct: number } | null;
  id?: string;
};

type Props = {
  plan: PlanDraft;
  onClose: () => void;
  onSave: (body: CreatePlanBody) => void;
};

const NUM = 'Greater than 0';

/** Plan-level tier = the highest tier among selected features (override wins), else silver.
 *  The backend requires a non-null `tier`; the UI models capability per-feature, so we derive it. */
function deriveTier(features: string[], featureTiers: Record<string, string>): FeatureTier {
  let rank = TIER_META.silver.rank;
  for (const f of features) {
    const t = (featureTiers[f] || FEATURE_TIER[f]) as FeatureTier;
    const r = TIER_META[t]?.rank ?? rank;
    if (r > rank) rank = r;
  }
  return (Object.keys(TIER_META) as FeatureTier[]).find(k => TIER_META[k].rank === rank) ?? 'silver';
}

/** Required-field rules. Returns a map of field key -> message; empty when valid. */
function validate(d: PlanDraft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.name.trim()) e.name = 'Required';
  if (!d.band.trim()) e.band = 'Required';
  if (d.pricing === 'flat') {
    if (!(d.price > 0)) e.price = NUM;
  } else {
    if (!(d.per_student > 0)) e.per_student = NUM;
    if (!(d.min_students > 0)) e.min_students = NUM;
  }
  if (d.offer) {
    if (!d.offer.label.trim()) e.offer_label = 'Required';
    if (!(d.offer.pct > 0)) e.offer_pct = NUM;
  }
  (['students', 'staff', 'storage_gb'] as const).forEach(k => {
    if (!(d.limits[k] > 0)) e['limits_' + k] = NUM;
  });
  return e;
}

export function PlanEditModal({ plan, onClose, onSave }: Props): React.ReactElement {
  const [p, setP] = useState<PlanDraft>({
    ...plan,
    limits: { ...plan.limits },
    features: [...plan.features],
    feature_tiers: { ...plan.feature_tiers },
    offer: plan.offer ? { ...plan.offer } : null,
  });

  // Errors surface only after the first Save attempt, then update live as fields are fixed.
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validate(p) : {};

  const errStyle = (k: string): React.CSSProperties | undefined =>
    errors[k] ? { borderColor: 'var(--red-line)' } : undefined;

  // Numeric fields rendered as text inputs: show blank (not 0) when unset, parse digits on input.
  const numProps = (val: number, onNum: (n: number) => void, errKey: string) => ({
    className: 'input mono',
    type: 'text' as const,
    inputMode: 'decimal' as const,
    placeholder: '0',
    value: val === 0 ? '' : String(val),
    style: errStyle(errKey),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.trim();
      if (raw === '') { onNum(0); return; }
      const n = Number(raw);
      if (!Number.isNaN(n)) onNum(n);
    },
  });

  function handleSave() {
    setSubmitted(true);
    if (Object.keys(validate(p)).length === 0)
      onSave({ ...p, tier: deriveTier(p.features, p.feature_tiers) } as CreatePlanBody);
  }

  const toggleFeat = (f: string) =>
    setP(s => ({ ...s, features: s.features.includes(f) ? s.features.filter(x => x !== f) : [...s.features, f] }));

  const set = (patch: Partial<PlanDraft>) => setP(s => ({ ...s, ...patch }));

  const getTier = (code: string): string =>
    (p.feature_tiers && p.feature_tiers[code]) || FEATURE_TIER[code];

  const setFeatTier = (code: string, tier: string) =>
    setP(s => {
      const inc = s.features.includes(code);
      const cur = (s.feature_tiers && s.feature_tiers[code]) || FEATURE_TIER[code];
      const ft = { ...(s.feature_tiers || {}) };
      if (inc && cur === tier) {
        delete ft[code];
        return { ...s, features: s.features.filter(x => x !== code), feature_tiers: ft };
      }
      ft[code] = tier;
      return { ...s, features: inc ? s.features : [...s.features, code], feature_tiers: ft };
    });

  const seg = (key: keyof PlanDraft, value: string, label: string) => (
    <button
      className={'chip' + (p[key] === value ? ' active' : '')}
      style={{ height: 34 }}
      onClick={() => set({ [key]: value })}
    >
      {label}
    </button>
  );

  // Tier copy shortcuts — one button per tier
  const TIER_KEYS: FeatureTier[] = ['silver', 'gold', 'platinum'];

  return (
    <Modal open={true} onClose={onClose} size="lg">
      <div className="modal-head">
        <div className="mh-ic" style={{ background: 'var(--accent-ghost)', color: 'var(--accent)' }}>
          <Icon.plans size={19} />
        </div>
        <div className="mh-text">
          <h3>{plan.id ? 'Edit plan' : 'New plan'}</h3>
          <p>Pricing, offer, visibility &amp; capabilities.</p>
        </div>
      </div>

      <div className="modal-body">
        {/* Name + Band */}
        <div className="grid-auto cols-200">
          <div className="field">
            <label>Plan name</label>
            <input className="input" value={p.name} style={errStyle('name')} onChange={e => set({ name: e.target.value })} />
            {errors.name && <span className="err">{errors.name}</span>}
          </div>
          <div className="field">
            <label>Size band</label>
            <input
              className="input"
              value={p.band}
              style={errStyle('band')}
              placeholder="e.g. Under 200"
              onChange={e => set({ band: e.target.value })}
            />
            {errors.band && <span className="err">{errors.band}</span>}
          </div>
        </div>

        {/* Pricing model */}
        <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', display: 'block', margin: '16px 0 8px' }}>
          Pricing model
        </label>
        <div className="row gap8" style={{ marginBottom: 12 }}>
          {seg('pricing', 'flat', 'Flat monthly')}
          {seg('pricing', 'per_student', 'Per‑student')}
        </div>
        {p.pricing === 'flat' ? (
          <div className="field" style={{ maxWidth: 220 }}>
            <label>Price (₹/month)</label>
            <input {...numProps(p.price, v => set({ price: v }), 'price')} />
            {errors.price && <span className="err">{errors.price}</span>}
          </div>
        ) : (
          <div className="grid-auto cols-160" style={{ maxWidth: 360 }}>
            <div className="field">
              <label>₹ / student / mo</label>
              <input {...numProps(p.per_student, v => set({ per_student: v }), 'per_student')} />
              {errors.per_student && <span className="err">{errors.per_student}</span>}
            </div>
            <div className="field">
              <label>Min students</label>
              <input {...numProps(p.min_students, v => set({ min_students: v }), 'min_students')} />
              {errors.min_students && <span className="err">{errors.min_students}</span>}
            </div>
          </div>
        )}

        {/* Promotional offer */}
        <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', display: 'block', margin: '16px 0 8px' }}>
          Promotional offer
        </label>
        <div className="row gap8">
          <button
            className={'switch' + (p.offer ? ' on' : '')}
            onClick={() => set({ offer: p.offer ? null : { label: 'Launch offer', pct: 20 } })}
          />
          <span className="tiny muted">{p.offer ? 'Offer attached' : 'No active offer'}</span>
        </div>
        {p.offer && (
          <div className="grid-auto cols-200" style={{ marginTop: 10 }}>
            <div className="field">
              <label>Offer label</label>
              <input
                className="input"
                value={p.offer.label}
                style={errStyle('offer_label')}
                onChange={e => set({ offer: { ...p.offer!, label: e.target.value } })}
              />
              {errors.offer_label && <span className="err">{errors.offer_label}</span>}
            </div>
            <div className="field">
              <label>Discount %</label>
              <input {...numProps(p.offer.pct, v => set({ offer: { ...p.offer!, pct: v } }), 'offer_pct')} />
              {errors.offer_pct && <span className="err">{errors.offer_pct}</span>}
            </div>
          </div>
        )}

        {/* Availability + Visibility */}
        <div className="grid-auto cols-200" style={{ marginTop: 16 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>
              Availability
            </label>
            <div className="row gap8 fw">
              {seg('audience', 'all', 'Public')}
              {seg('audience', 'new', 'New only')}
              {seg('audience', 'exclusive', 'Exclusive')}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>
              Visibility
            </label>
            <div className="row gap8">
              {seg('visibility', 'published', 'Published')}
              {seg('visibility', 'draft', 'Draft')}
            </div>
          </div>
        </div>

        {/* Limits */}
        <div className="grid-auto cols-160" style={{ marginTop: 16 }}>
          {(['students', 'staff', 'storage_gb'] as const).map(k => (
            <div key={k} className="field">
              <label>{k === 'storage_gb' ? 'Storage (GB)' : k[0].toUpperCase() + k.slice(1)}</label>
              <input {...numProps(p.limits[k], v => set({ limits: { ...p.limits, [k]: v } }), 'limits_' + k)} />
              {errors['limits_' + k] && <span className="err">{errors['limits_' + k]}</span>}
            </div>
          ))}
        </div>

        {/* School modules header */}
        <div className="row jb fw gap8" style={{ margin: '18px 0 10px', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', display: 'block' }}>
              School modules
            </label>
            <span className="tiny muted">
              Add a module, then tap Silver / Gold / Platinum to set the tier it unlocks at.
            </span>
          </div>
          <span className="badge badge-accent" style={{ height: 20 }}>
            {p.features.length} selected
          </span>
        </div>

        {/* Tier copy shortcuts */}
        <div
          className="row gap8 fw"
          style={{
            marginBottom: 6,
            padding: '10px 12px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border-soft)',
            borderRadius: 9,
            alignItems: 'center',
          }}
        >
          <span className="tiny muted" style={{ fontWeight: 600 }}>Add tier modules:</span>
          {TIER_KEYS.map(t => (
            <button
              key={t}
              className="chip"
              style={{ height: 30 }}
              onClick={() => set({ features: Array.from(new Set([...p.features, ...featuresForTier(t)])) })}
            >
              <span style={{ width: 8, height: 8, borderRadius: 2, background: TIER_META[t].color }} />
              {'+ ' + TIER_META[t].label}
            </button>
          ))}
          <button className="chip" style={{ height: 30 }} onClick={() => set({ features: [] })}>
            Clear
          </button>
        </div>

        {/* Tier legend */}
        <div className="row gap12 fw" style={{ marginBottom: 14, paddingLeft: 2 }}>
          {TIER_KEYS.map(t => (
            <span key={t} className="row gap5" style={{ alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: TIER_META[t].color }} />
              <span className="tiny muted">
                Unlocks at <b style={{ color: 'var(--text-2)' }}>{TIER_META[t].label}</b>
              </span>
            </span>
          ))}
        </div>

        {/* Feature groups */}
        {FEATURE_GROUPS.map(grp => {
          const selCount = grp.codes.filter(c => p.features.includes(c)).length;
          return (
            <div key={grp.title} style={{ marginBottom: 14 }}>
              <div className="row gap8" style={{ margin: '4px 0 8px', alignItems: 'center' }}>
                <span
                  className="tiny"
                  style={{
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: 'var(--text-faint)',
                  }}
                >
                  {grp.title}
                </span>
                <span className="tiny muted">{selCount}/{grp.codes.length}</span>
                <div className="divider f1" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {grp.codes.map(code => {
                  const label = FEATURE_LABELS[code];
                  if (!label) return null;
                  const on = p.features.includes(code);
                  const curTier = getTier(code);
                  return (
                    <div
                      key={code}
                      className="row gap8"
                      style={{
                        padding: '9px 11px',
                        borderRadius: 9,
                        border: '1px solid ' + (on ? 'var(--accent-line)' : 'var(--border)'),
                        background: on ? 'var(--accent-ghost)' : 'var(--surface-2)',
                        alignItems: 'flex-start',
                      }}
                    >
                      <button
                        onClick={() => toggleFeat(code)}
                        title={on ? 'Remove module' : 'Add module'}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 5,
                          flexShrink: 0,
                          marginTop: 1,
                          display: 'grid',
                          placeItems: 'center',
                          border: 'none',
                          cursor: 'pointer',
                          background: on ? 'var(--accent)' : 'var(--surface-3)',
                          color: '#fff',
                        }}
                      >
                        {on && <Icon.check size={10} />}
                      </button>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</div>
                        <div className="tiny muted truncate" style={{ marginTop: 1, marginBottom: 6 }}>
                          {FEATURE_NOTE[code]}
                        </div>
                        <div
                          className="row"
                          style={{
                            gap: 3,
                            border: '1px solid var(--border)',
                            borderRadius: 7,
                            padding: 2,
                            width: 'fit-content',
                            background: 'var(--surface)',
                          }}
                        >
                          {TIER_KEYS.map(t => {
                            const active = on && curTier === t;
                            return (
                              <button
                                key={t}
                                title={'Include in ' + TIER_META[t].label}
                                onClick={() => setFeatTier(code, t)}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: '.02em',
                                  padding: '3px 9px',
                                  borderRadius: 5,
                                  border: 'none',
                                  cursor: 'pointer',
                                  transition: 'all .12s',
                                  background: active ? TIER_META[t].color : 'transparent',
                                  color: active ? '#fff' : 'var(--text-3)',
                                }}
                              >
                                {TIER_META[t].label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="modal-foot">
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" onClick={handleSave}>Save plan</Btn>
      </div>
    </Modal>
  );
}

