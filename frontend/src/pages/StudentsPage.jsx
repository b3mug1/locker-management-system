import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { getStudents, createStudent, updateStudent, deleteStudent, importStudentsCSV } from '../api/students';
import { useWebSocket } from '../hooks/useWebSocket';
import { useLanguage } from '../context/LanguageContext';
import ConfirmModal from '../components/ConfirmModal';

function StudentsPage() {
  const { t } = useLanguage();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ full_name: '', group: '', barcode: '', course: 1 });
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });
  const fileInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState(null);

  const [filterGroup, setFilterGroup] = useState('');
  const [filterCourse, setFilterCourse] = useState('');
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');

  const handleSort = (col) => {
    if (sortCol === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortCol(col); setSortDir('asc'); }
  };
  const sortIcon = (col) => {
    if (sortCol !== col) return ' \u2195';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  const fetchStudents = useCallback(async () => {
    try { const res = await getStudents(0, 500); setStudents(res.data); }
    catch { setError(t('students_failed_load')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useWebSocket({ student_change: fetchStudents });

  const groups = useMemo(() => [...new Set(students.map(s => s.group))].sort(), [students]);
  const courses = useMemo(() => [...new Set(students.map(s => s.course))].sort((a, b) => a - b), [students]);

  const filtered = useMemo(() => {
    let data = students;
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(s => s.full_name.toLowerCase().includes(q) || s.group.toLowerCase().includes(q) || s.barcode.toLowerCase().includes(q) || String(s.course).includes(q));
    }
    if (filterGroup) data = data.filter(s => s.group === filterGroup);
    if (filterCourse) data = data.filter(s => String(s.course) === filterCourse);
    if (sortCol) {
      data = [...data].sort((a, b) => {
        let va = a[sortCol], vb = b[sortCol];
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [students, search, filterGroup, filterCourse, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setCurrentPage(1); }, [search, pageSize, filterGroup, filterCourse]);

  const toggleSelect = (id) => { setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length && paginated.every(s => selectedIds.has(s.id))) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginated.map(s => s.id)));
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({ open: true, title: t('students_delete_bulk_title'),
      message: t('students_delete_bulk_msg', { count: selectedIds.size }),
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false })); setError('');
        let failed = 0;
        for (const id of selectedIds) { try { await deleteStudent(id); } catch { failed++; } }
        setSelectedIds(new Set());
        if (failed > 0) setError(t('students_failed_delete_n', { count: failed }));
        fetchStudents();
      },
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (editingId) { await updateStudent(editingId, form); }
      else { await createStudent(form); }
      setForm({ full_name: '', group: '', barcode: '', course: 1 }); setShowForm(false); setEditingId(null); fetchStudents();
    } catch (err) { setError(err.response?.data?.detail || t('students_op_failed')); }
  };

  const handleEdit = (s) => { setForm({ full_name: s.full_name, group: s.group, barcode: s.barcode, course: s.course }); setEditingId(s.id); setShowForm(true); };

  const handleDelete = (id) => {
    const s = students.find(x => x.id === id);
    setConfirmModal({ open: true, title: t('students_delete_title'),
      message: t('students_delete_msg', { name: s?.full_name || 'this student' }),
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        try { await deleteStudent(id); fetchStudents(); } catch { setError(t('students_failed_delete')); }
      },
    });
  };

  const handleCancel = () => { setForm({ full_name: '', group: '', barcode: '', course: 1 }); setEditingId(null); setShowForm(false); };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImportStatus(null); setError('');
    try { const res = await importStudentsCSV(file); setImportStatus(res.data); fetchStudents(); }
    catch (err) { setError(err.response?.data?.detail || t('students_csv_failed')); }
    e.target.value = '';
  };

  const clearFilters = () => { setSearch(''); setFilterGroup(''); setFilterCourse(''); setSortCol(''); };
  const hasFilters = search || filterGroup || filterCourse;

  if (loading) return <div className="loading">{t('students_loading')}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('students_title')}</h1>
        <div className="page-header-actions">
          {selectedIds.size > 0 && <button className="btn btn-danger bulk-delete-btn" onClick={handleBulkDelete}>&#128465; {t('students_delete_selected', { count: selectedIds.size })}</button>}
          <button className="btn btn-outline" onClick={() => fileInputRef.current?.click()}>&#128228; {t('students_import_csv')}</button>
          <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={handleCSVImport} />
          <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ full_name: '', group: '', barcode: '', course: 1 }); }}>
            {showForm ? t('btn_cancel') : t('students_add')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {importStatus && (
        <div className="alert alert-success">
          {t('students_imported', { created: importStatus.created, skipped: importStatus.skipped })}
          {importStatus.errors?.length > 0 && (<ul className="import-errors">{importStatus.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>)}
        </div>
      )}

      {showForm && (
        <div className="form-card">
          <h3>{editingId ? t('students_edit') : t('students_add_new')}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group"><label>{t('students_full_name')}</label><input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required /></div>
              <div className="form-group"><label>{t('students_group')}</label><input type="text" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="e.g. SE-2401" required /></div>
              <div className="form-group"><label>{t('students_barcode')}</label><input type="text" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="Barcode" required /></div>
              <div className="form-group"><label>{t('students_course')}</label>
                <select value={form.course} onChange={(e) => setForm({ ...form, course: parseInt(e.target.value) })} required>
                  <option value={1}>1 {t('students_course_unit')}</option>
                  <option value={2}>2 {t('students_course_unit')}</option>
                  <option value={3}>3 {t('students_course_unit')}</option>
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
        <input type="text" className="search-input" placeholder={t('students_search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="filter-select" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
          <option value="">{t('students_all_groups')}</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="filter-select" value={filterCourse} onChange={e => setFilterCourse(e.target.value)}>
          <option value="">{t('students_all_courses')}</option>
          {courses.map(c => <option key={c} value={c}>{c} {t('students_course_unit')}</option>)}
        </select>
        {hasFilters && <button className="btn btn-sm btn-outline" onClick={clearFilters}>{t('btn_clear')}</button>}
      </div>

      <div className="table-container">
        <table>
          <thead><tr>
            <th className="th-checkbox"><input type="checkbox" checked={paginated.length > 0 && paginated.every(s => selectedIds.has(s.id))} onChange={toggleSelectAll} /></th>
            <th>#</th>
            <th className="sortable" onClick={() => handleSort('full_name')}>{t('students_full_name')}{sortIcon('full_name')}</th>
            <th className="sortable" onClick={() => handleSort('barcode')}>{t('students_barcode')}{sortIcon('barcode')}</th>
            <th className="sortable" onClick={() => handleSort('group')}>{t('students_group')}{sortIcon('group')}</th>
            <th className="sortable" onClick={() => handleSort('course')}>{t('students_course')}{sortIcon('course')}</th>
            <th>{t('students_actions')}</th>
          </tr></thead>
          <tbody>
            {paginated.map((s, index) => (
              <tr key={s.id} className={selectedIds.has(s.id) ? 'row-selected' : ''}>
                <td className="td-checkbox"><input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                <td>{(currentPage - 1) * pageSize + index + 1}</td>
                <td>{s.full_name}</td>
                <td><code>{s.barcode}</code></td>
                <td><span className="badge">{s.group}</span></td>
                <td>{s.course} {t('students_course_unit')}</td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => handleEdit(s)}>{t('btn_edit')}</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>{t('btn_delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">{t('students_empty')}</p>}
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

export default StudentsPage;
