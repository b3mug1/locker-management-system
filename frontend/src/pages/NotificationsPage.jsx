import React, { useEffect, useState } from 'react';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications';

function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const res = await getNotifications();
    setNotifications(res.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    await markNotificationRead(id);
    load();
  };

  const markAll = async () => {
    await markAllNotificationsRead();
    load();
  };

  if (loading) return <div className="loading">Loading notifications...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Notifications</h1>
        <button className="btn btn-outline" onClick={markAll}>Mark all read</button>
      </div>

      <div className="dashboard-card">
        <div className="dash-activity-list">
          {notifications.map(n => (
            <div key={n.id} className="dash-activity-row">
              <div className={`dash-activity-dot ${n.is_read ? 'dot-released' : 'dot-active'}`} />
              <div className="dash-activity-info">
                <span className="dash-activity-name">{n.title}</span>
                <span className="dash-activity-meta">{n.message} · {new Date(n.created_at).toLocaleString()}</span>
              </div>
              {!n.is_read && <button className="btn btn-sm btn-outline" onClick={() => markRead(n.id)}>Read</button>}
            </div>
          ))}
          {notifications.length === 0 && <p className="empty">No notifications yet.</p>}
        </div>
      </div>
    </div>
  );
}

export default NotificationsPage;
