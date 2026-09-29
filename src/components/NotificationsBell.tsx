import React from 'react';
import { Menu } from './index';
import { Icon } from '../lib/icons';
import { useNotifications, useMarkNotificationsRead } from '../api/hooks/useNotifications';

/** Topbar bell: the signed-in user's notifications, marked read when the panel is opened. */
export function NotificationsBell(): React.ReactElement {
  const { data } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const items = data ?? [];
  const unread = items.filter(n => n.unread).length;

  return (
    <Menu
      width={330}
      trigger={
        <button className="btn btn-ghost btn-icon notif-btn" title="Notifications"
          onClick={() => { if (unread > 0) markRead.mutate(); }}>
          <Icon.bell size={17} />
          {unread > 0 && <span className="notif-dot" />}
        </button>
      }
    >
      <div className="notif-head">
        <b>Notifications</b>
        {unread > 0 && <span className="badge badge-blue">{unread} new</span>}
      </div>
      <div className="menu-sep" />
      {items.length === 0 ? (
        <p className="tiny muted notif-empty">You're all caught up.</p>
      ) : (
        <div className="notif-list">
          {items.map(n => (
            <div key={n.id} className={'notif-item' + (n.unread ? ' unread' : '')}>
              <div className="notif-item-text">
                <div className="notif-title">{n.title}</div>
                {n.body && <div className="tiny muted">{n.body}</div>}
              </div>
              {n.time && <span className="tiny muted notif-time">{n.time}</span>}
            </div>
          ))}
        </div>
      )}
    </Menu>
  );
}
