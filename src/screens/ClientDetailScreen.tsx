import React, { useMemo, useState } from 'react';
import { useClient } from '../api/hooks/useClient';
import { useClients, useClientUsage, useClientActivity } from '../api/hooks/useClients';
import { QueryBoundary } from '../components/QueryBoundary';
import { useNav, StatusBadge, UsageBar, fmt, useToast, Btn } from '../components';
import { Icon } from '../lib/icons';
import { ClientActions } from '../components/ClientActions';
import { schoolsForOwner } from '../lib/ownerSchools';
import type { Client } from '../api/types';

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

function asDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function Copyable({
  text, href, children,
}: {
  text: string;
  href?: string;
  children?: React.ReactNode;
}): React.ReactElement {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      toast({ title: 'Copied', msg: text, kind: 'info' });
      window.setTimeout(() => setCopied(false), 1500);
    } else {
      toast({ title: 'Copy failed', msg: 'Could not copy to clipboard', kind: 'error' });
    }
  };

  return (
    <div className="row gap8" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
      {href
        ? <a href={href} style={{ fontWeight: 600 }}>{children ?? text}</a>
        : <span style={{ fontWeight: 600 }}>{children ?? text}</span>}
      <Btn
        variant="ghost"
        size="sm"
        icon={copied ? Icon.check : Icon.copy}
        className="btn-icon"
        title={copied ? 'Copied' : 'Copy'}
        aria-label={copied ? 'Copied' : `Copy ${text}`}
        onClick={onCopy}
      />
    </div>
  );
}

