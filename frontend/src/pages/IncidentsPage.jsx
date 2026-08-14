import React, { useEffect, useMemo, useState } from 'react';
import { createIncident, deleteIncident, getIncidents, updateIncident } from '../api/incidents';
import { getLockers } from '../api/lockers';
import { useLanguage } from '../context/LanguageContext';
import ConfirmModal from '../components/ConfirmModal';

function IncidentsPage() {
  const { t, lang } = useLanguage();
  const [incidents, setIncidents] = useState([]);
  const [lockers, setLockers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [error, setError] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [form, setForm] = useState({ locker_id: '', type: 'needs_repair', title: '', description: '', status: 'open' });

  const incidentTypes = useMemo(() => [
    { value: 'broken_door', label: t('incident_type_broken_door') },
    { value: 'lost_key', label: t('incident_type_lost_key') },
    { value: 'lock_broken', label: t('incident_type_lock_broken') },
    { value: 'needs_repair', label: t('incident_type_needs_repair') },
    { value: 'other', label: t('incident_type_other') },
  ], [t]);

  const statuses = useMemo(() => [
    { value: 'open', label: t('incident_status_open') },
    { value: 'in_progress', label: t('incident_status_in_progress') },
    { value: 'resolved', label: t('incident_status_resolved') },
    { value: 'cancelled', label: t('incident_status_cancelled') },
  ], [t]);

  const load = async () => {
    try {
      const [iRes, lRes] = await Promise.all([getIncidents(), getLockers(0, 500)]);
      setIncidents(iRes.data);
      setLockers(lRes.data);
    } catch {
      setError(t('incidents_failed_load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => filterStatus ? incidents.filter(i => i.status === filterStatus) : incidents, [incidents, filterStatus]);

  const resetForm = () => {
    setForm({ locker_id: '', type: 'needs_repair', title: '', description: '', status: 'open' });
    setEditingId(null);
    setShowForm(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await updateIncident(editingId, { ...form, locker_id: undefined });
      } else {
        await createIncident({ ...form, locker_id: Number(form.locker_id) });
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
    });
    setShowForm(true);
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

  if (loading) return <div className="loading">{t('incidents_loading')}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('incidents_title')}</h1>
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
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('incidents_locker')}</th>
              <th>{t('incidents_type')}</th>
              <th>{t('incidents_item_title')}</th>
              <th>{t('incidents_status')}</th>
              <th>{t('incidents_created')}</th>
              <th>{t('incidents_resolved')}</th>
              <th>{t('incidents_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id}>
                <td><strong>{i.locker_number || `#${i.locker_id}`}</strong></td>
                <td>{incidentTypes.find(item => item.value === i.type)?.label || i.type}</td>
                <td>{i.title}</td>
                <td>
                  <span className={`status-badge ${i.status === 'resolved' ? 'status-active' : i.status === 'cancelled' ? 'status-inactive' : 'status-maintenance'}`}>
                    {statuses.find(s => s.value === i.status)?.label || i.status}
                  </span>
                </td>
                <td>{formatDate(i.created_at)}</td>
                <td>{formatDate(i.resolved_at)}</td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => edit(i)}>{t('btn_edit')}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(i)}>{t('btn_delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">{t('incidents_empty')}</p>}
      </div>

      <ConfirmModal open={confirmModal.open} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(m => ({ ...m, open: false }))} />
    </div>
  );
}

export default IncidentsPage;
