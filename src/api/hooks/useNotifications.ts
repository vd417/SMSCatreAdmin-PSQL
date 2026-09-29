import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listNotifications, markNotificationsRead } from '../notifications';
import { qk } from '../queryKeys';

export function useNotifications() {
  return useQuery({ queryKey: qk.notifications.list(), queryFn: listNotifications });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.notifications.list() }); },
  });
}
