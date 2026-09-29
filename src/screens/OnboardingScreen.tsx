/* ============================================================
   Onboarding — Kanban pipeline (drag between columns + checklist)
   ============================================================ */
import { useState } from 'react';
import { fmt, Avatar, Btn, useNav, useToast } from '../components';
import { Icon } from '../lib/icons';
import { useAuth } from '../auth/AuthContext';
import { QueryBoundary } from '../components/QueryBoundary';
import { useOnboarding } from '../api/hooks/useOnboarding';
import { useAdvanceOnboarding, usePatchChecklist } from '../api/hooks/useOnboardingMutations';
import type { ApiError } from '../api/ApiError';
import type { OnboardingCard, OnboardingStage } from '../api/types';

const COLS = [
  { key: 'lead',       title: 'Lead',       color: 'var(--slate)' },
  { key: 'trial',      title: 'Trial',      color: 'var(--amber)' },
  { key: 'onboarding', title: 'Onboarding', color: 'var(--blue)'  },
  { key: 'active',     title: 'Active',     color: 'var(--green)' },
] as const;

type ColKey = typeof COLS[number]['key'];

/* ---- nested Card component (no hooks — receives handlers as props) ---- */
type CardProps = {
  card: OnboardingCard;
  colKey: ColKey;
  manage: boolean;
  dragId: string | null;
  onDragStart: (id: string, from: ColKey) => void;
  onDragEnd: () => void;
  onToggle: (card: OnboardingCard, i: number) => void;
};

