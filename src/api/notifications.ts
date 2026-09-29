import { request } from './client';
import type { NotificationItem } from './types';

/** GET /v1/notifications — the signed-in user's own notifications, newest first. */
export function listNotifications(): Promise<NotificationItem[]> {
  return request<NotificationItem[]>('/notifications');
}

/** POST /v1/notifications/read — marks every one of them read. */
export function markNotificationsRead(): Promise<void> {
  return request<void>('/notifications/read', { method: 'POST' });
}
