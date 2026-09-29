import React, { useState } from 'react';
import { useDashboardOverview } from '../api/hooks/useDashboardOverview';
import { QueryBoundary } from '../components/QueryBoundary';
import { Charts } from '../lib/charts';
import { StatusBadge, Avatar, Btn, Segmented, fmt, useNav } from '../components';
import { Icon, type IconComponent } from '../lib/icons';
import { useAuth } from '../auth/AuthContext';
import { ROLES } from '../auth/rbac';
import type { Role } from '../api/types';

// True when every value in a numeric series is zero — "not enough history yet" (handoff §8.2).
const allZero = (s: number[]) => s.length === 0 || s.every(v => v === 0);

const roleColor = (role: string) => ROLES[role as Role]?.color ?? 'var(--slate)';

const today = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' });

export function DashboardScreen(): React.ReactElement {
  const q = useDashboardOverview();
  const { can } = useAuth();
  const { go } = useNav();
  const [range, setRange] = useState('12m');

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div className="ph-text">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-desc">{today()} · Here's how the platform is doing.</p>
        </div>
        <div className="page-actions">
          <Segmented value={range} onChange={setRange} options={[
            { value: '30d', label: '30d' }, { value: '90d', label: '90d' }, { value: '12m', label: '12m' },
          ]} />
          {can('reports.view') && <Btn variant="default" icon={Icon.download} onClick={() => go('reports')}>Reports</Btn>}
        </div>
      </div>

      <QueryBoundary isLoading={q.isLoading} isError={q.isError} error={q.error}
        skeleton={<div className="muted" style={{ padding: 24 }}>Loading dashboard…</div>}>
        {q.data && (
          <>
            <div className="kpi-grid" style={{ marginBottom: 16 }}>
              {([
                { label: 'Total clients', value: fmt.num(q.data.counts.total), icon: Icon.building, tint: 'var(--blue)', bg: 'var(--blue-bg)' },
                { label: 'Active', value: fmt.num(q.data.counts.active), icon: Icon.checkCircle, tint: 'var(--green)', bg: 'var(--green-bg)' },
                { label: 'Trials', value: fmt.num(q.data.counts.trial), icon: Icon.zap, tint: 'var(--amber)', bg: 'var(--amber-bg)' },
                { label: 'Suspended', value: fmt.num(q.data.counts.suspended), icon: Icon.pause, tint: 'var(--red)', bg: 'var(--red-bg)' },
                { label: 'MRR', value: fmt.money(q.data.mrr), icon: Icon.dollar, tint: 'var(--accent)', bg: 'var(--accent-ghost)' },
                { label: 'Churn', value: fmt.pct(q.data.churn_pct), icon: Icon.trendDown, tint: 'var(--violet)', bg: 'var(--violet-bg)' },
                { label: 'Trials ending', value: fmt.num(q.data.trials_ending), icon: Icon.clock, tint: 'var(--amber)', bg: 'var(--amber-bg)' },
              ] as { label: string; value: string; icon: IconComponent; tint: string; bg: string }[]).map(k => (
                <div className="kpi" key={k.label} style={{ borderTopColor: k.tint, borderTopWidth: 2.5 }}>
                  <div className="kpi-top">
                    <span>{k.label}</span>
                    <span className="kpi-ic" style={{ color: k.tint, background: k.bg }}>{React.createElement(k.icon, { size: 14 })}</span>
                  </div>
                  <div className="kpi-val">{k.value}</div>
                </div>
              ))}
            </div>

            <div className="dash-row" style={{ marginBottom: 16 }}>
              <div className="card dash-grow-16">
                <div className="card-head">
                  <div className="f1"><h3>Recurring revenue</h3><div className="sub">MRR over the last 12 months</div></div>
                  <div className="row gap8">
                    <span className="mono" style={{ fontSize: 17, fontWeight: 700 }}>{fmt.money(q.data.mrr)}</span>
                    <span className="muted tiny">{fmt.pct(q.data.churn_pct)} churn</span>
                  </div>
                </div>
                <div className="card-pad">
                  {allZero(q.data.mrr_series)
                    ? <p className="muted" style={{ padding: '32px 0', textAlign: 'center' }}>Not enough history yet</p>
                    : <Charts.Line data={q.data.mrr_series} labels={q.data.months} format={fmt.k} color="var(--green)" />}
                </div>
              </div>
              <div className="card">
                <div className="card-head"><h3>Clients by plan</h3></div>
                <div className="card-pad" style={{ display: 'grid', placeItems: 'center', minHeight: 224 }}>
                  <Charts.Donut data={q.data.plan_mix} />
                </div>
              </div>
            </div>

            <div className="dash-row" style={{ marginBottom: 16 }}>
              <div className="card">
                <div className="card-head"><div className="f1"><h3>New signups</h3><div className="sub">Per month</div></div></div>
                <div className="card-pad">
                  {allZero(q.data.signup_series)
                    ? <p className="muted" style={{ padding: '32px 0', textAlign: 'center' }}>Not enough history yet</p>
                    : <Charts.Bars data={q.data.signup_series} labels={q.data.months} color="var(--blue)" />}
                </div>
              </div>

              <div className="card dash-grow-13">
                <div className="card-head">
                  <div className="f1"><h3>Usage alerts</h3><div className="sub">Clients near a plan limit</div></div>
                  {q.data.usage_alerts.length > 0 && <span className="badge badge-amber">{q.data.usage_alerts.length} flagged</span>}
                </div>
                <div>
                  {q.data.usage_alerts.length === 0
                    ? <p className="muted tiny" style={{ padding: '12px 18px' }}>No tenants over 80% usage.</p>
                    : q.data.usage_alerts.slice(0, 5).map((a, i, arr) => (
                        <div key={a.tenant_id} className="row gap12"
                          style={{ padding: '11px 18px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-soft)' : 'none', cursor: 'pointer' }}
                          onClick={() => go('client', { id: a.tenant_id })}>
                          <Avatar name={a.name} size={30} square />
                          <div className="f1 row jb" style={{ minWidth: 0 }}>
                            <span className="truncate cell-name">{a.name}</span>
                            <span className="mono tiny" style={{ color: a.usage_pct >= 95 ? 'var(--red)' : 'var(--amber)' }}>{a.usage_pct}%</span>
                          </div>
                          <StatusBadge status={a.status} />
                        </div>
                      ))}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-head">
                <div className="f1"><h3>Recent activity</h3><div className="sub">Audit log across the team</div></div>
              </div>
              <div>
                {q.data.recent_activity.length === 0
                  ? <p className="muted tiny" style={{ padding: '12px 18px' }}>No recent activity.</p>
                  : q.data.recent_activity.slice(0, 6).map((a, i, arr) => (
                      <div key={a.id} className="row gap12" style={{ padding: '11px 18px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                        <Avatar name={a.actor_name} size={26} />
                        <div className="f1" style={{ fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>{a.actor_name}</span>
                          <span className="muted">{' ' + a.action + ' '}</span>
                          <span style={{ fontWeight: 600 }}>{a.target}</span>
                        </div>
                        <span className="role-badge" style={{ background: roleColor(a.role) + '22', color: roleColor(a.role) }}>{a.role}</span>
                        <span className="tiny muted" style={{ width: 76, textAlign: 'right' }}>{a.time}</span>
                      </div>
                    ))}
              </div>
            </div>

            <HealthPanel items={q.data.system_health} />
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

export function HealthPanel({ items }: { items: { name: string; status: string; latency: string; uptime: string }[] }) {
  return (
    <div className="card" style={{ marginTop: 16, padding: 16 }}>
      <div className="row gap8"><Icon.activity size={16} /><b>System health</b></div>
      {items.length === 0
        ? <p className="muted tiny" style={{ marginTop: 8 }}>No health data.</p>
        : items.map(h => (
            <div key={h.name} className="row jb" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{h.name}</span>
              <span className="row gap10"><span className="tiny muted mono">{h.latency} · {h.uptime}</span><StatusBadge status={h.status} /></span>
            </div>
          ))}
    </div>
  );
}
