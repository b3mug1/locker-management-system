import React, { useEffect, useState } from 'react';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications';
import { useLanguage } from '../context/LanguageContext';

const translateNotificationTitle = (title, t) => {
  const knownTitles = {
    'Locker assigned': 'notifications_locker_assigned_title',
    'Locker released': 'notifications_locker_released_title',
    'Incident created': 'notifications_incident_created_title',
  };
  return knownTitles[title] ? t(knownTitles[title]) : title;
};

const translateNotificationMessage = (message, t) => {
  let match = message?.match(/^Locker (.+) on floor (.+) has been assigned to you\.$/);
  if (match) return t('notifications_locker_assigned_msg', { locker: match[1], floor: match[2] });

  match = message?.match(/^Locker (.+) has been released\.$/);
  if (match) return t('notifications_locker_released_msg', { locker: match[1] });

  match = message?.match(/^Locker (.+) moved to maintenance: (.+)$/);
  if (match) return t('notifications_incident_created_msg', { locker: match[1], title: match[2] });

  return message;
};

function NotificationsPage() {
  const { t } = useLanguage();
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
    window.dispatchEvent(new CustomEvent('notification_change'));
    load();
  };

  const markAll = async () => {
    await markAllNotificationsRead();
    window.dispatchEvent(new CustomEvent('notification_change'));
    load();
  };

  if (loading) return <div className="loading">{t('notifications_loading')}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('notifications_title')}</h1>
        <button className="btn btn-outline" onClick={markAll}>{t('notifications_mark_all_read')}</button>
      </div>

      <div className="dashboard-card">
        <div className="dash-activity-list">
          {notifications.map(n => (
            <div key={n.id} className="dash-activity-row">
              <div className={`dash-activity-dot ${n.is_read ? 'dot-released' : 'dot-active'}`} />
              <div className="dash-activity-info">
                <span className="dash-activity-name">{translateNotificationTitle(n.title, t)}</span>
                <span className="dash-activity-meta">{translateNotificationMessage(n.message, t)} &middot; {new Date(n.created_at).toLocaleString()}</span>
              </div>
              {!n.is_read && <button className="btn btn-sm btn-outline" onClick={() => markRead(n.id)}>{t('notifications_read')}</button>}
            </div>
          ))}
          {notifications.length === 0 && <p className="empty">{t('notifications_empty')}</p>}
        </div>
      </div>
    </div>
  );
}

export default NotificationsPage;