export function ClientDetailScreen(): React.ReactElement {
  const { route, go } = useNav();
  const id = String(route.params.id ?? '');
  const detail = useClient(id);
  const usage = useClientUsage(id);
  const activity = useClientActivity(id);
  const allClients = useClients({ sort: '-mrr', limit: 200 });
  const clientList: Client[] = allClients.data?.pages.flatMap(p => p.data) ?? [];
  const ownerSchools = useMemo(
    () => schoolsForOwner(clientList, detail.data?.contact_email, id),
    [clientList, detail.data?.contact_email, id],
  );

  return (
    <div className="page">
      <button className="btn btn-ghost btn-sm" onClick={() => go('clients')} style={{ marginBottom: 12 }}>
        <Icon.chevLeft size={14} /> Back to clients
      </button>

      <QueryBoundary isLoading={detail.isLoading} isError={detail.isError} error={detail.error}>
        {detail.data && (
          <>
            <div className="row jb">
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700 }}>{detail.data.name}</h1>
                <div className="muted tiny" style={{ marginTop: 4 }}>
                  {dash(detail.data.country)}
                  {detail.data.slug ? ` · @${detail.data.slug}` : ''}
                  {detail.data.csm ? ` · CSM ${detail.data.csm}` : ''}
                </div>
              </div>
              <div className="row gap12">
                <StatusBadge status={detail.data.status} />
                <ClientActions client={detail.data} onDeleted={() => go('clients')} />
              </div>
            </div>

            <div className="kpi-grid" style={{ marginTop: 16 }}>
              <Stat label="Plan" value={dash(detail.data.plan_name)} />
              <Stat label="MRR" value={fmt.money(detail.data.mrr ?? 0, 2)} />
              <Stat label="Health" value={dash(detail.data.health_score)} />
              <Stat label="Tier" value={dash(detail.data.tier)} />
            </div>

            <div className="card" style={{ marginTop: 16, padding: 16 }}>
              <b>School owner & contact</b>
              <div className="detail-grid" style={{ marginTop: 12 }}>
                <Detail icon={Icon.user} label="Owner name" value={dash(detail.data.contact_name)} />
                <Detail
                  icon={Icon.mail}
                  label="Email"
                  value={detail.data.contact_email
                    ? <Copyable text={detail.data.contact_email} href={`mailto:${detail.data.contact_email}`} />
                    : '—'}
                />
                <Detail
                  icon={Icon.phone}
                  label="Phone / mobile"
                  value={detail.data.contact_phone
                    ? <Copyable text={detail.data.contact_phone} href={`tel:${detail.data.contact_phone}`} />
                    : '—'}
                />
                <Detail
                  icon={Icon.building}
                  label="Address"
                  value={detail.data.address
                    ? <Copyable text={detail.data.address} />
                    : '—'}
                />
              </div>
              {ownerSchools.length > 1 && (
                <div style={{ marginTop: 18 }}>
                  <div className="row jb" style={{ marginBottom: 10 }}>
                    <b>Schools under this owner</b>
                    <span className="badge badge-blue">{ownerSchools.length} schools</span>
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {ownerSchools.map(s => {
                      const isCurrent = s.id === id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className="row jb"
                          onClick={() => { if (!isCurrent) go('client', { id: s.id }); }}
                          style={{
                            textAlign: 'left',
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: `1px solid ${isCurrent ? 'var(--accent-line)' : 'var(--border)'}`,
                            background: isCurrent ? 'var(--accent-ghost)' : 'var(--surface-2)',
                            cursor: isCurrent ? 'default' : 'pointer',
                            width: '100%',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div className="row gap8" style={{ alignItems: 'center' }}>
                              <span className="cell-name" style={{ fontSize: 14 }}>{s.name}</span>
                              {isCurrent && <span className="tiny muted">This school</span>}
                            </div>
                            {s.slug && <div className="tiny muted mono">{s.slug}</div>}
                          </div>
                          <div className="row gap8" style={{ flexShrink: 0 }}>
                            <StatusBadge status={s.status} />
                            {!isCurrent && <Icon.chevRight size={14} style={{ color: 'var(--text-3)' }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="card" style={{ marginTop: 16, padding: 16 }}>
              <b>School details</b>
              <div className="detail-grid" style={{ marginTop: 12 }}>
                <Detail
                  label="Client ID"
                  value={<Copyable text={detail.data.id}><span className="mono tiny">{detail.data.id}</span></Copyable>}
                />
                <Detail label="Workspace URL" value={dash(detail.data.slug)} />
                <Detail label="Location" value={dash(detail.data.country)} />
                <Detail
                  label="ID proof"
                  value={
                    detail.data.id_proof_url
                      ? <span className="row gap8">
                          <span>{detail.data.id_proof_type === 'aadhaar' ? 'Aadhaar' : 'PAN'}</span>
                          <a href={detail.data.id_proof_url} target="_blank" rel="noopener noreferrer">View</a>
                        </span>
                      : dash(null)
                  }
                />
                <Detail label="Created" value={asDate(detail.data.created)} />
                <Detail label="Status" value={<StatusBadge status={detail.data.status} />} />
                <Detail label="CSM" value={dash(detail.data.csm)} />
                <Detail label="Gateway" value={dash(detail.data.gateway)} />
                <Detail
                  label="Trial ends"
                  value={detail.data.trial_ends_days != null ? `${detail.data.trial_ends_days} days` : '—'}
                />
                <Detail
                  label="Last active"
                  value={detail.data.last_active_days != null ? `${detail.data.last_active_days} days ago` : '—'}
                />
              </div>
            </div>

            <div className="card" style={{ marginTop: 16, padding: 16 }}>
              <b>Plan & billing</b>
              <div className="detail-grid" style={{ marginTop: 12 }}>
                <Detail label="Plan" value={dash(detail.data.plan_name)} />
                <Detail label="Plan ID" value={<span className="mono tiny">{dash(detail.data.plan_id)}</span>} />
                <Detail label="Tier" value={dash(detail.data.tier)} />
                <Detail label="MRR" value={fmt.money(detail.data.mrr ?? 0, 2)} />
                <Detail label="Students" value={fmt.num(detail.data.students_count ?? 0)} />
                <Detail label="Staff" value={fmt.num(detail.data.staff_count ?? 0)} />
                <Detail label="Storage" value={`${detail.data.storage_gb ?? 0} GB`} />
                <Detail label="Limits" value={limitsText(detail.data)} />
              </div>
            </div>

            <div className="card" style={{ marginTop: 16, padding: 16 }}>
              <b>Usage</b>
              <QueryBoundary isLoading={usage.isLoading} isError={usage.isError} error={usage.error}>
                {usage.data && (
                  <div style={{ marginTop: 10 }}>
                    <UsageBar
                      label="Students"
                      value={usage.data.students_count}
                      limit={usage.data.limits.students ?? usage.data.students_count}
                    />
                    <div className="row gap16 muted tiny" style={{ marginTop: 8 }}>
                      <span>Staff {fmt.num(usage.data.staff_count)}</span>
                      <span>Storage {usage.data.storage_gb} GB</span>
                      <span>{usage.data.usage_pct}% of plan</span>
                    </div>
                  </div>
                )}
              </QueryBoundary>
            </div>

            <div className="card" style={{ marginTop: 16, padding: 16 }}>
              <b>Activity</b>
              <QueryBoundary
                isLoading={activity.isLoading} isError={activity.isError} error={activity.error}
                isEmpty={!activity.isLoading && (activity.data?.data.length ?? 0) === 0}
                emptyTitle="No activity yet">
                {activity.data && activity.data.data.map(a => (
                  <div key={a.id} className="row jb" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span>{a.action}</span>
                    <span className="muted tiny">{a.actor_name}</span>
                  </div>
                ))}
              </QueryBoundary>
            </div>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function limitsText(c: Client): string {
  const lim = c.limits ?? {};
  const students = lim.students ?? '—';
  const staff = lim.staff ?? '—';
  const storage = lim.storage_gb ?? '—';
  return `${students} students · ${staff} staff · ${storage} GB`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="muted tiny">{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function Detail({
  label, value, icon: Ic,
}: {
  label: string;
  value: React.ReactNode;
  icon?: typeof Icon.mail;
}) {
  return (
    <div className="detail-item">
      <div className="row gap8" style={{ marginBottom: 4 }}>
        {Ic && <Ic size={13} style={{ color: 'var(--text-3)' }} />}
        <div className="tiny muted">{label}</div>
      </div>
      <div style={{ fontSize: 13.5, wordBreak: 'break-word' }}>{value}</div>
    </div>
  );
}
