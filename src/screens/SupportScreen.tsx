import React, { useMemo, useState } from 'react';
import { Avatar, Btn, Empty, StatusBadge, PRIORITY_MAP, useNav } from '../components';
import { Icon } from '../lib/icons';
import { QueryBoundary } from '../components/QueryBoundary';
import { useTickets } from '../api/hooks/useTickets';
import { useDashboardOverview } from '../api/hooks/useDashboardOverview';
import { TicketDetailScreen } from './TicketDetailScreen';
import type { Ticket } from '../api/types';

type Filter = 'open' | 'all' | 'resolved' | 'closed';

function fmtUpdated(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function SupportHealthSidebar({ onExpand }: { onExpand: () => void }) {
  const q = useDashboardOverview();
  const items = q.data?.system_health ?? [];
  const allOk = items.length > 0 && items.every(s => s.status === 'operational');

  return (
    <div className="card">
      <div className="card-head">
        <div className="f1">
          <h3>System health</h3>
          <div className="sub">{q.isLoading ? 'Loading…' : allOk ? 'All systems operational' : items.length ? 'Some degradation' : 'No data'}</div>
        </div>
        <span style={{
          width: 9, height: 9, borderRadius: '50%',
          background: allOk ? 'var(--green)' : 'var(--amber)',
          boxShadow: `0 0 0 4px ${allOk ? 'var(--green-bg)' : 'var(--amber-bg)'}`,
        }} />
      </div>
      <div style={{ padding: '4px 0' }}>
        {items.slice(0, 6).map((s, i) => (
          <div key={s.name} className="row jb gap10" style={{
            padding: '10px 16px',
            borderBottom: i < Math.min(items.length, 6) - 1 ? '1px solid var(--border-soft)' : 'none',
          }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{s.name}</div>
              <div className="tiny muted mono">{s.latency} · {s.uptime}</div>
            </div>
            <StatusBadge status={s.status} />
          </div>
        ))}
      </div>
      <div style={{ padding: 12, borderTop: '1px solid var(--border-soft)' }}>
        <Btn variant="default" size="sm" icon={Icon.server} onClick={onExpand}>Full health</Btn>
      </div>
    </div>
  );
}

export function SupportScreen(): React.ReactElement {
  const nav = useNav();
  const [filter, setFilter] = useState<Filter>('open');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ticketsQ = useTickets({});
  const all: Ticket[] = ticketsQ.data?.pages.flatMap(p => p.data) ?? [];

  const counts = useMemo(() => ({
    all: all.length,
    open: all.filter(t => t.status === 'open' || t.status === 'pending').length,
    resolved: all.filter(t => t.status === 'resolved').length,
    closed: all.filter(t => t.status === 'closed').length,
  }), [all]);

  const list = useMemo(() => all.filter(t => {
    const statusOk = filter === 'all'
      || (filter === 'open' ? (t.status === 'open' || t.status === 'pending') : t.status === filter);
    const hay = `${t.subject} ${t.tenant_name ?? ''}`.toLowerCase();
    const qOk = !q.trim() || hay.includes(q.toLowerCase());
    return statusOk && qOk;
  }), [all, filter, q]);

  if (selectedId) {
    return <TicketDetailScreen id={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div className="ph-text">
          <h1 className="page-title">Support</h1>
          <p className="page-desc">{counts.open} open tickets across all clients</p>
        </div>
        <div className="page-actions">
          <Btn variant="default" icon={Icon.server} onClick={() => nav.go('health')}>System health</Btn>
        </div>
      </div>

      <div className="split">
        <div>
          <div className="row jb gap12 fw" style={{ marginBottom: 14 }}>
            <div className="row gap8" style={{ flexWrap: 'wrap' }}>
              {([
                ['open', 'Open'],
                ['all', 'All'],
                ['resolved', 'Resolved'],
                ['closed', 'Closed'],
              ] as [Filter, string][]).map(([k, label]) => (
                <button key={k} type="button" className={'chip' + (filter === k ? ' active' : '')} onClick={() => setFilter(k)}>
                  {label}
                  <span className="tiny" style={{ opacity: 0.6 }}>{counts[k]}</span>
                </button>
              ))}
            </div>
            <div className="input-group" style={{ width: '100%', maxWidth: 200 }}>
              <Icon.search size={14} />
              <input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
            </div>
          </div>

          <QueryBoundary isLoading={ticketsQ.isLoading} isError={ticketsQ.isError} error={ticketsQ.error}>
            <div className="card">
              {list.length === 0 ? (
                <Empty icon={Icon.support} title="No tickets">Nothing matches this filter.</Empty>
              ) : list.map((t, i) => {
                const pri = PRIORITY_MAP[t.priority] ?? { cls: 'badge-slate', label: t.priority };
                return (
                  <div
                    key={t.id}
                    className="row gap12 clickable"
                    style={{
                      padding: '13px 16px',
                      borderBottom: i < list.length - 1 ? '1px solid var(--border-soft)' : 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <span className={'badge ' + pri.cls} style={{ flexShrink: 0 }}>{pri.label}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate cell-name">{t.subject}</div>
                      <div className="row gap8 tiny muted" style={{ marginTop: 3 }}>
                        <span className="mono">{t.id.slice(0, 8)}</span>
                        <span>·</span>
                        <span>{t.tenant_name || '—'}</span>
                        <span>·</span>
                        <span className="row gap4"><Icon.message size={11} />{t.messages_count ?? 0}</span>
                      </div>
                    </div>
                    <div className="fc" style={{ alignItems: 'flex-end', gap: 6 }}>
                      <StatusBadge status={t.status} />
                      {t.assignee
                        ? <span className="row gap4 tiny muted"><Avatar name={t.assignee} size={16} />{t.assignee.split(' ')[0]}</span>
                        : <span className="tiny" style={{ color: 'var(--text-faint)' }}>Unassigned</span>}
                    </div>
                    <span className="tiny muted" style={{ width: 56, textAlign: 'right' }}>{fmtUpdated(t.updated)}</span>
                  </div>
                );
              })}
            </div>
          </QueryBoundary>
        </div>

        <SupportHealthSidebar onExpand={() => nav.go('health')} />
      </div>
    </div>
  );
}
