import React, { useEffect, useState } from 'react';
import { getMyDashboard } from '../api/assignments';
import { useLanguage } from '../context/LanguageContext';

function UserDashboard() {
  const { t, lang } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try { const res = await getMyDashboard(); setData(res.data); }
      catch { setError(t('ud_failed_load')); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [t]);

  const formatDate = (d) => {
    if (!d) return '\u2014';
    const date = new Date(d);
    const locale = lang === 'ru' ? 'ru-RU' : 'en-GB';
    return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  const getDaysSince = (d) => {
    if (!d) return 0;
    return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
  };

  if (loading) return <div className="loading">{t('ud_loading')}</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return null;

  const pastAssignments = data.assignments.filter(a => a.released_at);

  return (
    <div className="user-dashboard">
      <div className="ud-header">
        <div className="ud-greeting">
          <h1>{data.student ? t('ud_welcome_name', { name: data.student.full_name }) : t('ud_welcome')}</h1>
          <p className="ud-email">{data.email}</p>
        </div>
      </div>

      {data.student && (
        <div className="ud-profile-card">
          <div className="ud-profile-avatar">
            {data.student.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="ud-profile-details">
            <h2>{data.student.full_name}</h2>
            <div className="ud-profile-tags">
              <span className="ud-tag ud-tag-blue">{data.student.group}</span>
              <span className="ud-tag ud-tag-purple">{data.student.course} {t('ud_course')}</span>
              <span className="ud-tag ud-tag-gray">{data.student.barcode}</span>
            </div>
          </div>
          <div className="ud-profile-stats">
            <div className="ud-mini-stat">
              <span className="ud-mini-stat-value">{data.total_assignments}</span>
              <span className="ud-mini-stat-label">{t('ud_total')}</span>
            </div>
            <div className="ud-mini-stat">
              <span className="ud-mini-stat-value ud-active-value">{data.active_count}</span>
              <span className="ud-mini-stat-label">{t('ud_active')}</span>
            </div>
            <div className="ud-mini-stat">
              <span className="ud-mini-stat-value">{pastAssignments.length}</span>
              <span className="ud-mini-stat-label">{t('ud_past')}</span>
            </div>
          </div>
        </div>
      )}

      {data.active_locker ? (
        <div className="ud-active-section">
          <h2 className="ud-section-title">{t('ud_active_locker')}</h2>
          <div className="ud-locker-detail-card">
            <div className="ud-locker-header">
              <div className="ud-locker-number">{data.active_locker.number}</div>
              <span className="status-badge status-active">{t('ud_active')}</span>
            </div>
            <div className="ud-locker-grid">
              <div className="ud-locker-field">
                <span className="ud-field-label">{t('ud_floor')}</span>
                <span className="ud-field-value">{data.active_locker.floor}</span>
              </div>
              <div className="ud-locker-field">
                <span className="ud-field-label">{t('ud_size')}</span>
                <span className="ud-field-value">{data.active_locker.size}</span>
              </div>
              <div className="ud-locker-field">
                <span className="ud-field-label">{t('ud_access')}</span>
                <span className="ud-field-value">{data.active_locker.access_type}</span>
              </div>
              <div className="ud-locker-field">
                <span className="ud-field-label">{t('ud_capacity')}</span>
                <span className="ud-field-value">{data.active_locker.occupied}/{data.active_locker.capacity}</span>
              </div>
              <div className="ud-locker-field">
                <span className="ud-field-label">{t('ud_assigned')}</span>
                <span className="ud-field-value">{formatDate(data.active_locker.assigned_at)}</span>
              </div>
              <div className="ud-locker-field">
                <span className="ud-field-label">{t('ud_duration')}</span>
                <span className="ud-field-value">{getDaysSince(data.active_locker.assigned_at)} {t('ud_days')}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">&#128275;</div>
          <h2>{t('ud_no_locker')}</h2>
          <p>{t('ud_no_locker_desc')}</p>
        </div>
      )}

      {pastAssignments.length > 0 && (
        <div className="ud-history-section">
          <h2 className="ud-section-title">{t('ud_history')}</h2>
          <div className="ud-history-cards">
            {pastAssignments.map((a) => (
              <div key={a.id} className="ud-history-card">
                <div className="ud-history-card-left">
                  <span className="ud-history-locker">{a.locker_number}</span>
                  <span className="ud-history-meta">{t('ud_floor')} {a.locker_floor}  {a.locker_size}  {a.locker_access_type}</span>
                </div>
                <div className="ud-history-card-right">
                  <span className="ud-history-dates">{formatDate(a.assigned_at)}  {formatDate(a.released_at)}</span>
                  <span className="status-badge status-released">{t('ud_released')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!data.student && (
        <div className="empty-state">
          <div className="empty-icon">&#128100;</div>
          <h2>{t('ud_no_profile')}</h2>
          <p>{t('ud_no_profile_desc')}</p>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;
