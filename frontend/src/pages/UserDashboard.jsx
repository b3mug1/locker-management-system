import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getMyDashboard } from '../api/assignments';
import { createIncident, getIncidents } from '../api/incidents';
import { useLanguage } from '../context/LanguageContext';
import { useWebSocket } from '../hooks/useWebSocket';

function UserDashboard() {
  const { t, lang } = useLanguage();
  const [data, setData] = useState(null);
  const [myIncidents, setMyIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportModal, setReportModal] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const fileInputRef = useRef(null);

  const [reportForm, setReportForm] = useState({
    type: 'needs_repair',
    title: '',
    description: '',
    image_url: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const res = await getMyDashboard();
      setData(res.data);

      if (res.data?.active_locker?.id || res.data?.active_locker?.number) {
        // Fetch incidents related to this user/locker
        const incRes = await getIncidents({ locker_id: res.data.active_locker.id }).catch(() => ({ data: [] }));
        setMyIncidents(incRes.data || []);
      }
    } catch {
      setError(t('ud_failed_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useWebSocket({
    assignment_change: fetchData,
    locker_change: fetchData,
    incident_change: fetchData,
  });

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setReportForm(prev => ({ ...prev, image_url: uploadEvent.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!data?.active_locker) return;
    setSubmittingReport(true);
    setError('');
    try {
      // Look up locker id
      const currentAssignment = data.assignments.find(a => !a.released_at);
      const lockerId = currentAssignment ? data.active_locker.id || data.active_locker.number : data.active_locker.id;

      await createIncident({
        locker_id: lockerId,
        type: reportForm.type,
        title: reportForm.title,
        description: reportForm.description,
        image_url: reportForm.image_url,
      });

      setReportModal(false);
      setReportSuccess(true);
      setReportForm({ type: 'needs_repair', title: '', description: '', image_url: '' });
      fetchData();
      setTimeout(() => setReportSuccess(false), 6000);
    } catch (err) {
      alert(err.response?.data?.detail || t('incidents_operation_failed'));
    } finally {
      setSubmittingReport(false);
    }
  };

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
    <div className="user-dashboard">
      <div className="ud-header">
        <div className="ud-greeting">
          <h1>{data.student ? t('ud_welcome_name', { name: data.student.full_name }) : t('ud_welcome')}</h1>
          <p className="ud-email">{data.email}</p>
        </div>
      </div>

      {reportSuccess && (
        <div className="alert alert-success">
          {t('incident_reported_success')}
        </div>
      )}

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
          <div className="ud-section-header-flex">
            <h2 className="ud-section-title">{t('ud_active_locker')}</h2>
            <button
              className="btn btn-sm btn-outline-warning"
              onClick={() => setReportModal(true)}
            >
              {t('incident_report_defect')}
            </button>
          </div>

          <div className="ud-locker-detail-card">
            <div className="ud-locker-header">
              <div className="ud-locker-number">#{data.active_locker.number}</div>
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

          {/* Active / Recent Repair Reports for this Student */}
          {myIncidents.length > 0 && (
            <div className="ud-incidents-block">
              <h3 className="ud-subheading">{t('ud_my_reports')}</h3>
              <div className="ud-incident-list">
                {myIncidents.map(inc => (
                  <div key={inc.id} className="ud-incident-item">
                    <div className="ud-inc-main">
                      <div className="ud-inc-title-row">
                        <strong>{inc.title}</strong>
                        <span className={`badge ${statusClass(inc.status)}`}>
                          {t(`incident_status_${inc.status}`) || inc.status}
                        </span>
                      </div>
                      {inc.description && <p className="ud-inc-desc">{inc.description}</p>}
                      {inc.technician_notes && (
                        <div className="ud-inc-tech-notes">
                          <strong>{t('incident_tech_notes')}:</strong> {inc.technician_notes}
                        </div>
                      )}
                    </div>
                    {inc.image_url && (
                      <img
                        src={inc.image_url}
                        alt="Defect"
                        className="ud-inc-photo-thumb"
                        onClick={() => setSelectedPhoto(inc.image_url)}
                        title={t('incident_photo_click_zoom')}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-locker-visual" aria-hidden="true">
            <div className="empty-locker-glow" />
            <div className="empty-locker-body">
              <div className="empty-locker-shine" />
              <div className="empty-locker-vents">
                <span />
                <span />
                <span />
              </div>
              <div className="empty-locker-handle" />
              <div className="empty-locker-nameplate" />
              <div className="empty-locker-base" />
            </div>
            <div className="empty-locker-shadow" />
          </div>
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
                  <span className="ud-history-locker">#{a.locker_number}</span>
                  <span className="ud-history-meta">{t('ud_floor')} {a.locker_floor} • {a.locker_size} • {a.locker_access_type}</span>
                </div>
                <div className="ud-history-card-right">
                  <span className="ud-history-dates">{formatDate(a.assigned_at)} → {formatDate(a.released_at)}</span>
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

      {/* Report Defect Modal */}
      {reportModal && (
        <div className="modal-overlay" onClick={() => setReportModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t('incident_report_title')}</h2>
              <button className="modal-close" onClick={() => setReportModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleReportSubmit}>
              <div className="modal-body">
                <p className="text-muted">{t('incident_report_desc')}</p>
                <div className="form-group">
                  <label>{t('incidents_type')}</label>
                  <select
                    className="form-control"
                    value={reportForm.type}
                    onChange={e => setReportForm({ ...reportForm, type: e.target.value })}
                  >
                    <option value="broken_door">{t('incident_type_broken_door')}</option>
                    <option value="lock_broken">{t('incident_type_lock_broken')}</option>
                    <option value="lost_key">{t('incident_type_lost_key')}</option>
                    <option value="needs_repair">{t('incident_type_needs_repair')}</option>
                    <option value="other">{t('incident_type_other')}</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('incidents_item_title')}</label>
                  <input
                    className="form-control"
                    required
                    placeholder="Например: Заедает электронный замок / Сломана петля"
                    value={reportForm.title}
                    onChange={e => setReportForm({ ...reportForm, title: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>{t('incidents_description')}</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Подробно опишите, что именно произошло..."
                    value={reportForm.description}
                    onChange={e => setReportForm({ ...reportForm, description: e.target.value })}
                  />
                </div>

                {/* Photo of defect */}
                <div className="form-group">
                  <label>{t('incident_attach_photo')}</label>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleImageUpload}
                  />
                  <div className="photo-upload-controls">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {reportForm.image_url ? t('btn_edit') : t('incident_attach_photo')}
                    </button>
                    {reportForm.image_url && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => setReportForm({ ...reportForm, image_url: '' })}
                      >
                        {t('incident_photo_remove')}
                      </button>
                    )}
                  </div>
                  {reportForm.image_url && (
                    <div className="image-preview-box">
                      <img src={reportForm.image_url} alt="Preview" className="img-thumbnail" />
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setReportModal(false)}
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingReport || !reportForm.title.trim()}
                >
                  {submittingReport ? '...' : t('btn_confirm')}
                </button>
              </div>
            </form>
          </div>
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
    </div>
  );
}

export default UserDashboard;
