import React, { useState } from 'react';
import { usePlans } from '../../api/hooks/usePlans';
import { useCreatePlan, useUpdatePlan, usePublishPlan } from '../../api/hooks/usePlanMutations';
import { useAuth } from '../../auth/AuthContext';
import { useToast, Btn, fmt } from '../index';
import { Icon } from '../../lib/icons';
import { FEATURE_LABELS } from '../../lib/featureCatalog';
import { isPerStudent } from '../../lib/planPricing';
import { PlanEditModal } from './PlanEditModal';
import type { PlanDraft } from './PlanEditModal';
import { QueryBoundary } from '../QueryBoundary';
import type { ApiError } from '../../api/ApiError';
import type { Plan, CreatePlanBody } from '../../api/types';

const BLANK_SEED: PlanDraft = {
  name: '',
  band: '',
  pricing: 'flat',
  price: 0,
  per_student: 10,
  min_students: 100,
  period: 'month',
  limits: { students: 0, staff: 0, storage_gb: 0 },
  features: [],
  feature_tiers: {},
  visibility: 'draft',
  audience: 'all',
  offer: null,
};

const AUD: Record<string, { label: string; cls: string }> = {
  all:       { label: 'Public',    cls: 'badge-slate' },
  new:       { label: 'New schools', cls: 'badge-blue' },
  exclusive: { label: 'Exclusive', cls: 'badge-violet' },
};

export function planToDraft(p: Plan): PlanDraft {
  return {
    id: p.id,
    name: p.name,
    band: p.band,
    // Canonicalise: the API may store mixed case (e.g. 'Per_Student'), but the edit
    // modal keys its segmented control on the exact literal. Saving writes it back clean.
    pricing: isPerStudent(p) ? 'per_student' : 'flat',
    price: p.price,
    per_student: p.per_student,
    min_students: p.min_students,
    period: p.period,
    limits: {
      students: (p.limits as { students: number; staff: number; storage_gb: number }).students,
      staff: (p.limits as { students: number; staff: number; storage_gb: number }).staff,
      storage_gb: (p.limits as { students: number; staff: number; storage_gb: number }).storage_gb,
    },
    features: [...p.features],
    feature_tiers: {},
    visibility: p.visibility as 'published' | 'draft',
    audience: p.audience as 'all' | 'new' | 'exclusive',
    offer: p.offer,
  };
}

const TABS: [string, string][] = [
  ['all', 'All plans'],
  ['published', 'Published'],
  ['unpublished', 'Unpublished'],
  ['new', 'New client'],
  ['existing', 'Existing client'],
  ['exclusive', 'Exclusive'],
];

