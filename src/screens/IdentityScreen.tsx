import React, { useMemo, useState } from 'react';
import { Avatar, Btn, Empty, Menu, MenuItem, StatusBadge, useToast } from '../components';
import { InviteTeamModal } from '../components/InviteTeamModal';
import { Icon } from '../lib/icons';
import { useAuth } from '../auth/AuthContext';
import { MATRIX, PERMISSION_CATALOG, ROLES } from '../auth/rbac';
import { QueryBoundary } from '../components/QueryBoundary';
import { useTeam } from '../api/hooks/useTeam';
import { useInviteTeamMember, useUpdateTeamMember } from '../api/hooks/useTeamMutations';
import type { ApiError } from '../api/ApiError';
import type { InviteTeamBody } from '../api/team';
import type { Role, TeamMember } from '../api/types';

type Tab = 'users' | 'roles' | 'matrix';

const ALL_ROLES = Object.keys(ROLES) as Role[];
const GROUPS = ['Overview', 'Clients', 'Onboarding', 'Revenue', 'Support', 'Admin'] as const;

function RoleBadge({ role }: { role: Role }) {
  const meta = ROLES[role];
  return (
    <span className="badge" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
      {meta.name}
    </span>
  );
}

function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function IdentityScreen(): React.ReactElement {
  const { can, role: actorRole } = useAuth();
  const toast = useToast();
  const manage = can('identity.manage');
  const q = useTeam();
  const invite = useInviteTeamMember();
  const update = useUpdateTeamMember();

  const [tab, setTab] = useState<Tab>('users');
  const [roleF, setRoleF] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [onlyGranted, setOnlyGranted] = useState(false);
  /** Local matrix for preview edits — does not rewrite live `can()`. */
  const [matrix, setMatrix] = useState<Record<string, Role[]>>(() =>
    Object.fromEntries(Object.entries(MATRIX).map(([k, v]) => [k, [...v]])));
  const [audit, setAudit] = useState<string[]>([]);

  const members: TeamMember[] = q.data?.data ?? [];
  const filteredUsers = useMemo(() => members.filter(m => {
    if (roleF !== 'all' && m.role !== roleF) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return m.name.toLowerCase().includes(s)
      || m.email.toLowerCase().includes(s)
      || m.id.toLowerCase().includes(s)
      || (m.employee_id ?? '').toLowerCase().includes(s);
  }), [members, roleF, search]);

  const allowedRoles: Role[] = actorRole === 'owner'
    ? ALL_ROLES
    : ALL_ROLES.filter(r => r !== 'owner');

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of ALL_ROLES) c[r] = members.filter(m => m.role === r).length;
    return c;
  }, [members]);

  const permsByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const g of GROUPS) map.set(g, []);
    for (const key of Object.keys(PERMISSION_CATALOG)) {
      const g = PERMISSION_CATALOG[key].group;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(key);
    }
    return map;
  }, []);

  const onInvite = (body: InviteTeamBody) => {
    invite.mutate(body, {
      onSuccess: (m) => {
        toast({ kind: 'success', title: 'Identity created', msg: `${m.name} · ${ROLES[m.role].name}` });
        setAudit(a => [`Invited ${m.email} as ${m.role}`, ...a].slice(0, 20));
        setInviteOpen(false);
      },
      onError: (err) => toast({ kind: 'error', title: 'Invite failed', msg: (err as ApiError).message }),
    });
  };

  const setRole = (m: TeamMember, role: Role) => {
    update.mutate({ id: m.id, body: { role } }, {
      onSuccess: () => {
        toast({ kind: 'success', title: 'Role updated', msg: `${m.name} → ${ROLES[role].name}` });
        setAudit(a => [`Set ${m.email} role to ${role}`, ...a].slice(0, 20));
      },
      onError: (err) => toast({ kind: 'error', title: 'Update failed', msg: (err as ApiError).message }),
    });
  };

  const toggleStatus = (m: TeamMember) => {
    const next = m.status === 'active' ? 'deactivated' : 'active';
    update.mutate({ id: m.id, body: { status: next } }, {
      onSuccess: () => {
        toast({ kind: 'success', title: next === 'active' ? 'Reactivated' : 'Deactivated', msg: m.name });
        setAudit(a => [`${next === 'active' ? 'Reactivated' : 'Deactivated'} ${m.email}`, ...a].slice(0, 20));
      },
      onError: (err) => toast({ kind: 'error', title: 'Update failed', msg: (err as ApiError).message }),
    });
  };

  const flipCell = (perm: string, role: Role) => {
    if (!manage) return;
    setMatrix(prev => {
      const row = new Set(prev[perm] ?? []);
      const had = row.has(role);
      if (had) row.delete(role); else row.add(role);
      toast({
        kind: 'success',
        title: had ? 'Revoked (preview)' : 'Granted (preview)',
        msg: `${PERMISSION_CATALOG[perm]?.label ?? perm} · ${ROLES[role].name}`,
      });
      setAudit(a => [`${had ? 'Revoked' : 'Granted'} ${perm} ${had ? 'from' : 'to'} ${role} (local)`, ...a].slice(0, 20));
      return { ...prev, [perm]: [...row] as Role[] };
    });
  };

  return (
    <div className="page">
      <div className="row jb fw gap16" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Identity & Access</h1>
          <p className="muted tiny" style={{ marginTop: 4 }}>
            Create admin, sales, and support IDs. Roles and permissions for the Catre panel.
          </p>
        </div>
        {manage && tab === 'users' && (
          <Btn variant="primary" icon={Icon.plus} onClick={() => setInviteOpen(true)}>Add identity</Btn>
        )}
      </div>

      <div className="row jb fw gap12" style={{ marginBottom: 14 }}>
        <div className="segmented">
          {([
            { key: 'users', label: 'Users' },
            { key: 'roles', label: 'Roles' },
            { key: 'matrix', label: 'Access matrix' },
          ] as { key: Tab; label: string }[]).map(t => (
            <button key={t.key} type="button" className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <select className="input" style={{ width: '100%', maxWidth: 160 }} value={roleF} onChange={e => setRoleF(e.target.value)}>
          <option value="all">All roles</option>
          {ALL_ROLES.map(r => <option key={r} value={r}>{ROLES[r].name}</option>)}
        </select>
      </div>

      {tab === 'users' && (
        <>
          <input className="input" style={{ width: '100%', maxWidth: 280, marginBottom: 12 }} placeholder="Search by ID, employee id, name, email…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <QueryBoundary isLoading={q.isLoading} isError={q.isError} error={q.error}>
            {filteredUsers.length === 0 ? (
              <Empty title="No identities">Add sales, support, or admin users to grant panel access.</Empty>
            ) : (
              <div className="card" style={{ overflow: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Employee ID</th>
                      <th>Member</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last login</th>
                      {manage && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(m => (
                      <tr key={m.id}>
                        <td className="mono tiny muted" title={m.id}>{shortId(m.id)}</td>
                        <td className="mono tiny">{m.employee_id || '—'}</td>
                        <td>
                          <div className="row gap10">
                            <Avatar name={m.name} size={32} src={m.photo_url} />
                            <div>
                              <div className="cell-name">{m.name}</div>
                              <div className="tiny muted">{m.email}</div>
                              {m.phone && <div className="tiny muted">{m.phone}</div>}
                            </div>
                          </div>
                        </td>
                        <td><RoleBadge role={m.role} /></td>
                        <td><StatusBadge status={m.status === 'active' ? 'active' : 'deactivated'} /></td>
                        <td className="tiny muted">{fmtWhen(m.last_login)}</td>
                        {manage && (
                          <td style={{ textAlign: 'right' }}>
                            <Menu trigger={<Btn variant="ghost" size="sm" icon={Icon.moreH} />}>
                              {allowedRoles.map(r => (
                                <MenuItem key={r} onClick={() => setRole(m, r)}>
                                  {m.role === r ? '✓ ' : ''}{ROLES[r].name}
                                </MenuItem>
                              ))}
                              <MenuItem onClick={() => toggleStatus(m)}>
                                {m.status === 'active' ? 'Deactivate' : 'Reactivate'}
                              </MenuItem>
                            </Menu>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryBoundary>
        </>
      )}

      {tab === 'roles' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {ALL_ROLES.filter(r => roleF === 'all' || r === roleF).map(r => {
            const perms = Object.entries(matrix).filter(([, roles]) => roles.includes(r)).map(([k]) => k);
            const byGroup = GROUPS.map(g => ({
              g,
              items: perms.filter(p => PERMISSION_CATALOG[p]?.group === g),
            })).filter(x => x.items.length);
            return (
              <div key={r} className="card" style={{ padding: 14 }}>
                <div className="row gap8" style={{ marginBottom: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: ROLES[r].color }} />
                  <b style={{ fontSize: 14 }}>{ROLES[r].name}</b>
                  <span className="tiny muted" style={{ marginLeft: 'auto' }}>{counts[r] ?? 0} users</span>
                </div>
                <p className="tiny muted" style={{ marginBottom: 10 }}>{ROLES[r].desc}</p>
                {byGroup.map(({ g, items }) => (
                  <div key={g} style={{ marginBottom: 8 }}>
                    <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 4 }}>{g}</div>
                    <div className="fc gap2">
                      {items.map(p => (
                        <div key={p} className="tiny" style={{ color: 'var(--text-2)' }}>
                          {PERMISSION_CATALOG[p]?.label ?? p}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'matrix' && (
        <>
          <div className="row gap12" style={{ marginBottom: 10 }}>
            <label className="row gap6 tiny muted" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={onlyGranted} onChange={e => setOnlyGranted(e.target.checked)}
                disabled={roleF === 'all'} />
              Only permissions this role has
            </label>
            <span className="tiny muted">Matrix edits are preview-only and do not change live access.</span>
          </div>
          <div className="card" style={{ overflow: 'auto' }}>
            <table className="table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>Permission</th>
                  {ALL_ROLES.map(r => (
                    <th key={r} style={{
                      textAlign: 'center',
                      background: roleF === r ? 'var(--surface-2)' : undefined,
                      color: ROLES[r].color,
                    }}>{ROLES[r].name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GROUPS.map(g => {
                  let keys = permsByGroup.get(g) ?? [];
                  if (onlyGranted && roleF !== 'all') {
                    keys = keys.filter(k => (matrix[k] ?? []).includes(roleF as Role));
                  }
                  if (!keys.length) return null;
                  return (
                    <React.Fragment key={g}>
                      <tr>
                        <td colSpan={ALL_ROLES.length + 1} style={{ fontWeight: 700, background: 'var(--surface-2)', fontSize: 12 }}>
                          {g}
                        </td>
                      </tr>
                      {keys.map(perm => (
                        <tr key={perm}>
                          <td>
                            <div style={{ fontSize: 13 }}>{PERMISSION_CATALOG[perm]?.label ?? perm}</div>
                            <div className="mono tiny muted">{perm}</div>
                          </td>
                          {ALL_ROLES.map(r => {
                            const on = (matrix[perm] ?? []).includes(r);
                            return (
                              <td key={r} style={{ textAlign: 'center', background: roleF === r ? 'var(--surface-2)' : undefined }}>
                                <button
                                  type="button"
                                  disabled={!manage}
                                  onClick={() => flipCell(perm, r)}
                                  style={{
                                    width: 28, height: 28, borderRadius: 6,
                                    background: on ? 'var(--green)' : 'var(--surface-3)',
                                    color: on ? '#fff' : 'var(--text-faint)',
                                    cursor: manage ? 'pointer' : 'default',
                                    fontWeight: 700, fontSize: 12,
                                  }}
                                  title={on ? 'Granted' : 'Not granted'}
                                >
                                  {on ? '✓' : '—'}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {audit.length > 0 && (
        <div className="card" style={{ marginTop: 14, padding: 12 }}>
          <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 6 }}>Recent changes</div>
          {audit.map((line, i) => <div key={i} className="tiny" style={{ color: 'var(--text-2)' }}>{line}</div>)}
        </div>
      )}

      {manage && (
        <InviteTeamModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          onSubmit={onInvite}
          pending={invite.isPending}
          allowedRoles={allowedRoles}
        />
      )}
    </div>
  );
}
