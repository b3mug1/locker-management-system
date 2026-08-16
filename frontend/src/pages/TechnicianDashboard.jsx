import React, { useEffect, useState, useCallback } from 'react';
import { getMyTechnicianTasks, startRepair, resolveIncident } from '../api/incidents';
import { useWebSocket } from '../hooks/useWebSocket';
import { useLanguage } from '../context/LanguageContext';

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
    <div className="page technician-page">
      <div className="dash-hero">
        <div className="dash-hero-content">
          <h1>{t('tech_dashboard_title')}</h1>
          <p className="dash-hero-subtitle">{t('tech_dashboard_subtitle')}</p>
        </div>
        <div className="dash-hero-stats">
          <div className="dash-hero-stat">
            <span className="dash-hero-stat-value">{countAssigned}</span>
            <span className="dash-hero-stat-label">{t('tech_assigned_tasks')}</span>
          </div>
          <div className="dash-hero-stat">
            <span className="dash-hero-stat-value">{countInProgress}</span>
            <span className="dash-hero-stat-label">{t('tech_in_progress')}</span>
          </div>
          <div className="dash-hero-stat">
            <span className="dash-hero-stat-value">{countResolved}</span>
            <span className="dash-hero-stat-label">{t('tech_resolved_today')}</span>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="tech-filters-bar">
        <div className="btn-group">
          <button
            className={`btn btn-sm ${filterStatus === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterStatus('all')}
          >
            {t('incidents_all_statuses')} ({tasks.length})
          </button>
          <button
            className={`btn btn-sm ${filterStatus === 'assigned' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterStatus('assigned')}
          >
            {t('incident_status_assigned')} ({countAssigned})
          </button>
          <button
            className={`btn btn-sm ${filterStatus === 'in_progress' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterStatus('in_progress')}
          >
            {t('incident_status_in_progress')} ({countInProgress})
          </button>
          <button
            className={`btn btn-sm ${filterStatus === 'resolved' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterStatus('resolved')}
          >
            {t('incident_status_resolved')} ({countResolved})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">{t('incidents_loading')}</div>
      ) : filteredTasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">Info</div>
          <p>{t('tech_no_tasks')}</p>
        </div>
      ) : (
        <div className="tech-cards-grid">
          {filteredTasks.map((task) => (
            <div key={task.id} className={`tech-card ${task.status === 'in_progress' ? 'active-border' : ''}`}>
              <div className="tech-card-header">
                <div className="tech-card-locker">
                  <span className="tech-locker-num">#{task.locker_number || 'N/A'}</span>
                  {task.locker_floor && (
                    <span className="badge badge-outline">
                      {t('tech_task_card_floor')} {task.locker_floor}
                    </span>
                  )}
                </div>
                <span className={`badge ${statusClass(task.status)}`}>
                  {statusLabels[task.status] || task.status}
                </span>
              </div>

              <div className="tech-card-body">
                <h3 className="tech-task-title">{task.title}</h3>
                <div className="tech-task-meta">
                  <span className="badge badge-light">
                    {typeLabels[task.type] || task.type}
                  </span>
                  {task.created_by_name && (
                    <span className="tech-reporter">
                      {t('incident_reporter')}: <strong>{task.created_by_name}</strong>
                    </span>
                  )}
                </div>

                {task.description && (
                  <p className="tech-task-desc">{task.description}</p>
                )}

                {task.image_url && (
                  <div className="tech-photo-preview-wrap">
                    <img
                      src={task.image_url}
                      alt="Defect"
                      className="tech-photo-thumb"
                      onClick={() => setSelectedPhoto(task.image_url)}
                      title={t('incident_photo_click_zoom')}
                    />
                    <span className="tech-photo-hint">{t('tech_view_photo')}</span>
                  </div>
                )}

                {task.technician_notes && (
                  <div className="tech-notes-box">
                    <strong>{t('incident_tech_notes')}:</strong>
                    <p>{task.technician_notes}</p>
                  </div>
                )}
              </div>

              <div className="tech-card-footer">
                {task.status === 'assigned' || task.status === 'open' ? (
                  <button
                    className="btn btn-primary btn-block"
                    onClick={() => handleStartRepair(task.id)}
                  >
                    {t('incident_start_repair')}
                  </button>
                ) : null}

                {task.status === 'in_progress' ? (
                  <button
                    className="btn btn-success btn-block"
                    onClick={() => handleOpenResolveModal(task)}
                  >
                    {t('incident_resolve_repair')}
                  </button>
                ) : null}

                {task.status === 'resolved' ? (
                  <div className="tech-completed-stamp">
                    {t('incident_status_resolved')} ({new Date(task.resolved_at || task.created_at).toLocaleDateString()})
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
              ✕ {t('btn_cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Resolve Incident Report Modal */}
      {resolveModal.open && (
        <div className="modal-overlay" onClick={() => setResolveModal({ open: false, task: null, notes: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('incident_resolve_modal_title')}</h2>
              <button
                className="modal-close"
                onClick={() => setResolveModal({ open: false, task: null, notes: '' })}
              >
                &times;
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