export function PlansTab(): React.ReactElement {
  const query = usePlans();
  const plans: Plan[] = query.data?.data ?? [];
  const { can } = useAuth();
  const manage = can('plans.manage');
  const toast = useToast();

  const createPlan = useCreatePlan();

  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<PlanDraft | null>(null);

  const list = plans.filter(p =>
    filter === 'all'        ? true :
    filter === 'published'  ? p.visibility === 'published' :
    filter === 'unpublished'? p.visibility === 'draft' :
    filter === 'new'        ? p.audience === 'new' :
    filter === 'existing'   ? p.audience === 'all' :
    filter === 'exclusive'  ? p.audience === 'exclusive' : true
  );

  const counts: Record<string, number> = {
    all:        plans.length,
    published:  plans.filter(p => p.visibility === 'published').length,
    unpublished:plans.filter(p => p.visibility === 'draft').length,
    new:        plans.filter(p => p.audience === 'new').length,
    existing:   plans.filter(p => p.audience === 'all').length,
    exclusive:  plans.filter(p => p.audience === 'exclusive').length,
  };

  const priceLabel = (p: Plan) => isPerStudent(p)
    ? { big: fmt.money(p.per_student), small: ' / student / mo' }
    : { big: fmt.money(p.price),       small: ' / ' + p.period };

  function handleSaveNew(body: CreatePlanBody) {
    createPlan.mutate(body, {
      onSuccess: () => {
        toast({ title: 'Plan created', msg: body.name, kind: 'success' });
        setEditing(null);
      },
      onError: (e) => {
        toast({ title: 'Error', msg: (e as ApiError).message, kind: 'error' });
      },
    });
  }

  function PlanCard({ p }: { p: Plan }) {
    const updatePlan = useUpdatePlan(p.id);
    const pub = usePublishPlan(p.id);
    const pr = priceLabel(p);
    const audMeta = AUD[p.audience] ?? AUD['all'];

    function handleSaveEdit(body: CreatePlanBody) {
      updatePlan.mutate(body, {
        onSuccess: () => {
          toast({ title: 'Plan saved', msg: body.name + (body.visibility === 'published' ? ' · published' : ' · draft') });
          setEditing(null);
        },
        onError: (e) => {
          toast({ title: 'Error', msg: (e as ApiError).message, kind: 'error' });
        },
      });
    }

    function handlePublish() {
      const willPublish = p.visibility !== 'published';
      pub.mutate(willPublish, {
        onSuccess: () => {
          toast({ title: willPublish ? 'Plan published' : 'Plan unpublished', msg: p.name, kind: 'info' });
        },
        onError: (e) => {
          toast({ title: 'Error', msg: (e as ApiError).message, kind: 'error' });
        },
      });
    }

    return (
      <div className="card" style={{ position: 'relative', borderColor: p.visibility === 'draft' ? 'var(--amber-line)' : undefined }}>
        <div className="card-pad">
          {/* Header: name + color swatch */}
          <div className="row jb gap8">
            <div className="row gap8" style={{ minWidth: 0 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: p.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>{p.name}</span>
            </div>
          </div>

          {/* Badges */}
          <div className="row gap6 fw" style={{ marginTop: 8 }}>
            <span className={'badge ' + (p.visibility === 'published' ? 'badge-green badge-dot-green' : 'badge-amber badge-dot-amber')}>
              <span className="dot" />
              {p.visibility === 'published' ? 'Published' : 'Draft'}
            </span>
            <span className={'badge ' + audMeta.cls}>{audMeta.label}</span>
            {isPerStudent(p) && <span className="badge badge-blue">Metered</span>}
          </div>

          {/* Price */}
          <div style={{ margin: '12px 0 6px' }}>
            <span className="mono" style={{ fontSize: 26, fontWeight: 750 }}>{pr.big}</span>
            <span className="muted tiny">{pr.small}</span>
          </div>

          {/* Offer */}
          {p.offer && (
            <div className="row gap6" style={{ padding: '6px 9px', background: 'var(--green-bg)', borderRadius: 7, color: 'var(--green)', fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>
              <Icon.zap size={12} />
              {p.offer.label}
            </div>
          )}

          {/* Description */}
          <p className="tiny muted" style={{ minHeight: 30 }}>{p.description}</p>

          {/* Band */}
          <div className="tiny muted row gap6" style={{ marginTop: 4 }}>
            <Icon.cap size={13} />
            {p.band}
          </div>

          <div className="divider" style={{ margin: '12px 0' }} />

          {/* Limits */}
          <div className="fc gap8">
            {([
              ['Students', isPerStudent(p) ? 'min ' + fmt.num(p.min_students) : fmt.num((p.limits as Record<string, number>).students)],
              ['Staff',    fmt.num((p.limits as Record<string, number>).staff)],
              ['Storage',  (p.limits as Record<string, number>).storage_gb + ' GB'],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="row jb tiny">
                <span className="muted">{k}</span>
                <span className="mono" style={{ fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="divider" style={{ margin: '12px 0' }} />

          {/* Features */}
          <div className="fc gap6">
            {p.features.slice(0, 4).map(f => (
              <div key={f} className="row gap6 tiny">
                <Icon.check size={13} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <span className="muted truncate">{FEATURE_LABELS[f] || f}</span>
              </div>
            ))}
            {p.features.length > 4 && (
              <div className="tiny muted" style={{ paddingLeft: 19 }}>+ {p.features.length - 4} more</div>
            )}
          </div>

          {/* Actions */}
          {manage && (
            <div className="row gap8 fw" style={{ marginTop: 14 }}>
              <Btn
                variant={p.visibility === 'draft' ? 'primary' : 'default'}
                size="sm"
                icon={p.visibility === 'draft' ? Icon.upload : Icon.eyeOff}
                onClick={handlePublish}
              >
                {p.visibility === 'published' ? 'Unpublish' : 'Publish'}
              </Btn>
              <Btn
                variant="default"
                size="sm"
                icon={Icon.edit}
                onClick={() => setEditing(planToDraft(p))}
              >
                Edit
              </Btn>
            </div>
          )}
        </div>

        {/* Edit modal for this card (rendered inline so useUpdatePlan(p.id) is scoped) */}
        {editing?.id === p.id && (
          <PlanEditModal
            plan={editing}
            onClose={() => setEditing(null)}
            onSave={handleSaveEdit}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs + New plan button */}
      <div className="row jb fw gap12" style={{ marginBottom: 18, alignItems: 'flex-end' }}>
        <div className="tabs" style={{ border: 'none', flexWrap: 'wrap' }}>
          {TABS.map(([k, l]) => (
            <button
              key={k}
              className={'tab' + (filter === k ? ' active' : '')}
              onClick={() => setFilter(k)}
            >
              {l}
              <span className="tab-count">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="row gap8">
          <p className="muted tiny" style={{ alignSelf: 'center' }}>
            {manage ? 'School modules drive capabilities.' : 'Read-only — Finance/Owner edit plans.'}
          </p>
          {manage && (
            <Btn
              variant="primary"
              size="sm"
              icon={Icon.plus}
              onClick={() => setEditing(BLANK_SEED)}
            >
              New plan
            </Btn>
          )}
        </div>
      </div>

      {/* Plan card grid wrapped in QueryBoundary */}
      <QueryBoundary
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={!query.isLoading && plans.length === 0}
        emptyTitle="No plans"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {list.map(p => (
            <PlanCard key={p.id} p={p} />
          ))}
        </div>
      </QueryBoundary>

      {/* New plan modal */}
      {editing && !editing.id && (
        <PlanEditModal
          plan={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveNew}
        />
      )}
    </div>
  );
}
