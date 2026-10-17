import React, { useMemo, useState } from 'react';
import {
  useApproveSeatRequest,
  useRejectSeatRequest,
  useSeatRequests,
} from '../../api/hooks/useSeatRequests';
import { useAuth } from '../../auth/AuthContext';
import { useToast, Btn, ConfirmDialog, fmt } from '../index';
import { QueryBoundary } from '../QueryBoundary';
import type { ApiError } from '../../api/ApiError';
import type { SeatRequest, SeatRequestStatus } from '../../api/seatRequests';

const FILTERS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'all', label: 'All history' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const statusChip: Record<SeatRequestStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export function SeatRequestsTab(): React.ReactElement {
  const { can } = useAuth();
  const toast = useToast();
  const [filter, setFilter] = useState('pending');
  const [rejectTarget, setRejectTarget] = useState<SeatRequest | null>(null);
  const [approveTarget, setApproveTarget] = useState<SeatRequest | null>(null);

  const query = useSeatRequests(undefined);
  const all = query.data ?? [];
  const rows = filter === 'all' ? all : all.filter(r => r.status === filter);
  const approve = useApproveSeatRequest();
  const reject = useRejectSeatRequest();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const f of FILTERS) {
      if (f.key === 'all') continue;
      c[f.key] = all.filter(r => r.status === f.key).length;
    }
    return c;
  }, [all]);

  return (
    <div>
      <div className="row gap8" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={'chip' + (filter === f.key ? ' active' : '')}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="tiny" style={{ opacity: 0.6 }}>{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>School</th>
                <th>Seats</th>
                <th>Status</th>
                <th>Raised</th>
                <th style={{ width: 180 }}></th>
              </tr>
            </thead>
            <QueryBoundary
              isLoading={query.isLoading}
              isError={query.isError}
              error={query.error}
              isEmpty={rows.length === 0}
              emptyTitle="No seat requests"
            >
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.tenant_name ?? '—'}</td>
                    <td className="muted">
                      {fmt.num(r.current_seats)} → <b>{fmt.num(r.requested_seats)}</b> seats
                    </td>
                    <td><span className="chip">{statusChip[r.status] ?? r.status}</span></td>
                    <td className="tiny muted mono">{r.created_at?.slice(0, 10)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      {r.status === 'pending' && can('billing.view') && (
                        <div className="row gap6" style={{ justifyContent: 'flex-end' }}>
                          <Btn variant="primary" size="sm" disabled={approve.isPending}
                            onClick={() => setApproveTarget(r)}>Approve</Btn>
                          <Btn variant="default" size="sm" disabled={reject.isPending}
                            onClick={() => setRejectTarget(r)}>Reject</Btn>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </QueryBoundary>
          </table>
        </div>
      </div>

      {approveTarget && (
        <ConfirmDialog
          open
          onClose={() => setApproveTarget(null)}
          title="Approve seat increase"
          message={`Raise ${approveTarget.tenant_name} to ${fmt.num(approveTarget.requested_seats)} billed seats? This updates the cap, recomputes MRR and issues the prorated top-up invoice.`}
          confirmLabel="Approve & bill"
          onConfirm={() => {
            approve.mutate({ id: approveTarget.id }, {
              onSuccess: () => {
                toast({ title: 'Seats increased', msg: `${approveTarget.tenant_name} → ${fmt.num(approveTarget.requested_seats)} seats` });
                setApproveTarget(null);
              },
              onError: (e) => toast({ title: 'Approve failed', msg: (e as ApiError).message, kind: 'error' }),
            });
          }}
        />
      )}

      {rejectTarget && (
        <ConfirmDialog
          open
          onClose={() => setRejectTarget(null)}
          title="Reject seat request"
          message={`Reject the request to raise ${rejectTarget.tenant_name} to ${fmt.num(rejectTarget.requested_seats)} seats?`}
          confirmLabel="Reject"
          danger
          onConfirm={() => {
            reject.mutate({ id: rejectTarget.id }, {
              onSuccess: () => {
                toast({ title: 'Request rejected', msg: rejectTarget.tenant_name ?? '' });
                setRejectTarget(null);
              },
              onError: (e) => toast({ title: 'Reject failed', msg: (e as ApiError).message, kind: 'error' }),
            });
          }}
        />
      )}
    </div>
  );
}
