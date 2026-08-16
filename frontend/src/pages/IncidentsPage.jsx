import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createIncident, deleteIncident, getIncidents, updateIncident, getTechnicians, assignTechnician } from '../api/incidents';
import { getLockers } from '../api/lockers';
import { useLanguage } from '../context/LanguageContext';
import { useWebSocket } from '../hooks/useWebSocket';
import ConfirmModal from '../components/ConfirmModal';

function IncidentsPage() {
  const { t, lang } = useLanguage();
  const [incidents, setIncidents] = useState([]);
  const [lockers, setLockers] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTech, setFilterTech] = useState('');
  const [error, setError] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [assignModal, setAssignModal] = useState({ open: false, incident: null, technicianId: '' });
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    locker_id: '',
    type: 'needs_repair',
    title: '',
    description: '',
    status: 'open',
    image_url: '',
    assigned_technician_id: '',
    technician_notes: '',
  });

  const incidentTypes = useMemo(() => [
    { value: 'broken_door', label: t('incident_type_broken_door') },
    { value: 'lost_key', label: t('incident_type_lost_key') },
    { value: 'lock_broken', label: t('incident_type_lock_broken') },
    { value: 'needs_repair', label: t('incident_type_needs_repair') },
    { value: 'other', label: t('incident_type_other') },
  ], [t]);

  const statuses = useMemo(() => [
    { value: 'open', label: t('incident_status_open') },
    { value: 'assigned', label: t('incident_status_assigned') },
    { value: 'in_progress', label: t('incident_status_in_progress') },
    { value: 'resolved', label: t('incident_status_resolved') },
    { value: 'cancelled', label: t('incident_status_cancelled') },
  ], [t]);

  const load = useCallback(async () => {
    try {
      const [iRes, lRes, tRes] = await Promise.all([
        getIncidents(),
        getLockers(0, 10000),
        getTechnicians().catch(() => ({ data: [] })),
      ]);
      setIncidents(iRes.data);
      setLockers(lRes.data);
      setTechnicians(tRes.data || []);
    } catch {
      setError(t('incidents_failed_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);
  useWebSocket({ incident_change: load, locker_change: load });

  const filtered = useMemo(() => {
    let list = incidents;
    if (filterStatus) list = list.filter(i => i.status === filterStatus);
    if (filterTech) list = list.filter(i => String(i.assigned_technician_id) === filterTech);
    return list;
  }, [incidents, filterStatus, filterTech]);

  const resetForm = () => {
    setForm({
      locker_id: '',
      type: 'needs_repair',
      title: '',
      description: '',
      status: 'open',
      image_url: '',
      assigned_technician_id: '',
      technician_notes: '',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setForm(prev => ({ ...prev, image_url: uploadEvent.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await updateIncident(editingId, {
          type: form.type,
          title: form.title,
          description: form.description,
          status: form.status,
          image_url: form.image_url,
          assigned_technician_id: form.assigned_technician_id ? Number(form.assigned_technician_id) : null,
          technician_notes: form.technician_notes,
        });
      } else {
        await createIncident({
          locker_id: Number(form.locker_id),
          type: form.type,
          title: form.title,
          description: form.description,
          image_url: form.image_url,
        });
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.detail || t('incidents_operation_failed'));
    }
  };

  const edit = (incident) => {
    setEditingId(incident.id);
    setForm({
      locker_id: incident.locker_id,
      type: incident.type,
      title: incident.title,
      description: incident.description || '',
      status: incident.status,
      image_url: incident.image_url || '',
      assigned_technician_id: incident.assigned_technician_id || '',
      technician_notes: incident.technician_notes || '',
    });
    setShowForm(true);
  };

  const openAssign = (incident) => {
    setAssignModal({
      open: true,
      incident,
      technicianId: incident.assigned_technician_id ? String(incident.assigned_technician_id) : (technicians[0]?.id ? String(technicians[0].id) : ''),
    });
  };

  const handleConfirmAssign = async (e) => {
    e.preventDefault();
    if (!assignModal.incident || !assignModal.technicianId) return;
    try {
      await assignTechnician(assignModal.incident.id, Number(assignModal.technicianId));
      setAssignModal({ open: false, incident: null, technicianId: '' });
      load();
    } catch (err) {
      alert(err.response?.data?.detail || t('incidents_operation_failed'));
    }
  };

  const remove = (incident) => {
    setConfirmModal({
      open: true,
      title: t('incidents_delete_title'),
      message: t('incidents_delete_msg', { title: incident.title }),
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        await deleteIncident(incident.id);
        load();
      },
    });
  };

  const formatDate = (d) => {
    if (!d) return '\u2014';
    const date = new Date(d);
    const locale = lang === 'ru' ? 'ru-RU' : 'en-GB';
    return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
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

  if (loading) return <div className="loading">{t('incidents_loading')}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>🛠️ {t('incidents_title')}</h1>
          <p className="page-subtitle">{t('tech_dashboard_subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? t('btn_cancel') : t('incidents_add')}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <div className="form-card">
          <h3>{editingId ? t('incidents_edit') : t('incidents_new')}</h3>
          <form onSubmit={submit}>
            <div className="form-row">
              <div className="form-group">
                <label>{t('incidents_locker')}</label>
                <select value={form.locker_id} onChange={e => setForm({ ...form, locker_id: e.target.value })} disabled={!!editingId} required>
                  <option value="">{t('incidents_select_locker')}</option>
                  {lockers.map(l => <option key={l.id} value={l.id}>{l.number} ({t('lockers_floor')} {l.floor})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>{t('incidents_type')}</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {incidentTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              {editingId && (
                <div className="form-group">
                  <label>{t('incidents_status')}</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('incidents_item_title')}</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>{t('incidents_description')}</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>

            {editingId && (
              <div className="form-row">
                <div className="form-group">
                  <label>{t('incident_assigned_to')}</label>
                  <select
                    value={form.assigned_technician_id}
                    onChange={e => setForm({ ...form, assigned_technician_id: e.target.value })}
                  >
                    <option value="">-- {t('incident_select_tech')} --</option>
                    {technicians.map(tech => (
                      <option key={tech.id} value={tech.id}>{tech.email}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('incident_tech_notes')}</label>
                  <input
                    value={form.technician_notes}
                    onChange={e => setForm({ ...form, technician_notes: e.target.value })}
                    placeholder={t('incident_notes_placeholder')}
                  />
                </div>
              </div>
            )}

            {/* Defect Photo Attachment */}
            <div className="form-group">
              <label>📸 {t('incident_attach_photo')}</label>
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
                  📁 {form.image_url ? t('btn_edit') : t('incident_attach_photo')}
                </button>
                {form.image_url && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => setForm({ ...form, image_url: '' })}
                  >
                    🗑 {t('incident_photo_remove')}
                  </button>
                )}
              </div>
              {form.image_url && (
                <div className="image-preview-box">
                  <img src={form.image_url} alt="Preview" className="img-thumbnail" />
                </div>
              )}
            </div>

            <div className="form-actions">
              <button className="btn btn-primary" type="submit">{editingId ? t('btn_update') : t('btn_create')}</button>
              <button className="btn btn-outline" type="button" onClick={resetForm}>{t('btn_cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <div className="filter-bar">
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">{t('incidents_all_statuses')}</option>
          {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {technicians.length > 0 && (
          <select className="filter-select" value={filterTech} onChange={e => setFilterTech(e.target.value)}>
            <option value="">-- {t('incident_assigned_to')} (Все) --</option>
            {technicians.map(tech => (
              <option key={tech.id} value={tech.id}>{tech.email}</option>
            ))}
          </select>
        )}
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('incidents_locker')}</th>
              <th>📸 Фото</th>
              <th>{t('incidents_type')}</th>
              <th>{t('incidents_item_title')}</th>
              <th>{t('incidents_status')}</th>
              <th>{t('incident_assigned_to')}</th>
              <th>{t('incidents_created')}</th>
              <th>{t('incidents_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id}>
                <td>
                  <strong>#{i.locker_number || i.locker_id}</strong>
                  {i.locker_floor && <span className="text-muted" style={{ display: 'block', fontSize: '0.8rem' }}>Этаж {i.locker_floor}</span>}
                </td>
                <td>
                  {i.image_url ? (
                    <img
                      src={i.image_url}
                      alt="Defect"
                      className="table-photo-thumb"
                      onClick={() => setSelectedPhoto(i.image_url)}
                      title={t('incident_photo_click_zoom')}
                    />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>{incidentTypes.find(item => item.value === i.type)?.label || i.type}</td>
                <td>
                  <div><strong>{i.title}</strong></div>
                  {i.description && <div className="text-muted" style={{ fontSize: '0.85rem' }}>{i.description}</div>}
                  {i.technician_notes && (
                    <div className="tech-report-snippet">
                      🔧 <em>{i.technician_notes}</em>
                    </div>
                  )}
                </td>
                <td>
                  <span className={`badge ${statusClass(i.status)}`}>
                    {statuses.find(s => s.value === i.status)?.label || i.status}
                  </span>
                </td>
                <td>
                  {i.assigned_technician_email ? (
                    <span className="tech-badge">🛠️ {i.assigned_technician_email.split('@')[0]}</span>
                  ) : (
                    <button
                      className="btn btn-xs btn-outline"
                      onClick={() => openAssign(i)}
                    >
                      + {t('incident_assign_btn')}
                    </button>
                  )}
                </td>
                <td>{formatDate(i.created_at)}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-sm btn-outline" onClick={() => openAssign(i)} title={t('incident_assign_btn')}>
                      👨‍🔧
                    </button>
                    <button className="btn btn-sm btn-outline" onClick={() => edit(i)}>
                      {t('btn_edit')}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(i)}>
                      {t('btn_delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">{t('incidents_empty')}</p>}
      </div>

      {/* Assign Technician Modal */}
      {assignModal.open && (
        <div className="modal-overlay" onClick={() => setAssignModal({ open: false, incident: null, technicianId: '' })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👨‍🔧 {t('incident_assign_modal_title')}</h2>
              <button className="modal-close" onClick={() => setAssignModal({ open: false, incident: null, technicianId: '' })}>&times;</button>
            </div>
            <form onSubmit={handleConfirmAssign}>
              <div className="modal-body">
                <p>
                  <strong>{t('incidents_locker')}:</strong> #{assignModal.incident?.locker_number} ({assignModal.incident?.title})
                </p>
                {technicians.length === 0 ? (
                  <div className="alert alert-warning">{t('incident_no_techs')}</div>
                ) : (
                  <div className="form-group">
                    <label>{t('incident_assigned_to')}</label>
                    <select
                      className="form-control"
                      value={assignModal.technicianId}
                      onChange={e => setAssignModal({ ...assignModal, technicianId: e.target.value })}
                      required
                    >
                      <option value="">-- {t('incident_select_tech')} --</option>
                      {technicians.map(tech => (
                        <option key={tech.id} value={tech.id}>{tech.email}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setAssignModal({ open: false, incident: null, technicianId: '' })}
                >
                  {t('btn_cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!assignModal.technicianId}
                >
                  {t('btn_confirm')}
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

      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(m => ({ ...m, open: false }))}
      />
    </div>
  );
}

export default IncidentsPage;
