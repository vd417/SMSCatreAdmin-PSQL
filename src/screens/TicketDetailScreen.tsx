import React, { useState } from 'react';
import { useNav, useToast, Btn, Avatar, StatusBadge, PRIORITY_MAP } from '../components';
import { Icon } from '../lib/icons';
import { useAuth } from '../auth/AuthContext';
import { QueryBoundary } from '../components/QueryBoundary';
import { useTicket } from '../api/hooks/useTicket';
import { usePatchTicket, usePostMessage } from '../api/hooks/useTicketMutations';
import { useTeam } from '../api/hooks/useTeam';
import type { ApiError } from '../api/ApiError';

export function TicketDetailScreen({ id, onBack }: { id: string; onBack: () => void }): React.ReactElement {
  const nav = useNav();
  const toast = useToast();
  const { can } = useAuth();
  const manage = can('support.manage');

  const detail = useTicket(id);
  const post = usePostMessage(id);
  const patch = usePatchTicket(id);
  const team = useTeam();

  const [reply, setReply] = useState('');

  return (
    <div className="page">
      <button className="row gap6 muted tiny" style={{ marginBottom: 14, fontWeight: 600 }} onClick={onBack}>
        <Icon.chevLeft size={14} /> All tickets
      </button>

      <QueryBoundary isLoading={detail.isLoading} isError={detail.isError} error={detail.error}>
        {detail.data && (
          <>
            <div className="row jb fw gap16" style={{ marginBottom: 18 }}>
              <div>
                <div className="row gap10">
                  <span className={'badge ' + PRIORITY_MAP[detail.data.priority].cls}>{PRIORITY_MAP[detail.data.priority].label}</span>
                  <span className="mono muted tiny">{detail.data.id}</span>
                </div>
                <h1 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 8 }}>{detail.data.subject}</h1>
              </div>
              <div className="row gap8">
                <Btn variant="default" icon={Icon.external} onClick={() => nav.go('client', { id: detail.data!.tenant_id })}>Open client</Btn>
              </div>
            </div>

            <div className="split aside-280">
              {/* thread */}
              <div className="card">
                <div style={{ padding: '6px 0' }}>
                  {detail.data.messages.map((m) => (
                    <div key={m.id} className="row gap12" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-soft)', alignItems: 'flex-start' }}>
                      <Avatar name={m.author} size={32} />
                      <div style={{ flex: 1 }}>
                        <div className="row gap8">
                          <b style={{ fontSize: 13 }}>{m.author}</b>
                          <span className={'badge ' + (m.role === 'agent' ? 'badge-accent' : 'badge-slate')} style={{ height: 18 }}>{m.role === 'agent' ? 'Agent' : 'Client'}</span>
                          <span className="tiny muted" style={{ marginLeft: 'auto' }}>{m.created}</span>
                        </div>
                        <p style={{ fontSize: 13, marginTop: 6, color: 'var(--text-2)', lineHeight: 1.55 }}>{m.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {manage ? (
                  <div style={{ padding: 14 }}>
                    <textarea
                      className="textarea"
                      placeholder="Write a reply…"
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      style={{ minHeight: 70 }}
                    />
                    <div className="row jb" style={{ marginTop: 10 }}>
                      <span className="tiny muted">Replies are visible to the school admin.</span>
                      <Btn
                        variant="primary"
                        size="sm"
                        icon={Icon.send}
                        disabled={!reply.trim()}
                        onClick={() => post.mutate(reply, {
                          onSuccess: () => { setReply(''); toast({ title: 'Reply sent' }); },
                          onError: (e) => toast({ kind: 'error', title: 'Reply failed', msg: (e as ApiError).message }),
                        })}
                      >Send reply</Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 14, textAlign: 'center' }}>
                    <span className="forbidden-note"><Icon.lock /> Your role can view but not reply.</span>
                  </div>
                )}
              </div>

              {/* meta */}
              <div className="card card-pad">
                <div className="tiny muted" style={{ fontWeight: 600, marginBottom: 12 }}>DETAILS</div>
                <dl className="dl" style={{ gridTemplateColumns: '90px 1fr' }}>
                  <dt>Status</dt><dd><StatusBadge status={detail.data.status} /></dd>
                  <dt>Client</dt><dd>{detail.data.tenant_name}</dd>
                  <dt>Created</dt><dd className="mono tiny">{detail.data.created}</dd>
                  <dt>Assignee</dt><dd>{detail.data.assignee || '—'}</dd>
                </dl>
                {manage && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-soft)' }}>
                    <label className="tiny muted" style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>Change status</label>
                    <div className="row gap6 fw" style={{ marginBottom: 14 }}>
                      {(['open', 'pending', 'resolved', 'closed'] as const).map(s => (
                        <button
                          key={s}
                          className={'chip' + (detail.data!.status === s ? ' active' : '')}
                          style={{ textTransform: 'capitalize' }}
                          onClick={() => patch.mutate({ status: s }, { onSuccess: () => toast({ title: 'Status → ' + s, kind: 'info' }) })}
                        >{s}</button>
                      ))}
                    </div>
                    <label className="tiny muted" style={{ fontWeight: 600, display: 'block', marginBottom: 8 }}>Assign to</label>
                    <select
                      className="select"
                      value={detail.data.assignee || ''}
                      onChange={e => patch.mutate(
                        { assignee: e.target.value || null },
                        { onSuccess: () => toast({ title: 'Assigned', msg: e.target.value || 'Unassigned' }) }
                      )}
                    >
                      <option value="">Unassigned</option>
                      {(team.data?.data ?? [])
                        .filter(u => u.status === 'active' && ['support', 'admin', 'owner'].includes(u.role))
                        .map(u => <option key={u.id} value={u.name}>{u.name}</option>)
                      }
                    </select>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
