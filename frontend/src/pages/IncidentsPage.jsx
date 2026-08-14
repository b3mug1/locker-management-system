import React, { useEffect, useMemo, useState } from 'react';
import { createIncident, deleteIncident, getIncidents, updateIncident } from '../api/incidents';
import { getLockers } from '../api/lockers';
import ConfirmModal from '../components/ConfirmModal';

const incidentTypes = [
  ['broken_door', 'Broken door'],
  ['lost_key', 'Lost key'],
  ['lock_broken', 'Broken lock'],
  ['needs_repair', 'Needs repair'],
  ['other', 'Other'],
];

const statuses = ['open', 'in_progress', 'resolved', 'cancelled'];

function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [lockers, setLockers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [error, setError] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [form, setForm] = useState({ locker_id: '', type: 'needs_repair', title: '', description: '', status: 'open' });

  const load = async () => {
    try {
      const [iRes, lRes] = await Promise.all([getIncidents(), getLockers(0, 500)]);
      setIncidents(iRes.data);
      setLockers(lRes.data);
    } catch {
      setError('Failed to load incidents');
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
      setError(err.response?.data?.detail || 'Operation failed');
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
      title: 'Delete incident',
      message: `Delete incident "${incident.title}"?`,
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        await deleteIncident(incident.id);
        load();
      },
    });
  };

  if (loading) return <div className="loading">Loading incidents...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Incidents & Maintenance</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Incident'}</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <div className="form-card">
          <h3>{editingId ? 'Edit Incident' : 'New Incident'}</h3>
          <form onSubmit={submit}>
            <div className="form-row">
              <div className="form-group">
                <label>Locker</label>
                <select value={form.locker_id} onChange={e => setForm({ ...form, locker_id: e.target.value })} disabled={!!editingId} required>
                  <option value="">Select locker...</option>
                  {lockers.map(l => <option key={l.id} value={l.id}>{l.number} (Floor {l.floor})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {incidentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              {editingId && (
                <div className="form-group">
                  <label>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-group"><label>Title</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
              <div className="form-group"><label>Description</label><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit">{editingId ? 'Update' : 'Create'}</button>
              <button className="btn btn-outline" type="button" onClick={resetForm}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="filter-bar">
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="table-container">
        <table>
          <thead><tr><th>Locker</th><th>Type</th><th>Title</th><th>Status</th><th>Created</th><th>Resolved</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id}>
                <td><strong>{i.locker_number || `#${i.locker_id}`}</strong></td>
                <td>{incidentTypes.find(([v]) => v === i.type)?.[1] || i.type}</td>
                <td>{i.title}</td>
                <td><span className={`status-badge ${i.status === 'resolved' ? 'status-active' : i.status === 'cancelled' ? 'status-inactive' : 'status-maintenance'}`}>{i.status}</span></td>
                <td>{new Date(i.created_at).toLocaleString()}</td>
                <td>{i.resolved_at ? new Date(i.resolved_at).toLocaleString() : '—'}</td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => edit(i)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(i)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">No incidents found.</p>}
      </div>

      <ConfirmModal open={confirmModal.open} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(m => ({ ...m, open: false }))} />
    </div>
  );
}

export default IncidentsPage;
