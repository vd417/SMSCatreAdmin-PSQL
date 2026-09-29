import React, { useState, useMemo, useEffect } from 'react';
import { useClients } from '../api/hooks/useClients';
import {
  Btn, StatusBadge, Avatar, UsageBar, Pagination, SkeletonRows, Empty, Menu, MenuItem, fmt, useNav,
} from '../components';
import { Icon } from '../lib/icons';
import { useAuth } from '../auth/AuthContext';
import type { Client } from '../api/types';
import { groupClientsByOwner, type OwnerGroup } from '../lib/ownerSchools';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PER_PAGE = 12;

type SortKey = 'name' | 'mrr' | 'created' | 'schools';

const tierBadgeCls = (tier: string) =>
  'badge badge-' + (tier === 'gold' ? 'amber' : tier === 'platinum' ? 'violet' : 'slate');

const fmtDate = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function statusSummary(schools: Client[]): string {
  const counts = new Map<string, number>();
  for (const s of schools) counts.set(s.status, (counts.get(s.status) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([st, n]) => `${n} ${st}`)
    .join(' · ');
}

function earliestCreated(schools: Client[]): string | undefined {
  const dates = schools.map(s => s.created).filter(Boolean).sort();
  return dates[0];
}

export function ClientsScreen(): React.ReactElement {
  const { go } = useNav();
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('all');
  const [planF, setPlanF] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'mrr', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const query = useClients({ sort: '-mrr', limit: 200 });
  const all: Client[] = query.data?.pages.flatMap(p => p.data) ?? [];

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.fetchNextPage, query.data?.pages.length]);

  const statusCounts: Record<string, number> = { all: all.length };
  for (const s of ['active', 'trial', 'suspended', 'cancelled']) {
    statusCounts[s] = all.filter(c => c.status === s).length;
  }

  const planOptions = useMemo(() => {
    const seen = new Map<string, string>();
    all.forEach(c => { if (c.tier && !seen.has(c.tier)) seen.set(c.tier, c.plan_name || c.tier); });
    return [...seen.entries()];
  }, [all]);

  const filteredSchools = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter(c => {
      if (statusF !== 'all' && c.status !== statusF) return false;
      if (planF !== 'all' && c.tier !== planF) return false;
      if (!needle) return true;
      const hay = [
        c.name, c.slug, c.contact_name, c.contact_email, c.contact_phone,
      ].map(v => (v ?? '').toLowerCase()).join(' ');
      return hay.includes(needle);
    });
  }, [all, statusF, planF, q]);

  const groups = useMemo(() => groupClientsByOwner(filteredSchools), [filteredSchools]);

  const sorted = useMemo(() => {
    const arr = [...groups];
    arr.sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      if (sort.key === 'name') {
        av = (a.ownerName || a.email || a.schools[0]?.name || '').toLowerCase();
        bv = (b.ownerName || b.email || b.schools[0]?.name || '').toLowerCase();
      } else if (sort.key === 'mrr') {
        av = a.mrr; bv = b.mrr;
      } else if (sort.key === 'schools') {
        av = a.schools.length; bv = b.schools.length;
      } else {
        av = earliestCreated(a.schools) ?? '';
        bv = earliestCreated(b.schools) ?? '';
      }
      if (typeof av === 'string') { av = av.toLowerCase(); bv = String(bv).toLowerCase(); }
      return (av < bv ? -1 : av > bv ? 1 : 0) * (sort.dir === 'asc' ? 1 : -1);
    });
    return arr;
  }, [groups, sort]);

  useEffect(() => setPage(1), [q, statusF, planF]);
  const pages = Math.ceil(sorted.length / PER_PAGE);
  const pageItems = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });

  const Th = ({ k, children, num }: { k: SortKey; children: React.ReactNode; num?: boolean }) => (
    <th className={'sortable' + (num ? ' num' : '')} style={num ? { textAlign: 'right' } : undefined} onClick={() => toggleSort(k)}>
      {children}{sort.key === k && <span className="sort-ar">{sort.dir === 'asc' ? ' ▲' : ' ▼'}</span>}
    </th>
  );

  const onOwnerClick = (g: OwnerGroup) => {
    if (g.schools.length === 1) {
      go('client', { id: g.schools[0].id });
      return;
    }
    setOpenKey(k => (k === g.key ? null : g.key));
  };

  const ownerCount = groupClientsByOwner(all).length;

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div className="ph-text">
          <h1 className="page-title">Clients</h1>
          <p className="page-desc">
            {fmt.num(ownerCount)} client{ownerCount === 1 ? '' : 's'} · {fmt.num(all.length)} school{all.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="page-actions">
          {can('clients.start_trial') && (
            <Btn variant="primary" icon={Icon.plus} onClick={() => go('onboard')}>Onboard client</Btn>
          )}
        </div>
      </div>

      <div className="row jb fw gap12" style={{ marginBottom: 14 }}>
        <div className="row gap8 fw">
          {STATUS_FILTERS.map(s => (
            <button key={s.value} className={'chip' + (statusF === s.value ? ' active' : '')} onClick={() => setStatusF(s.value)}>
              {s.label}<span className="tiny" style={{ opacity: 0.6 }}>{statusCounts[s.value] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="row gap8 fw">
          <div className="input-group" style={{ width: '100%', maxWidth: 220 }}>
            <Icon.search />
            <input placeholder="Search school or owner…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select className="select" style={{ width: '100%', maxWidth: 130, height: 36 }} value={planF} onChange={e => setPlanF(e.target.value)}>
            <option value="all">All plans</option>
            {planOptions.map(([tier, name]) => <option key={tier} value={tier}>{name}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <Th k="name">Client</Th>
                <th>Status</th>
                <Th k="schools" num>Schools</Th>
                <Th k="mrr" num>MRR</Th>
                <Th k="created" num>Since</Th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            {query.isLoading
              ? <SkeletonRows cols={6} rows={8} />
              : (
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr><td colSpan={6}><Empty icon={Icon.building} title="No clients match">Try clearing filters or a different search.</Empty></td></tr>
                  ) : pageItems.map(g => {
                    const label = g.ownerName || g.email || g.schools[0]?.name || 'Client';
                    const open = openKey === g.key;
                    const multi = g.schools.length > 1;
                    return (
                      <React.Fragment key={g.key}>
                        <tr className="clickable" onClick={() => onOwnerClick(g)}>
                          <td>
                            <div className="row gap10" style={{ minWidth: 200 }}>
                              <Avatar name={label} size={30} square />
                              <div style={{ minWidth: 0 }}>
                                <div className="row gap8" style={{ alignItems: 'center' }}>
                                  {multi && (
                                    <Icon.chevRight
                                      size={14}
                                      style={{
                                        color: 'var(--text-3)',
                                        transform: open ? 'rotate(90deg)' : undefined,
                                        transition: 'transform .12s',
                                        flexShrink: 0,
                                      }}
                                    />
                                  )}
                                  <div className="truncate cell-name">{label}</div>
                                </div>
                                {g.email && <div className="tiny muted truncate">{g.email}</div>}
                                {!multi && g.schools[0]?.slug && (
                                  <div className="tiny muted mono truncate">{g.schools[0].slug}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            {multi
                              ? <span className="tiny muted">{statusSummary(g.schools)}</span>
                              : <StatusBadge status={g.schools[0].status} />}
                          </td>
                          <td className="num">{g.schools.length}</td>
                          <td className="num">{g.mrr ? fmt.money(g.mrr) : <span className="muted">—</span>}</td>
                          <td className="num muted tiny">{fmtDate(earliestCreated(g.schools))}</td>
                          <td onClick={e => e.stopPropagation()}>
                            <Menu trigger={<Btn variant="ghost" size="sm" icon={Icon.moreH} />}>
                              {multi ? (
                                <MenuItem
                                  icon={Icon.eye}
                                  onClick={() => setOpenKey(k => (k === g.key ? null : g.key))}
                                >
                                  {open ? 'Hide schools' : 'Show schools'}
                                </MenuItem>
                              ) : (
                                <MenuItem icon={Icon.eye} onClick={() => go('client', { id: g.schools[0].id })}>
                                  View details
                                </MenuItem>
                              )}
                              {can('billing.view') && (
                                <MenuItem icon={Icon.invoice} onClick={() => go('billing')}>View invoices</MenuItem>
                              )}
                            </Menu>
                          </td>
                        </tr>
                        {open && multi && (
                          <tr className="owner-schools-row">
                            <td colSpan={6} className="owner-schools-cell">
                              <div className="owner-schools">
                                <div className="owner-schools-head">
                                  <span className="col-title">Schools under this owner</span>
                                  <span className="tiny muted">{g.schools.length} schools</span>
                                </div>
                                <div className="tbl-wrap owner-schools-tbl-wrap">
                                  <table className="tbl owner-schools-tbl">
                                    <thead>
                                      <tr>
                                        <th>School</th>
                                        <th>Status</th>
                                        <th>Plan</th>
                                        <th className="num">MRR</th>
                                        <th>Students</th>
                                        <th className="num">Created</th>
                                        <th style={{ width: 36 }} />
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {g.schools.map(s => {
                                        const limitStudents = s.limits?.students ?? 0;
                                        return (
                                          <tr
                                            key={s.id}
                                            className="clickable"
                                            onClick={() => go('client', { id: s.id })}
                                          >
                                            <td>
                                              <div className="row gap10" style={{ minWidth: 160 }}>
                                                <Avatar name={s.name} size={28} square />
                                                <div style={{ minWidth: 0 }}>
                                                  <div className="truncate cell-name" style={{ fontSize: 14 }}>{s.name}</div>
                                                  {s.slug && <div className="tiny muted mono truncate">{s.slug}</div>}
                                                </div>
                                              </div>
                                            </td>
                                            <td><StatusBadge status={s.status} /></td>
                                            <td>
                                              <span className={tierBadgeCls(s.tier)}>{s.plan_name || '—'}</span>
                                            </td>
                                            <td className="num">
                                              {s.mrr ? fmt.money(s.mrr) : <span className="muted">—</span>}
                                            </td>
                                            <td style={{ width: 140 }}>
                                              {limitStudents > 0
                                                ? (
                                                  <div style={{ width: 120 }}>
                                                    <UsageBar
                                                      value={s.students_count ?? 0}
                                                      limit={limitStudents}
                                                      label="Students"
                                                      compact
                                                    />
                                                  </div>
                                                )
                                                : <span className="muted tiny">{fmt.num(s.students_count ?? 0)}</span>}
                                            </td>
                                            <td className="num muted tiny">{fmtDate(s.created)}</td>
                                            <td>
                                              <Icon.chevRight size={14} style={{ color: 'var(--text-3)' }} />
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              )}
          </table>
        </div>
        <Pagination page={page} pages={pages} total={sorted.length} onPage={setPage} />
      </div>
    </div>
  );
}
