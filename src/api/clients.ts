import { request, listRequest } from './client';
import type { Client, ClientStatus, ClientUsage, AuditLog, ListEnvelope, CreateClientBody, ClientStatusAction } from './types';
import type { ClientsListParams } from './queryKeys';

/** UI action verbs → backend status nouns for POST /clients/{id}/status. */
const STATUS_BY_ACTION: Record<ClientStatusAction, ClientStatus> = {
  start_trial: 'trial',
  activate: 'active',
  hold: 'hold',
  release: 'active',
  deactivate: 'deactivated',
  reactivate: 'active',
  suspend: 'suspended',
  reinstate: 'active',
  cancel: 'cancelled',
};

export function listClients(params: ClientsListParams, cursor?: string): Promise<ListEnvelope<Client>> {
  return listRequest<ListEnvelope<Client>>('/clients', {
    query: { ...params, limit: params.limit ?? 50, cursor },
  });
}

export function getClient(id: string): Promise<Client> {
  return request<Client>(`/clients/${id}`);
}

/** Backend has no `/clients/{id}/usage` — derive from the client detail payload. */
export async function getClientUsage(id: string): Promise<ClientUsage> {
  const c = await getClient(id);
  const limits = c.limits ?? {};
  const studentLimit = limits.students ?? 0;
  const usage_pct = studentLimit > 0
    ? Math.min(100, Math.round((c.students_count / studentLimit) * 100))
    : 0;
  return {
    students_count: c.students_count ?? 0,
    staff_count: c.staff_count ?? 0,
    storage_gb: c.storage_gb ?? 0,
    limits,
    usage_series: c.usage_series ?? [],
    usage_pct,
  };
}

/** Backend serves tenant activity at `/audit?tenant_id=…`, not `/clients/{id}/activity`. */
export function getClientActivity(id: string, cursor?: string): Promise<ListEnvelope<AuditLog>> {
  return listRequest<ListEnvelope<AuditLog>>('/audit', { query: { tenant_id: id, cursor } });
}

export function createClient(body: CreateClientBody): Promise<Client> {
  return request<Client>('/clients', { method: 'POST', body });
}

export function setClientStatus(id: string, action: ClientStatusAction, reason?: string): Promise<Client> {
  const body: { status: ClientStatus; reason?: string } = { status: STATUS_BY_ACTION[action] };
  if (reason !== undefined) body.reason = reason;
  return request<Client>(`/clients/${id}/status`, { method: 'POST', body });
}

export function changeClientPlan(id: string, plan_id: string): Promise<Client> {
  return request<Client>(`/clients/${id}/change-plan`, { method: 'POST', body: { plan_id } });
}

/** Hard-delete empty school (no students / teachers / staff). Requires confirm: "DELETE". */
export function deleteClient(id: string): Promise<void> {
  return request<void>(`/clients/${id}`, { method: 'DELETE', body: { confirm: 'DELETE' } });
}

/** Raise a school's billed seat limit directly (recomputes MRR, prorates per-student). */
export function increaseSeats(id: string, seatLimit: number, reason?: string): Promise<Client> {
  return request<Client>(`/clients/${id}/seats`, {
    method: 'POST',
    body: { seat_limit: seatLimit, reason: reason ?? null },
  });
}

/** Update a school's seat policy: auto/manual increase mode + near-limit alert threshold. */
export function setSeatSettings(
  id: string,
  body: { seat_increase_mode?: 'auto' | 'manual'; seat_alert_threshold?: number },
): Promise<Client> {
  return request<Client>(`/clients/${id}/seat-settings`, { method: 'POST', body });
}
