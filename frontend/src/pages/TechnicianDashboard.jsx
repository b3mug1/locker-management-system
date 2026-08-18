import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getMyTechnicianTasks, startRepair, resolveIncident } from '../api/incidents';
import { useWebSocket } from '../hooks/useWebSocket';
import { useLanguage } from '../context/LanguageContext';
import { animateStagger, animateModalOpen } from '../utils/animations';

export default function TechnicianDashboard() {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  // Modal for resolving task with notes
  const [resolveModal, setResolveModal] = useState({ open: false, task: null, notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const resolveModalRef = useRef(null);
  const resolveOverlayRef = useRef(null);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await getMyTechnicianTasks();
      setTasks(res.data);
    } catch {
      setError(t('incidents_failed_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (tasks.length > 0) {
      animateStagger('.tech-card, .dash-hero-stat', { delay: 40, duration: 450 });
    }
  }, [tasks, filterStatus]);

  useEffect(() => {
    if (resolveModal.open) {
      document.body.style.overflow = 'hidden';
      animateModalOpen(resolveModalRef.current, resolveOverlayRef.current);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [resolveModal.open]);

  useWebSocket({ incident_change: fetchTasks, locker_change: fetchTasks });

  const handleStartRepair = async (id) => {
    try {
      await startRepair(id);
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.detail || t('incidents_operation_failed'));
    }
  };

  const handleOpenResolveModal = (task) => {
    setResolveModal({ open: true, task, notes: '' });
  };

  const handleConfirmResolve = async (e) => {
    e.preventDefault();
    if (!resolveModal.task) return;
    setSubmitting(true);
    try {
      await resolveIncident(resolveModal.task.id, resolveModal.notes);
      setResolveModal({ open: false, task: null, notes: '' });
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.detail || t('incidents_operation_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filterStatus === 'all') return true;
    return task.status === filterStatus;
  });

  const countAssigned = tasks.filter(t => t.status === 'assigned' || t.status === 'open').length;
  const countInProgress = tasks.filter(t => t.status === 'in_progress').length;
  const countResolved = tasks.filter(t => t.status === 'resolved').length;

  const typeLabels = {
    broken_door: t('incident_type_broken_door'),
    lost_key: t('incident_type_lost_key'),
    lock_broken: t('incident_type_lock_broken'),
    needs_repair: t('incident_type_needs_repair'),
    other: t('incident_type_other'),
  };

  const statusLabels = {
    open: t('incident_status_open'),
    assigned: t('incident_status_assigned'),
    in_progress: t('incident_status_in_progress'),
    resolved: t('incident_status_resolved'),
    cancelled: t('incident_status_cancelled'),
  };

  const statusClass = (status) => {
    switch (status) {
      case 'open': return 'badge-warning';
      case 'assigned': return 'badge-info';
      case 'in_progress': return 'badge-primary';
      case 'resolved': return 'badge-success';
      default: return 'badge-secondary';
    }
  };

  return (
    <div className="page technician-page minimal-page">
      {/* Minimalist Architectural Header */}
      <div className="minimal-hero-section">
        <div className="minimal-hero-left">
          <span className="minimal-eyebrow">AITU LOCKER SYSTEM · WORKSPACE</span>
          <h1 className="minimal-headline">{t('tech_dashboard_title')}</h1>
          <p className="minimal-subtitle">{t('tech_dashboard_subtitle')}</p>
        </div>

        <div className="minimal-hero-stats">
          <div className="minimal-stat-card">
            <span className="minimal-stat-num">{countAssigned}</span>
            <span className="minimal-stat-lbl">{t('tech_assigned_tasks')}</span>
          </div>
          <div className="minimal-stat-divider" />
          <div className="minimal-stat-card">
            <span className="minimal-stat-num">{countInProgress}</span>
            <span className="minimal-stat-lbl">{t('tech_in_progress')}</span>
          </div>
          <div className="minimal-stat-divider" />
          <div className="minimal-stat-card">
            <span className="minimal-stat-num">{countResolved}</span>
            <span className="minimal-stat-lbl">{t('tech_resolved_today')}</span>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Minimalist Segmented Tabs */}
      <div className="minimal-filters-row">
        <div className="minimal-tabs-bar">
          <button
            className={`minimal-tab-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            {t('incidents_all_statuses')} <span className="tab-count">{tasks.length}</span>
          </button>
          <button
            className={`minimal-tab-btn ${filterStatus === 'assigned' ? 'active' : ''}`}
            onClick={() => setFilterStatus('assigned')}
          >
            {t('incident_status_assigned')} <span className="tab-count">{countAssigned}</span>
          </button>
          <button
            className={`minimal-tab-btn ${filterStatus === 'in_progress' ? 'active' : ''}`}
            onClick={() => setFilterStatus('in_progress')}
          >
            {t('incident_status_in_progress')} <span className="tab-count">{countInProgress}</span>
          </button>
          <button
            className={`minimal-tab-btn ${filterStatus === 'resolved' ? 'active' : ''}`}
            onClick={() => setFilterStatus('resolved')}
          >
            {t('incident_status_resolved')} <span className="tab-count">{countResolved}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">{t('incidents_loading')}</div>
      ) : filteredTasks.length === 0 ? (
        <div className="empty-state minimal-empty">
          <p>{t('tech_no_tasks')}</p>
        </div>
      ) : (
        <div className="minimal-cards-grid">
          {filteredTasks.map((task) => (
            <div key={task.id} className={`minimal-card ${task.status === 'in_progress' ? 'in-progress' : ''}`}>
              <div className="minimal-card-top">
                <div className="minimal-unit-wrap">
                  <span className="minimal-unit-title">LOCKER #{task.locker_number || task.locker_id}</span>
                  {task.locker_floor && (
                    <span className="minimal-floor-tag">
                      {t('tech_task_card_floor')} {task.locker_floor}
                    </span>
                  )}
                </div>
                <div className={`minimal-status-pill ${task.status}`}>
                  <span className="minimal-status-dot" />
                  <span>{statusLabels[task.status] || task.status}</span>
                </div>
              </div>

              <div className="minimal-card-body">
                <h3 className="minimal-item-title">{task.title}</h3>

                <div className="minimal-meta-tags">
                  <span className="minimal-type-chip">
                    {typeLabels[task.type] || task.type}
                  </span>
                  {task.created_by_name && (
                    <span className="minimal-reporter-tag">
                      {t('incident_reporter')}: <strong>{task.created_by_name}</strong>
                    </span>
                  )}
                </div>

                {task.description && (
                  <p className="minimal-desc-box">{task.description}</p>
                )}

                {task.image_url && (
                  <div
                    className="minimal-photo-box"
                    onClick={() => setSelectedPhoto(task.image_url)}
                    title={t('incident_photo_click_zoom')}
                  >
                    <img
                      src={task.image_url}
                      alt="Defect"
                      className="minimal-thumb-img"
                    />
                    <div className="minimal-photo-info">
                      <span className="minimal-photo-action-text">{t('tech_view_photo')}</span>
                      <span className="minimal-photo-arrow">→</span>
                    </div>
                  </div>
                )}

                {task.technician_notes && (
                  <div className="minimal-notes-callout">
                    <span className="minimal-notes-title">{t('incident_tech_notes')}</span>
                    <p className="minimal-notes-text">{task.technician_notes}</p>
                  </div>
                )}
              </div>

              <div className="minimal-card-bottom">
                {task.status === 'assigned' || task.status === 'open' ? (
                  <button
                    className="minimal-action-btn"
                    onClick={() => handleStartRepair(task.id)}
                  >
                    <span>{t('incident_start_repair')}</span>
                    <span className="btn-arrow">→</span>
                  </button>
                ) : null}

                {task.status === 'in_progress' ? (
                  <button
                    className="minimal-action-btn complete-btn"
                    onClick={() => handleOpenResolveModal(task)}
                  >
                    <span>{t('incident_resolve_repair')}</span>
                    <span className="btn-arrow">→</span>
                  </button>
                ) : null}

                {task.status === 'resolved' ? (
                  <div className="minimal-resolved-badge">
                    <span className="minimal-check-circle">✓</span>
                    <span>{t('incident_status_resolved')} ({new Date(task.resolved_at || task.created_at).toLocaleDateString()})</span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zoom Photo Modal */}
      {selectedPhoto && (
        <div className="modal-overlay" onClick={() => setSelectedPhoto(null)}>
          <div className="photo-zoom-modal" onClick={e => e.stopPropagation()}>
            <img src={selectedPhoto} alt="Zoomed defect" className="photo-zoom-img" />
            <button className="btn btn-secondary photo-zoom-close" onClick={() => setSelectedPhoto(null)}>
              {t('btn_cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Resolve Incident Report Modal */}
      {resolveModal.open && (
        <div className="modal-overlay" ref={resolveOverlayRef} onClick={() => setResolveModal({ open: false, task: null, notes: '' })}>
          <div className="modal-content" ref={resolveModalRef} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('incident_resolve_modal_title')}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setResolveModal({ open: false, task: null, notes: '' })}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleConfirmResolve}>
              <div className="modal-body">
                <p>
                  <strong>{t('incidents_locker')}:</strong> #{resolveModal.task?.locker_number} ({resolveModal.task?.title})
                </p>
                <div className="form-group">
                  <label>{t('incident_tech_notes')}</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    required
                    placeholder={t('incident_notes_placeholder')}
                    value={resolveModal.notes}
                    onChange={(e) => setResolveModal({ ...resolveModal, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setResolveModal({ open: false, task: null, notes: '' })}
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={submitting || !resolveModal.notes.trim()}
                >
                  {submitting ? '...' : t('incident_resolve_repair')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
