import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { getLockers, createLocker, updateLocker, deleteLocker, importLockersCSV } from '../api/lockers';
import { useWebSocket } from '../hooks/useWebSocket';
import { useLanguage } from '../context/LanguageContext';
import ConfirmModal from '../components/ConfirmModal';

function LockersPage() {
  const { t } = useLanguage();
  const [lockers, setLockers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [form, setForm] = useState({ number: '', size: 'medium', access_type: 'key', capacity: 2, floor: 1, status: 'active' });
  const [error, setError] = useState('');
  const formRef = useRef(null);
  const fileInputRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [importStatus, setImportStatus] = useState(null);

  const [filterFloor, setFilterFloor] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('');
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (col) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc'); } };
  const sortIcon = (col) => { if (sortCol !== col) return ' \u2195'; return sortDir === 'asc' ? ' \u2191' : ' \u2193'; };

  const filtered = useMemo(() => {
    let data = lockers;
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); data = data.filter(l => l.number.toLowerCase().includes(q)); }
    if (filterFloor) data = data.filter(l => String(l.floor) === filterFloor);
    if (filterSize) data = data.filter(l => l.size === filterSize);
    if (filterStatus) data = data.filter(l => l.status === filterStatus);
    if (filterAvailability === 'available') data = data.filter(l => (l.occupied_count || 0) < l.capacity);
    if (filterAvailability === 'full') data = data.filter(l => (l.occupied_count || 0) >= l.capacity);
    if (sortCol) {
      data = [...data].sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (sortCol === 'availability') { va = (a.occupied_count || 0) >= a.capacity ? 1 : 0; vb = (b.occupied_count || 0) >= b.capacity ? 1 : 0; }
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [lockers, searchQuery, filterFloor, filterSize, filterStatus, filterAvailability, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const floors = useMemo(() => [...new Set(lockers.map(l => l.floor))].sort((a, b) => a - b), [lockers]);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, pageSize, filterFloor, filterSize, filterStatus, filterAvailability]);

  const LOCKER_RULES = { large: { pin: 1 }, medium: { pin: 2, key: 2 }, small: { key: 1 } };
  const handleSizeChange = (sz) => { const a = LOCKER_RULES[sz]; const at = Object.keys(a)[0]; setForm({ ...form, size: sz, access_type: at, capacity: a[at] }); };
  const handleAccessChange = (at) => { setForm({ ...form, access_type: at, capacity: LOCKER_RULES[form.size][at] }); };

  const fetchLockers = useCallback(async () => {
    try { const res = await getLockers(0, 500); setLockers(res.data); }
    catch { setError(t('lockers_failed_load')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchLockers(); }, [fetchLockers]);
  useWebSocket({ locker_change: fetchLockers });

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      const payload = { ...form, capacity: Number(form.capacity), floor: Number(form.floor) };
      if (editingId) await updateLocker(editingId, payload); else await createLocker(payload);
      setForm({ number: '', size: 'medium', access_type: 'key', capacity: 2, floor: 1, status: 'active' }); setShowForm(false); setEditingId(null); fetchLockers();
    } catch (err) { setError(err.response?.data?.detail || t('lockers_op_failed')); }
  };

  const handleEdit = (l) => {
    setForm({ number: l.number, size: l.size, access_type: l.access_type, capacity: l.capacity, floor: l.floor, status: l.status || 'active' });
    setEditingId(l.id); setShowForm(true);
    setTimeout(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };

  const handleDelete = (id) => {
    const l = lockers.find(x => x.id === id);
    setConfirmModal({ open: true, title: t('lockers_delete_title'),
      message: t('lockers_delete_msg', { number: l?.number || '#' + id }),
      onConfirm: async () => { setConfirmModal(m => ({ ...m, open: false })); try { await deleteLocker(id); fetchLockers(); } catch { setError(t('lockers_failed_delete')); } },
    });
  };

  const handleCancel = () => { setForm({ number: '', size: 'medium', access_type: 'key', capacity: 2, floor: 1, status: 'active' }); setEditingId(null); setShowForm(false); };

  const toggleSelect = (id) => { setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length && paginated.every(l => selectedIds.has(l.id))) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginated.map(l => l.id)));
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({ open: true, title: t('lockers_delete_bulk_title'),
      message: t('lockers_delete_bulk_msg', { count: selectedIds.size }),
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false })); setError('');
        let failed = 0;
        for (const id of selectedIds) { try { await deleteLocker(id); } catch { failed++; } }
        setSelectedIds(new Set());
        if (failed > 0) setError(t('lockers_failed_delete_n', { count: failed }));
        fetchLockers();
      },
    });
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImportStatus(null); setError('');
    try { const res = await importLockersCSV(file); setImportStatus(res.data); fetchLockers(); }
    catch (err) { setError(err.response?.data?.detail || t('lockers_csv_failed')); }
    e.target.value = '';
  };

  const clearFilters = () => { setSearchQuery(''); setFilterFloor(''); setFilterSize(''); setFilterStatus(''); setFilterAvailability(''); setSortCol(''); };
  const hasFilters = searchQuery || filterFloor || filterSize || filterStatus || filterAvailability;

  if (loading) return <div className="loading">{t('lockers_loading')}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('lockers_title')}</h1>
        <div className="page-header-actions">
          {selectedIds.size > 0 && <button className="btn btn-danger bulk-delete-btn" onClick={handleBulkDelete}>&#128465; {t('lockers_delete_selected', { count: selectedIds.size })}</button>}
          <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>&#128228; {t('lockers_import_csv')}</button>
          <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleCSVImport} />
          <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ number: '', size: 'medium', access_type: 'key', capacity: 2, floor: 1, status: 'active' }); }}>
            {showForm ? t('btn_cancel') : t('lockers_add')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {importStatus && (
        <div className="alert alert-success">
          {t('lockers_imported', { created: importStatus.created, skipped: importStatus.skipped })}
          {importStatus.errors?.length > 0 && (<ul className="import-errors">{importStatus.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>)}
        </div>
      )}

      {showForm && (
        <div className="form-card" ref={formRef}>
          <h3>{editingId ? t('lockers_edit') : t('lockers_add_new')}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group"><label>{t('lockers_number')}</label><input type="text" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="e.g. L-101" required /></div>
              <div className="form-group"><label>{t('lockers_size')}</label>
                <select value={form.size} onChange={(e) => handleSizeChange(e.target.value)}>
                  <option value="small">{t('lockers_small')}</option><option value="medium">{t('lockers_medium')}</option><option value="large">{t('lockers_large')}</option>
                </select>
              </div>
              <div className="form-group"><label>{t('lockers_access')}</label>
                <select value={form.access_type} onChange={(e) => handleAccessChange(e.target.value)}>
                  {Object.keys(LOCKER_RULES[form.size] || {}).map(at => <option key={at} value={at}>{at.charAt(0).toUpperCase() + at.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>{t('lockers_capacity_auto')}</label><input type="number" value={form.capacity} readOnly disabled /></div>
              <div className="form-group"><label>{t('lockers_floor')}</label><input type="number" min="1" max="10" value={form.floor} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })} required /></div>
              <div className="form-group"><label>{t('lockers_status')}</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">{t('lockers_active')}</option><option value="inactive">{t('lockers_inactive')}</option><option value="maintenance">{t('lockers_maintenance')}</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" type="submit">{editingId ? t('btn_update') : t('btn_create')}</button>
              <button className="btn btn-outline" type="button" onClick={handleCancel}>{t('btn_cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <div className="filter-bar">
        <input type="text" placeholder={t('lockers_search')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
        <select className="filter-select" value={filterFloor} onChange={e => setFilterFloor(e.target.value)}>
          <option value="">{t('lockers_all_floors')}</option>
          {floors.map(f => <option key={f} value={f}>{t('lockers_floor')} {f}</option>)}
        </select>
        <select className="filter-select" value={filterSize} onChange={e => setFilterSize(e.target.value)}>
          <option value="">{t('lockers_all_sizes')}</option>
          <option value="small">{t('lockers_small')}</option><option value="medium">{t('lockers_medium')}</option><option value="large">{t('lockers_large')}</option>
        </select>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">{t('lockers_all_status')}</option>
          <option value="active">{t('lockers_active')}</option><option value="inactive">{t('lockers_inactive')}</option><option value="maintenance">{t('lockers_maintenance')}</option>
        </select>
        <select className="filter-select" value={filterAvailability} onChange={e => setFilterAvailability(e.target.value)}>
          <option value="">{t('lockers_all_avail')}</option>
          <option value="available">{t('lockers_available')}</option><option value="full">{t('lockers_full')}</option>
        </select>
        {hasFilters && <button className="btn btn-sm btn-outline" onClick={clearFilters}>{t('btn_clear')}</button>}
      </div>

      <div className="table-container">
        <table>
          <thead><tr>
            <th className="th-checkbox"><input type="checkbox" checked={paginated.length > 0 && paginated.every(l => selectedIds.has(l.id))} onChange={toggleSelectAll} /></th>
            <th>#</th>
            <th className="sortable" onClick={() => handleSort('number')}>{t('lockers_number')}{sortIcon('number')}</th>
            <th className="sortable" onClick={() => handleSort('size')}>{t('lockers_size')}{sortIcon('size')}</th>
            <th className="sortable" onClick={() => handleSort('access_type')}>{t('lockers_access')}{sortIcon('access_type')}</th>
            <th className="sortable" onClick={() => handleSort('capacity')}>{t('lockers_capacity')}{sortIcon('capacity')}</th>
            <th className="sortable" onClick={() => handleSort('occupied_count')}>{t('lockers_occupied')}{sortIcon('occupied_count')}</th>
            <th className="sortable" onClick={() => handleSort('floor')}>{t('lockers_floor')}{sortIcon('floor')}</th>
            <th className="sortable" onClick={() => handleSort('status')}>{t('lockers_status')}{sortIcon('status')}</th>
            <th className="sortable" onClick={() => handleSort('availability')}>{t('lockers_availability')}{sortIcon('availability')}</th>
            <th>{t('lockers_actions')}</th>
          </tr></thead>
          <tbody>
            {paginated.map((l, index) => (
              <tr key={l.id} className={selectedIds.has(l.id) ? 'row-selected' : ''}>
                <td className="td-checkbox"><input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleSelect(l.id)} /></td>
                <td>{(currentPage - 1) * pageSize + index + 1}</td>
                <td><strong>{l.number}</strong></td>
                <td>{l.size}</td>
                <td>{l.access_type}</td>
                <td>{l.capacity}</td>
                <td>{l.occupied_count || 0}</td>
                <td>{l.floor}</td>
                <td><span className={`status-badge ${l.status === 'active' ? 'status-active' : l.status === 'maintenance' ? 'status-maintenance' : 'status-inactive'}`}>{l.status === 'active' ? t('lockers_active') : l.status === 'maintenance' ? t('lockers_maintenance') : t('lockers_inactive')}</span></td>
                <td><span className={`status-badge ${(l.occupied_count || 0) >= l.capacity ? 'status-full' : 'status-available'}`}>{(l.occupied_count || 0) >= l.capacity ? t('lockers_full') : t('lockers_available')}</span></td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => handleEdit(l)}>{t('btn_edit')}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(l.id)}>{t('btn_delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">{t('lockers_empty')}</p>}
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

      <ConfirmModal open={confirmModal.open} title={confirmModal.title} message={confirmModal.message} confirmText={t('btn_delete')} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(m => ({ ...m, open: false }))} />
    </div>
  );
}

export default LockersPage;
