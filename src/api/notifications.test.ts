import { describe, it, expect, beforeEach, vi } from 'vitest';
import { listNotifications, markNotificationsRead } from './notifications';

function jr(b: unknown, s = 200): Response {
  return new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
}
beforeEach(() => vi.restoreAllMocks());

describe('listNotifications', () => {
  it('GETs /notifications and unwraps the data envelope', async () => {
    const f = vi.fn().mockResolvedValue(jr({ data: [{ id: 'n1', title: 'Trial ending', unread: true }] }));
    vi.stubGlobal('fetch', f);
    const out = await listNotifications();
    expect(out).toEqual([{ id: 'n1', title: 'Trial ending', unread: true }]);
    expect(String(f.mock.calls[0][0])).toContain('/notifications');
  });
});

describe('markNotificationsRead', () => {
  it('POSTs /notifications/read', async () => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', f);
    await markNotificationsRead();
    const [u, i] = f.mock.calls[0];
    expect(String(u)).toContain('/notifications/read');
    expect(i.method).toBe('POST');
  });
});