function Card({ card, colKey, manage, dragId, onDragStart, onDragEnd, onToggle }: CardProps) {
  const checklist = card.checklist ?? [];
  const owner = card.owner ?? '';
  const doneCount = checklist.filter(it => it.done).length;
  const pct = checklist.length > 0 ? Math.round(doneCount / checklist.length * 100) : 0;
  const [expand, setExpand] = useState(false);

  return (
    <div
      className="card"
      draggable={manage}
      onDragStart={(e) => { onDragStart(card.id, colKey); e.dataTransfer.effectAllowed = 'move'; }}
      onDragEnd={onDragEnd}
      style={{ padding: 12, cursor: manage ? 'grab' : 'default', opacity: dragId === card.id ? 0.4 : 1, marginBottom: 9 }}
    >
      <div className="row jb gap8">
        <div className="row gap8" style={{ minWidth: 0 }}>
          <Avatar name={card.name} size={26} square={true} />
          <div style={{ minWidth: 0 }}>
            <div className="truncate cell-name">{card.name}</div>
            <div className="tiny muted mono">{fmt.money(card.value)}/mo</div>
          </div>
        </div>
        {manage && (
          <span style={{ color: 'var(--text-faint)', cursor: 'grab' }}>
            <Icon.drag size={14} />
          </span>
        )}
      </div>

      {(card.contact_name || card.contact_email || card.contact_phone || card.address) && (
        <div className="fc gap2" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
          {card.contact_name && (
            <div className="row gap6 tiny muted"><Icon.user size={12} /><span className="truncate">{card.contact_name}</span></div>
          )}
          {card.contact_email && (
            <div className="row gap6 tiny muted"><Icon.mail size={12} /><span className="truncate">{card.contact_email}</span></div>
          )}
          {card.contact_phone && (
            <div className="row gap6 tiny muted"><Icon.phone size={12} /><span className="truncate">{card.contact_phone}</span></div>
          )}
          {card.address && (
            <div className="row gap6 tiny muted"><Icon.building size={12} /><span className="truncate">{card.address}</span></div>
          )}
        </div>
      )}

      <div className="row gap8" style={{ marginTop: 10 }}>
        <div className="bar" style={{ flex: 1 }}>
          <span style={{ width: pct + '%', background: pct === 100 ? 'var(--green)' : 'var(--accent)' }} />
        </div>
        <span className="tiny mono muted">{doneCount}/{checklist.length}</span>
      </div>

      <button
        className="row gap6 tiny muted"
        style={{ marginTop: 10, fontWeight: 600 }}
        onClick={() => setExpand(e => !e)}
      >
        <Icon.checkCircle size={13} />
        {expand ? 'Hide checklist' : 'Checklist'}
        <Icon.chevDown size={12} style={{ transform: expand ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {expand && (
        <div className="fc gap2" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
          {checklist.map((it, i) => (
            <button
              key={i}
              className="row gap8"
              style={{ padding: '5px 4px', textAlign: 'left', cursor: manage ? 'pointer' : 'default' }}
              onClick={() => onToggle(card, i)}
            >
              <span style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center', background: it.done ? 'var(--green)' : 'var(--surface-3)', border: it.done ? 'none' : '1px solid var(--border)', color: '#fff' }}>
                {it.done && <Icon.check size={10} />}
              </span>
              <span className="tiny" style={{ color: it.done ? 'var(--text-3)' : 'var(--text-2)', textDecoration: it.done ? 'line-through' : 'none' }}>
                {it.label}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="row jb" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-soft)' }}>
        <span className="row gap6 tiny muted">
          <Avatar name={owner} size={18} />
          {owner.split(' ')[0]}
        </span>
        <span className="tiny muted">{card.age}d</span>
      </div>
    </div>
  );
}

/* ---- OnboardingScreen ---- */
export function OnboardingScreen() {
  const nav = useNav();
  const toast = useToast();
  const { can } = useAuth();
  const manage = can('onboarding.manage');

  const board = useOnboarding();
  const advance = useAdvanceOnboarding();
  const patch = usePatchChecklist();

  const [drag, setDrag] = useState<{ id: string; from: ColKey } | null>(null);
  const [dragOver, setDragOver] = useState<ColKey | null>(null);

  // Group cards by stage
  const cards = board.data?.data ?? [];
  const byStage = Object.fromEntries(COLS.map(c => [c.key, [] as OnboardingCard[]])) as Record<ColKey, OnboardingCard[]>;
  for (const card of cards) {
    if (byStage[card.stage as ColKey]) byStage[card.stage as ColKey].push(card);
  }

  const handleDragStart = (id: string, from: ColKey) => setDrag({ id, from });
  const handleDragEnd = () => { setDrag(null); setDragOver(null); };

  const handleDrop = (col: typeof COLS[number]) => {
    if (!drag || !manage) return;
    if (drag.from === col.key) { setDrag(null); setDragOver(null); return; }
    advance.mutate(
      { id: drag.id, stage: col.key as OnboardingStage },
      {
        onSuccess: () => toast({ title: 'Moved to ' + col.title, msg: 'Pipeline updated.' }),
        onError: (e) => toast({ kind: 'error', title: 'Move failed', msg: (e as ApiError).message }),
      }
    );
    setDragOver(null);
  };

  const handleToggle = (card: OnboardingCard, i: number) => {
    if (!manage) return;
    const item = card.checklist?.[i];
    if (!item) return;
    patch.mutate(
      { id: card.id, label: item.label, done: !item.done },
      { onError: (e) => toast({ kind: 'error', title: 'Update failed', msg: (e as ApiError).message }) }
    );
  };

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div className="ph-text">
          <h1 className="page-title">Onboarding pipeline</h1>
          <p className="page-desc">{manage ? 'Drag cards between stages and tick setup tasks.' : 'Read-only view of the onboarding pipeline.'}</p>
        </div>
        <div className="page-actions">
          {can('clients.start_trial') && (
            <Btn variant="primary" icon={Icon.plus} onClick={() => nav.go('onboard')}>New client</Btn>
          )}
        </div>
      </div>

      <QueryBoundary isLoading={board.isLoading} isError={board.isError} error={board.error}>
        <div className="grid-auto cols-240">
          {COLS.map(col => (
            <div
              key={col.key}
              onDragOver={(e) => { if (manage) { e.preventDefault(); setDragOver(col.key); } }}
              onDrop={(e) => { e.preventDefault(); handleDrop(col); }}
              style={{
                background: dragOver === col.key ? 'var(--surface-2)' : 'transparent',
                borderRadius: 12,
                padding: 8,
                transition: 'background .12s',
                minHeight: 120,
                outline: dragOver === col.key ? '1.5px dashed var(--accent-line)' : '1.5px solid transparent',
              }}
            >
              <div className="row jb" style={{ padding: '4px 8px 12px' }}>
                <span className="row gap8 col-title">
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: col.color }} />
                  {col.title}
                </span>
                <span className="badge badge-slate">{byStage[col.key].length}</span>
              </div>

              {byStage[col.key].map(card => (
                <Card
                  key={card.id}
                  card={card}
                  colKey={col.key}
                  manage={manage}
                  dragId={drag?.id ?? null}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onToggle={handleToggle}
                />
              ))}

              {byStage[col.key].length === 0 && (
                <div style={{ padding: '24px 10px', textAlign: 'center', fontSize: 12, color: 'var(--text-faint)', border: '1px dashed var(--border)', borderRadius: 10 }}>
                  Drop here
                </div>
              )}
            </div>
          ))}
        </div>
      </QueryBoundary>
    </div>
  );
}
