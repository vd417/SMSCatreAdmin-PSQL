import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient, setClientStatus, changeClientPlan, deleteClient, increaseSeats, setSeatSettings, updateClient } from '../clients';
import type { UpdateClientProfileBody } from '../clients';
import { qk } from '../queryKeys';
import type { CreateClientBody, ClientStatusAction } from '../types';

const LIST_KEY = ['clients', 'list'] as const;

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    // The API sends a warm welcome email (no OTP) on create. The owner sets their
    // password from the panel's "Create a password" flow, where the one-time code is sent —
    // so we no longer fire a password-setup OTP here.
    mutationFn: (body: CreateClientBody) => createClient(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: LIST_KEY }); },
  });
}

export function useSetClientStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: ClientStatusAction) => setClientStatus(id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients.detail(id) });
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: qk.subscriptions.list() });
      qc.invalidateQueries({ queryKey: ['invoices', 'list'] });
      qc.invalidateQueries({ queryKey: qk.dashboard() });
      qc.invalidateQueries({ queryKey: qk.onboarding.list() });
    },
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateClientProfileBody) => updateClient(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients.detail(id) });
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useChangeClientPlan(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (plan_id: string) => changeClientPlan(id, plan_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients.detail(id) });
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useIncreaseSeats(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ seatLimit, reason }: { seatLimit: number; reason?: string }) => increaseSeats(id, seatLimit, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients.detail(id) });
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: qk.subscriptions.list() });
      qc.invalidateQueries({ queryKey: ['invoices', 'list'] });
    },
  });
}

export function useSetSeatSettings(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { seat_increase_mode?: 'auto' | 'manual'; seat_alert_threshold?: number }) => setSeatSettings(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.clients.detail(id) });
      qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useDeleteClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteClient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: qk.dashboard() });
      qc.invalidateQueries({ queryKey: qk.onboarding.list() });
      qc.invalidateQueries({ queryKey: qk.subscriptions.list() });
      qc.invalidateQueries({ queryKey: ['invoices', 'list'] });
      qc.removeQueries({ queryKey: qk.clients.detail(id) });
    },
  });
}
