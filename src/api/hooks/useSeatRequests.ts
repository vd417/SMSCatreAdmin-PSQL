import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approveSeatRequest, listSeatRequests, rejectSeatRequest } from '../seatRequests';
import { qk } from '../queryKeys';

export function useSeatRequests(status?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.seatRequests.list(status),
    queryFn: async () => (await listSeatRequests(status)).data,
    enabled: options?.enabled,
  });
}

export function useApproveSeatRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => approveSeatRequest(id, note),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['seatRequests'] }),
        qc.invalidateQueries({ queryKey: ['clients'] }),
        qc.invalidateQueries({ queryKey: ['subscriptions'] }),
        qc.invalidateQueries({ queryKey: ['invoices'] }),
      ]);
    },
  });
}

export function useRejectSeatRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => rejectSeatRequest(id, note),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['seatRequests'] });
    },
  });
}
