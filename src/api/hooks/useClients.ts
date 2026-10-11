import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { listClients, getClientUsage, getClientActivity } from '../clients';
import { qk, type ClientsListParams } from '../queryKeys';

export function useClients(params: ClientsListParams, enabled = true) {
  return useInfiniteQuery({
    queryKey: qk.clients.list(params),
    queryFn: ({ pageParam }) => listClients(params, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled,
  });
}

export function useClientUsage(id: string) {
  return useQuery({ queryKey: qk.clients.usage(id), queryFn: () => getClientUsage(id), enabled: !!id });
}

export function useClientActivity(id: string) {
  return useQuery({ queryKey: qk.clients.activity(id), queryFn: () => getClientActivity(id), enabled: !!id });
}
