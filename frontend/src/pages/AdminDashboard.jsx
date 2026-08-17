import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats } from '../api/assignments';
import { useLanguage } from '../context/LanguageContext';
import { animate } from 'animejs';
import { animateStagger } from '../utils/animations';

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await getDashboardStats();
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch dashboard stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    if (!stats) return;
    // Animate stat cards and rows
    animateStagger('.dash-hero-stat, .dash-occupancy-card, .dash-stat-card, .dash-quick-btn, .dash-activity-item', {
      delay: 45,
      duration: 500,
    });

    // Animate ring progress stroke
    try {
      animate('.dash-ring-fill', {
        strokeDashoffset: [314, 0],
        duration: 1000,
        ease: 'outCubic',
      });
    } catch (err) {
      console.debug('Ring animation fallback', err);
    }
  }, [stats]);

  const formatDate = (d) => {
    if (!d) return '\u2014';
    const date = new Date(d);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const getTimeAgo = (d) => {
    if (!d) return '';
    const now = new Date();
    const date = new Date(d);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t('dash_just_now');
    if (diffMins < 60) return `${diffMins}${t('dash_m_ago')}`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}${t('dash_h_ago')}`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}${t('dash_d_ago')}`;
  };

  if (loading) return <div className="loading">{t('dash_loading')}</div>;
  if (!stats) return <div className="alert alert-error">{t('dash_error')}</div>;

  const occupancyColor = stats.occupancy_rate > 80 ? 'danger' : stats.occupancy_rate > 50 ? 'warning' : 'success';

  return (
    <div className="dashboard">
      <div className="dash-hero">
        <div className="dash-hero-content">
          <h1>{t('dash_title')}</h1>
          <p className="dash-hero-subtitle">{t('dash_subtitle')}</p>
        </div>
        <div className="dash-hero-stats">
          <div className="dash-hero-stat">
            <span className="dash-hero-stat-value">{stats.total_capacity}</span>
            <span className="dash-hero-stat-label">{t('dash_total_capacity')}</span>
          </div>
          <div className="dash-hero-divider" />
          <div className="dash-hero-stat">
            <span className="dash-hero-stat-value">{stats.active_assignments}</span>
            <span className="dash-hero-stat-label">{t('dash_occupied')}</span>
          </div>
          <div className="dash-hero-divider" />
          <div className="dash-hero-stat">
            <span className="dash-hero-stat-value">{stats.available_spots}</span>
            <span className="dash-hero-stat-label">{t('dash_available')}</span>
          </div>
        </div>
      </div>

      <div className="dash-top-row">
        <div className="dash-occupancy-card">
          <div className="dash-ring-wrapper">
            <svg className="dash-ring" viewBox="0 0 120 120">
              <circle className="dash-ring-bg" cx="60" cy="60" r="50" />
              <circle
                className={`dash-ring-fill dash-ring-${occupancyColor}`}
                cx="60" cy="60" r="50"
                strokeDasharray={`${stats.occupancy_rate * 3.14} ${314 - stats.occupancy_rate * 3.14}`}
                strokeDashoffset="0"
              />
            </svg>
            <div className="dash-ring-label">
              <span className="dash-ring-value">{stats.occupancy_rate}%</span>
              <span className="dash-ring-text">{t('dash_occupied_pct')}</span>
            </div>
          </div>
          <div className="dash-occupancy-legend">
            <div className="dash-legend-item">
              <span className="dash-legend-dot dash-legend-used" />
              <span>{t('dash_used')} ({stats.active_assignments})</span>
            </div>
            <div className="dash-legend-item">
              <span className="dash-legend-dot dash-legend-free" />
              <span>{t('dash_free')} ({stats.available_spots})</span>
            </div>
          </div>
        </div>

        <div className="dash-stat-cards">
          <Link to="/students" className="dash-stat-card dash-stat-blue">
            <div className="dash-stat-icon">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            </div>
            <div className="dash-stat-body">
              <span className="dash-stat-number">{stats.students_count}</span>
              <span className="dash-stat-label">{t('dash_students')}</span>
            </div>
            <span className="dash-stat-arrow">{'\u2192'}</span>
          </Link>

          <Link to="/lockers" className="dash-stat-card dash-stat-purple">
            <div className="dash-stat-icon">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="18" rx="2" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="2" y1="12" x2="22" y2="12" /><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="16" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="17" r="1" fill="currentColor"/><circle cx="16" cy="17" r="1" fill="currentColor"/></svg>
            </div>
            <div className="dash-stat-body">
              <span className="dash-stat-number">{stats.lockers_count}</span>
              <span className="dash-stat-label">{t('dash_lockers')}</span>
            </div>
            <span className="dash-stat-arrow">{'\u2192'}</span>
          </Link>

          <Link to="/assignments" className="dash-stat-card dash-stat-green">
            <div className="dash-stat-icon">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </div>
            <div className="dash-stat-body">
              <span className="dash-stat-number">{stats.active_assignments}</span>
              <span className="dash-stat-label">{t('dash_assignments')}</span>
            </div>
            <span className="dash-stat-arrow">{'\u2192'}</span>
          </Link>

          <Link to="/users" className="dash-stat-card dash-stat-cyan">
            <div className="dash-stat-icon">
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <div className="dash-stat-body">
              <span className="dash-stat-number">{stats.users_count}</span>
              <span className="dash-stat-label">{t('dash_users')}</span>
            </div>
            <span className="dash-stat-arrow">{'\u2192'}</span>
          </Link>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>{t('dash_recent')}</h2>
            <Link to="/assignments" className="dash-view-all">{t('dash_view_all')}</Link>
          </div>
          <div className="dashboard-table-wrapper">
            {stats.recent_assignments.length === 0 ? (
              <div className="dash-empty-state">
                <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" opacity="0.4"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>
                <span>{t('dash_no_assignments')}</span>
              </div>
            ) : (
              <div className="dash-activity-list">
                {stats.recent_assignments.map((a) => (
                  <div key={a.id} className="dash-activity-row">
                    <div className={`dash-activity-dot ${a.released_at ? 'dot-released' : 'dot-active'}`} />
                    <div className="dash-activity-info">
                      <span className="dash-activity-name">{a.student_name || '\u2014'}</span>
                      <span className="dash-activity-meta">
                        {t('dash_locker')} <strong>{a.locker_number || '\u2014'}</strong> {'\u00b7'} {getTimeAgo(a.assigned_at)}
                      </span>
                    </div>
                    <span className={`status-badge ${a.released_at ? 'status-released' : 'status-active'}`}>
                      {a.released_at ? t('dash_released') : t('dash_active')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>{t('dash_occupancy_floor')}</h2>
            <Link to="/lockers" className="dash-view-all">{t('dash_view_lockers')}</Link>
          </div>
          {stats.floor_stats.length === 0 ? (
            <div className="dash-empty-state" style={{ padding: '2rem' }}>
              <svg width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" opacity="0.4"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /></svg>
              <span>{t('dash_no_lockers')}</span>
            </div>
          ) : (
            <div className="floor-stats">
              {stats.floor_stats.map((f) => {
                const pct = f.capacity > 0 ? Math.round(f.occupied / f.capacity * 100) : 0;
                return (
                  <div className="floor-row" key={f.floor}>
                    <div className="floor-label">
                      <span className="floor-name">{t('dash_floor')} {f.floor}</span>
                      <span className="floor-detail">{f.lockers} {t('dash_lockers_unit')} {'\u00b7'} {f.occupied}/{f.capacity} {t('dash_used_unit')}</span>
                    </div>
                    <div className="floor-bar-track">
                      <div
                        className={`floor-bar-fill ${pct > 80 ? 'bar-danger' : pct > 50 ? 'bar-warning' : 'bar-success'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="floor-pct">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}

          {stats.students_by_course.length > 0 && (
            <>
              <div className="dashboard-card-divider" />
              <div className="dashboard-card-header" style={{ paddingTop: '0.5rem' }}>
                <h2>{t('dash_students_by_course')}</h2>
              </div>
              <div className="course-stats">
                {stats.students_by_course.map((c) => (
                  <div className="course-chip" key={c.course}>
                    <span className="course-number">{c.course}</span>
                    <span className="course-label">{t('dash_course')}</span>
                    <span className="course-count">{c.count} {t('dash_students_unit')}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
