import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { NotificationItem } from '../api/types';

const listState: { data: NotificationItem[] | undefined } = { data: [] };
const markRead = vi.fn();

vi.mock('../api/hooks/useNotifications', () => ({
  useNotifications: () => ({ data: listState.data, isLoading: false }),
  useMarkNotificationsRead: () => ({ mutate: markRead }),
}));

const note = (over: Partial<NotificationItem> = {}): NotificationItem => ({
  id: 'n1', tenant_id: null, icon: null, tone: null,
  title: 'Trial ending', body: 'Greenwood High trial ends in 2 days', time: '2h', unread: true,
  ...over,
});

async function renderBell() {
  const { NotificationsBell } = await import('./NotificationsBell');
  return render(<NotificationsBell />);
}

beforeEach(() => {
  listState.data = [];
  markRead.mockClear();
});

describe('NotificationsBell', () => {
  it('hides the unread dot when nothing is unread', async () => {
    listState.data = [note({ unread: false })];
    const { container } = await renderBell();
    expect(container.querySelector('.notif-dot')).toBeNull();
  });

  it('shows the unread dot when a notification is unread', async () => {
    listState.data = [note({ unread: true })];
    const { container } = await renderBell();
    expect(container.querySelector('.notif-dot')).not.toBeNull();
  });

  it('lists notification titles once opened', async () => {
    listState.data = [note({ id: 'n1', title: 'Trial ending' }), note({ id: 'n2', title: 'Invoice past due' })];
    await renderBell();
    fireEvent.click(screen.getByTitle('Notifications'));
    expect(screen.getByText('Trial ending')).toBeInTheDocument();
    expect(screen.getByText('Invoice past due')).toBeInTheDocument();
  });

  it('marks everything read when opened with unread items', async () => {
    listState.data = [note({ unread: true })];
    await renderBell();
    fireEvent.click(screen.getByTitle('Notifications'));
    expect(markRead).toHaveBeenCalledTimes(1);
  });

  it('does not mark read when there is nothing unread', async () => {
    listState.data = [note({ unread: false })];
    await renderBell();
    fireEvent.click(screen.getByTitle('Notifications'));
    expect(markRead).not.toHaveBeenCalled();
  });

  it('shows an empty state when there are no notifications', async () => {
    listState.data = [];
    await renderBell();
    fireEvent.click(screen.getByTitle('Notifications'));
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });
});
