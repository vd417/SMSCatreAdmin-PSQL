import React, { useMemo, useRef, useState } from 'react';
import { Avatar, Btn, Empty, Menu, MenuItem, StatusBadge, useToast } from '../components';
import { InviteTeamModal } from '../components/InviteTeamModal';
import { Icon } from '../lib/icons';
import { useAuth } from '../auth/AuthContext';
import { ROLES } from '../auth/rbac';
import { QueryBoundary } from '../components/QueryBoundary';
import { useTeam } from '../api/hooks/useTeam';
import {
  downloadTeamDocument,
  useAddTeamDocument,
  useDeleteTeamDocument,
  useInviteTeamMember,
  useUpdateTeamMember,
} from '../api/hooks/useTeamMutations';
import { fileToTeamDocument } from '../api/team';
import type { ApiError } from '../api/ApiError';
import type { Role, TeamMember } from '../api/types';

const ROLE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  ...(['owner', 'admin', 'support', 'sales', 'finance', 'analyst'] as Role[]).map(r => ({
    value: r, label: ROLES[r].name,
  })),
];

function RoleBadge({ role }: { role: Role }) {
  const meta = ROLES[role] ?? { name: role, color: 'var(--slate)' };
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

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function TeamScreen(): React.ReactElement {
  const { can, role: actorRole } = useAuth();
  const toast = useToast();
  const manage = can('team.manage');
  const q = useTeam();
  const invite = useInviteTeamMember();
  const update = useUpdateTeamMember();
  const addDoc = useAddTeamDocument();
  const delDoc = useDeleteTeamDocument();
  const docInputRef = useRef<HTMLInputElement>(null);

  const [roleF, setRoleF] = useState('all');
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [docsFor, setDocsFor] = useState<string | null>(null);
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  const members: TeamMember[] = q.data?.data ?? [];
  const filtered = useMemo(() => members.filter(m => {
    if (roleF !== 'all' && m.role !== roleF) return false;
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return m.name.toLowerCase().includes(s)
      || m.email.toLowerCase().includes(s)
      || m.id.toLowerCase().includes(s)
      || (m.employee_id ?? '').toLowerCase().includes(s);
  }), [members, roleF, search]);

  const allowedRoles: Role[] = actorRole === 'owner'
    ? ['owner', 'admin', 'support', 'sales', 'finance', 'analyst']
    : ['admin', 'support', 'sales', 'finance', 'analyst'];

  const onInvite = (body: Parameters<typeof invite.mutate>[0]) => {
    invite.mutate(body, {
      onSuccess: (m) => {
        const n = m.documents?.length ?? 0;
        toast({
          kind: 'success',
          title: 'Member created',
          msg: `${m.name} · ${m.employee_id ?? '—'}${n ? ` · ${n} document${n === 1 ? '' : 's'}` : ''} · OTP ready.`,
        });
        setInviteOpen(false);
      },
      onError: (err) => toast({ kind: 'error', title: 'Create failed', msg: (err as ApiError).message }),
    });
  };

  const setRole = (m: TeamMember, role: Role) => {
    update.mutate({ id: m.id, body: { role } }, {
      onSuccess: () => toast({ kind: 'success', title: 'Role updated', msg: `${m.name} is now ${ROLES[role].name}.` }),
      onError: (err) => toast({ kind: 'error', title: 'Update failed', msg: (err as ApiError).message }),
    });
  };

  const toggleStatus = (m: TeamMember) => {
    const next = m.status === 'active' ? 'deactivated' : 'active';
    update.mutate({ id: m.id, body: { status: next } }, {
      onSuccess: () => toast({ kind: 'success', title: next === 'active' ? 'Reactivated' : 'Deactivated', msg: m.name }),
      onError: (err) => toast({ kind: 'error', title: 'Update failed', msg: (err as ApiError).message }),
    });
  };

  const onUploadDoc = async (memberId: string, file: File | null) => {
    if (!file) return;
    try {
      const body = await fileToTeamDocument(file);
      addDoc.mutate({ memberId, body }, {
        onSuccess: () => toast({ kind: 'success', title: 'Document added', msg: body.file_name }),
        onError: (err) => toast({ kind: 'error', title: 'Upload failed', msg: (err as ApiError).message }),
      });
    } catch (err) {
      toast({ kind: 'error', title: 'Upload failed', msg: err instanceof Error ? err.message : 'Could not read file' });
    } finally {
      setUploadFor(null);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  return (
    <div className="page">
      <div className="row jb fw gap16" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="page-title">Team</h1>
          <p className="muted tiny" style={{ marginTop: 4 }}>Catre operators — profile, documents, and role access.</p>
        </div>
        {manage && (
          <Btn variant="primary" icon={Icon.plus} onClick={() => setInviteOpen(true)}>Add member</Btn>
        )}
      </div>

      <div className="row jb fw gap12" style={{ marginBottom: 14 }}>
        <div className="row gap6" style={{ flexWrap: 'wrap' }}>
          {ROLE_FILTERS.map(f => (
            <button key={f.value} className={'chip' + (roleF === f.value ? ' active' : '')} onClick={() => setRoleF(f.value)}>
              {f.label}
              <span className="tiny" style={{ opacity: 0.6 }}>
                {f.value === 'all' ? members.length : members.filter(m => m.role === f.value).length}
              </span>
            </button>
          ))}
        </div>
        <input className="input" style={{ width: '100%', maxWidth: 240 }} placeholder="Search name, email, employee id…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx,image/*" style={{ display: 'none' }}
        onChange={e => uploadFor && onUploadDoc(uploadFor, e.target.files?.[0] ?? null)} />

      <QueryBoundary isLoading={q.isLoading} isError={q.isError} error={q.error}>
        {filtered.length === 0 ? (
          <Empty title="No teammates">{manage ? 'Invite sales, support, or admin to get started.' : 'No matching members.'}</Empty>
        ) : (
          <div className="card" style={{ overflow: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Employee ID</th>
                  <th>Docs</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  {manage && <th />}
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const docs = m.documents ?? [];
                  const open = docsFor === m.id;
                  return (
                    <React.Fragment key={m.id}>
                      <tr>
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
                        <td className="mono tiny">{m.employee_id || '—'}</td>
                        <td>
                          <button type="button" className="chip" onClick={() => setDocsFor(open ? null : m.id)}>
                            <Icon.upload size={12} />
                            {docs.length}
                          </button>
                        </td>
                        <td><RoleBadge role={m.role} /></td>
                        <td><StatusBadge status={m.status === 'active' ? 'active' : 'deactivated'} /></td>
                        <td className="tiny muted">{fmtWhen(m.joined)}</td>
                        {manage && (
                          <td style={{ textAlign: 'right' }}>
                            <Menu trigger={<Btn variant="ghost" size="sm" icon={Icon.moreH} />}>
                              <MenuItem onClick={() => { setUploadFor(m.id); docInputRef.current?.click(); }}>
                                Add document
                              </MenuItem>
                              <MenuItem onClick={() => setEditId(editId === m.id ? null : m.id)}>Change role</MenuItem>
                              <MenuItem onClick={() => toggleStatus(m)}>
                                {m.status === 'active' ? 'Deactivate' : 'Reactivate'}
                              </MenuItem>
                            </Menu>
                            {editId === m.id && (
                              <div className="row gap6" style={{ marginTop: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {allowedRoles.map(r => (
                                  <button key={r} className="chip" type="button" onClick={() => { setRole(m, r); setEditId(null); }}
                                    style={{ opacity: m.role === r ? 1 : 0.75, fontWeight: m.role === r ? 700 : 500 }}>
                                    {ROLES[r].name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={manage ? 7 : 6} style={{ background: 'var(--surface-2)' }}>
                            {docs.length === 0 ? (
                              <div className="tiny muted" style={{ padding: '8px 4px' }}>No documents yet.</div>
                            ) : (
                              <div className="fc gap6" style={{ padding: '8px 4px' }}>
                                {docs.map(d => (
                                  <div key={d.id} className="row jb gap8">
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontSize: 13, fontWeight: 600 }}>{d.label}</div>
                                      <div className="tiny muted">{d.file_name} · {fmtSize(d.size_bytes)}</div>
                                    </div>
                                    <div className="row gap8">
                                      <button type="button" className="tiny" style={{ fontWeight: 600 }}
                                        onClick={() => downloadTeamDocument(m.id, d.id, d.file_name).catch(err =>
                                          toast({ kind: 'error', title: 'Download failed', msg: (err as ApiError).message }))}>
                                        Download
                                      </button>
                                      {manage && (
                                        <button type="button" className="tiny muted"
                                          onClick={() => delDoc.mutate({ memberId: m.id, docId: d.id }, {
                                            onSuccess: () => toast({ kind: 'success', title: 'Document removed', msg: d.file_name }),
                                            onError: (err) => toast({ kind: 'error', title: 'Delete failed', msg: (err as ApiError).message }),
                                          })}>
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </QueryBoundary>

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
