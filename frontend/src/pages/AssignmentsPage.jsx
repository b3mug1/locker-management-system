import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { getAssignments, assignLocker, releaseAssignment, importCombinedCSV } from '../api/assignments';
import { getStudents } from '../api/students';
import { getLockers } from '../api/lockers';
import { useWebSocket } from '../hooks/useWebSocket';
import { useLanguage } from '../context/LanguageContext';
import ConfirmModal from '../components/ConfirmModal';

function AssignmentsPage() {
  const { t } = useLanguage();
  const [assignments, setAssignments] = useState([]);
  const [students, setStudents] = useState([]);
  const [lockers, setLockers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ student_id: '', locker_id: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', variant: 'warning', confirmText: t('btn_confirm'), onConfirm: null });
  const csvInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState(null);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleSort = (col) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc'); } };
  const sortIcon = (col) => { if (sortCol !== col) return ' \u2195'; return sortDir === 'asc' ? ' \u2191' : ' \u2193'; };

  const fetchAll = useCallback(async () => {
    try {
      const [aRes, sRes, lRes] = await Promise.all([getAssignments(0, 500), getStudents(0, 500), getLockers(0, 500)]);
      setAssignments(aRes.data); setStudents(sRes.data); setLockers(lRes.data);
    } catch { setError(t('assign_failed_load')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useWebSocket({ assignment_change: fetchAll, locker_change: fetchAll, student_change: fetchAll });

  const filtered = useMemo(() => {
    let data = assignments;
    if (search.trim()) { const q = search.toLowerCase(); data = data.filter(a => (a.student_name || '').toLowerCase().includes(q) || (a.locker_number || '').toLowerCase().includes(q)); }
    if (filterStatus === 'active') data = data.filter(a => !a.released_at);
    if (filterStatus === 'released') data = data.filter(a => a.released_at);
    if (sortCol) {
      data = [...data].sort((a, b) => {
        let va, vb;
        if (sortCol === 'status') { va = a.released_at ? 1 : 0; vb = b.released_at ? 1 : 0; } else { va = a[sortCol]; vb = b[sortCol]; }
        if (va == null) va = ''; if (vb == null) vb = '';
        if (typeof va === 'string') va = va.toLowerCase(); if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return sortDir === 'asc' ? -1 : 1; if (va > vb) return sortDir === 'asc' ? 1 : -1; return 0;
      });
    }
    return data;
  }, [assignments, search, filterStatus, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setCurrentPage(1); }, [search, pageSize, filterStatus]);

  const handleAssign = async (e, force = false) => {
    if (e) e.preventDefault();
    setError(''); setSuccess('');
    try {
      await assignLocker({ student_id: Number(form.student_id), locker_id: Number(form.locker_id), force });
      setSuccess(t('assign_success')); setForm({ student_id: '', locker_id: '' }); setShowForm(false); fetchAll();
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      if (err.response?.status === 409 && typeof detail === 'string' && detail.startsWith('priority_students_waiting:')) {
        const count = detail.split(':')[1];
        setConfirmModal({
          open: true,
          title: t('assign_priority_override_title'),
          message: t('assign_priority_warning').replace('{count}', count),
          variant: 'warning',
          confirmText: t('assign_assign_anyway'),
          onConfirm: () => { setConfirmModal(m => ({ ...m, open: false })); handleAssign(null, true); },
        });
      } else {
        setError(detail || t('assign_failed'));
      }
    }
  };

  const handleRelease = async (id) => {
    const a = assignments.find(x => x.id === id);
    setConfirmModal({
      open: true, title: t('assign_release_title'),
      message: t('assign_release_msg', { locker: a?.locker_number || '#' + id, student: a?.student_name || t('assign_student_lc') }),
      variant: 'warning', confirmText: t('assign_release'),
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false })); setError('');
        try { await releaseAssignment(id); setSuccess(t('assign_released')); fetchAll(); }
        catch (err) { setError(err.response?.data?.detail || t('assign_release_failed')); }
      },
    });
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString() : '\u2014';
  const clearFilters = () => { setSearch(''); setFilterStatus(''); setSortCol(''); };
  const hasFilters = search || filterStatus;

  const handleCSVImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImportStatus(null); setError(''); setSuccess('');
    try { const res = await importCombinedCSV(file); setImportStatus(res.data); fetchAll(); }
    catch (err) { setError(err.response?.data?.detail || t('csv_combined_failed')); }
    e.target.value = '';
  };

  if (loading) return <div className="loading">{t('assign_loading')}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('assign_title')}</h1>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => csvInputRef.current?.click()}>{t('csv_combined_import')}</button>
          <input type="file" accept=".csv" ref={csvInputRef} style={{ display: 'none' }} onChange={handleCSVImport} />
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t('btn_cancel') : t('assign_add')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      {importStatus && (
        <div className="alert alert-success">
          {t('csv_combined_result', { students: importStatus.created_students, lockers: importStatus.created_lockers, assignments: importStatus.created_assignments, skipped: importStatus.skipped })}
          {importStatus.errors?.length > 0 && (<ul className="import-errors">{importStatus.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>)}
        </div>
      )}

      {showForm && (
        <div className="form-card">
          <h3>{t('assign_form_title')}</h3>
          <form onSubmit={handleAssign}>
            <div className="form-row">
              <div className="form-group">
                <label>{t('assign_student')}</label>
                <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required>
                  <option value="">{t('assign_select_student')}</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.inclusive_status && s.inclusive_status !== 'none' ? '⭐ ' : ''}{s.full_name} ({s.group})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>{t('assign_locker')}</label>
                <select value={form.locker_id} onChange={(e) => setForm({ ...form, locker_id: e.target.value })} required>
                  <option value="">{t('assign_select_locker')}</option>
                  {lockers
                    .filter((l) => l.status === 'active' && (l.occupied_count || 0) < l.capacity)
                    .map((l) => (<option key={l.id} value={l.id}>{l.number} ({t('lockers_floor')} {l.floor}, {l.size}, {l.occupied_count || 0}/{l.capacity})</option>))}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit">{t('assign_btn')}</button>
              <button className="btn btn-outline" type="button" onClick={() => setShowForm(false)}>{t('btn_cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <div className="filter-bar">
        <input type="text" className="search-input" placeholder={t('assign_search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">{t('assign_all_status')}</option>
          <option value="active">{t('assign_active')}</option>
          <option value="released">{t('assign_released_label')}</option>
        </select>
        {hasFilters && <button className="btn btn-sm btn-outline" onClick={clearFilters}>{t('btn_clear')}</button>}
      </div>

      <div className="table-container">
        <table>
          <thead><tr>
            <th>#</th>
            <th className="sortable" onClick={() => handleSort('student_name')}>{t('assign_student')}{sortIcon('student_name')}</th>
            <th className="sortable" onClick={() => handleSort('locker_number')}>{t('assign_locker')}{sortIcon('locker_number')}</th>
            <th className="sortable" onClick={() => handleSort('assigned_at')}>{t('assign_assigned_at')}{sortIcon('assigned_at')}</th>
            <th className="sortable" onClick={() => handleSort('released_at')}>{t('assign_released_at')}{sortIcon('released_at')}</th>
            <th className="sortable" onClick={() => handleSort('status')}>{t('assign_status')}{sortIcon('status')}</th>
            <th>{t('assign_actions')}</th>
          </tr></thead>
          <tbody>
            {paginated.map((a, index) => (
              <tr key={a.id} className={a.released_at ? 'row-released' : ''}>
                <td>{(currentPage - 1) * pageSize + index + 1}</td>
                <td>
                  {(() => { const st = students.find(s => s.id === a.student_id); return st?.inclusive_status && st.inclusive_status !== 'none' ? <span>⭐ {a.student_name || `#${a.student_id}`}</span> : (a.student_name || `#${a.student_id}`); })()}
                </td>
                <td><strong>{a.locker_number || `#${a.locker_id}`}</strong></td>
                <td>{formatDate(a.assigned_at)}</td>
                <td>{formatDate(a.released_at)}</td>
                <td><span className={`status-badge ${a.released_at ? 'status-released' : 'status-active'}`}>{a.released_at ? t('assign_released_label') : t('assign_active')}</span></td>
                <td>{!a.released_at && <button className="btn btn-sm btn-warning" onClick={() => handleRelease(a.id)}>{t('assign_release')}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">{t('assign_empty')}</p>}
      </div>

      <div className="pagination-wrapper">
        <div className="pagination">
          <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>&lsaquo;</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
            .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...'); acc.push(p); return acc; }, [])
            .map((p, i) =>
              p === '...' ? <span key={`dot-${i}`} className="pagination-dots">...</span> :
              <button key={p} className={`pagination-btn ${currentPage === p ? 'active' : ''}`} onClick={() => setCurrentPage(p)}>{p}</button>
            )}
          <button className="pagination-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>&rsaquo;</button>
        </div>
        <div className="pagination-info">
          <span>{t('results')}: {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filtered.length)} {t('of')} {filtered.length}</span>
          <select className="page-size-select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
          </select>
        </div>
      </div>

      <ConfirmModal open={confirmModal.open} title={confirmModal.title} message={confirmModal.message} variant={confirmModal.variant} confirmText={confirmModal.confirmText} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(m => ({ ...m, open: false }))} />
    </div>
  );
}

export default AssignmentsPage;
