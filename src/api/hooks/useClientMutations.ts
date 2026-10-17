import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient, setClientStatus, changeClientPlan, deleteClient, increaseSeats, setSeatSettings } from '../clients';
import { passwordForgot } from '../auth';
import { qk } from '../queryKeys';
import type { CreateClientBody, ClientStatusAction } from '../types';

const LIST_KEY = ['clients', 'list'] as const;

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateClientBody) => {
      const client = await createClient(body);
      /* passwordForgot: welcome + setup OTP (API may already send; this covers older APIs). */
      if (body.admin_email) {
        try { await passwordForgot(body.admin_email); } catch { /* best-effort */ }
      }
      return client;
    },
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
