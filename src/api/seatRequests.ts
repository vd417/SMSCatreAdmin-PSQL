import { listRequest, request } from './client';

export type SeatRequestStatus = 'pending' | 'approved' | 'rejected';

export interface SeatRequest {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  current_seats: number;
  requested_seats: number;
  status: SeatRequestStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export function listSeatRequests(status?: string): Promise<{ data: SeatRequest[] }> {
  return listRequest<{ data: SeatRequest[] }>('/seat-requests', {
    query: status ? { status } : undefined,
  });
}

export function approveSeatRequest(id: string, note?: string): Promise<SeatRequest> {
  return request<SeatRequest>(`/seat-requests/${id}/approve`, {
    method: 'POST',
    body: { note: note ?? null },
  });
}

export function rejectSeatRequest(id: string, note?: string): Promise<SeatRequest> {
  return request<SeatRequest>(`/seat-requests/${id}/reject`, {
    method: 'POST',
    body: { note: note ?? null },
  });
}
