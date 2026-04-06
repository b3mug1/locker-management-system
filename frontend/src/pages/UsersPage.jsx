import React, { useState, useEffect, useMemo } from 'react';
import { getUsers, createUser, deleteUser } from '../api/users';
import { getStudents } from '../api/students';
import { useLanguage } from '../context/LanguageContext';
import ConfirmModal from '../components/ConfirmModal';

function UsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });

  const fetchUsers = async () => {
    try { const data = await getUsers(); setUsers(data); }
    catch { setError(t('users_failed_load')); }
    finally { setLoading(false); }
  };

  const fetchStudents = async () => {
    try { const res = await getStudents(0, 500); setStudents(res.data); }
    catch (err) { console.error('Failed to load students'); }
  };

  useEffect(() => { fetchUsers(); fetchStudents(); }, []);

  const linkedStudentIds = new Set(users.filter(u => u.student_id).map(u => u.student_id));
  const availableStudents = students.filter(s => !linkedStudentIds.has(s.id));

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u => u.email.toLowerCase().includes(q) || (u.student_name || '').toLowerCase().includes(q) || (u.student_barcode || '').toLowerCase().includes(q) || u.role.toLowerCase().includes(q));
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => { setCurrentPage(1); }, [search, pageSize]);

  const handleCreate = async (e) => {
    e.preventDefault(); setError(''); setSuccess(''); setCreating(true);
    try {
      const result = await createUser(email, password, role, role === 'user' && studentId ? parseInt(studentId) : null);
      if (result.email_sent) setSuccess(t('users_created_email', { email }));
      else setSuccess(t('users_created_no_email', { email }));
      setEmail(''); setPassword(''); setRole('user'); setStudentId(''); fetchUsers();
    } catch (err) { setError(err.response?.data?.detail || t('users_create_failed')); }
    finally { setCreating(false); }
  };

  const handleDelete = async (userId, userEmail) => {
    setConfirmModal({
      open: true, title: t('users_delete_title'),
      message: t('users_delete_msg', { email: userEmail }),
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        try { await deleteUser(userId); setSuccess(t('users_deleted', { email: userEmail })); fetchUsers(); }
        catch (err) { setError(err.response?.data?.detail || t('users_delete_failed')); }
      },
    });
  };

  const selectableOnPage = paginated.filter(u => u.role !== 'admin');
  const toggleSelect = (id) => { setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => {
    if (selectableOnPage.length > 0 && selectableOnPage.every(u => selectedIds.has(u.id))) setSelectedIds(new Set());
    else setSelectedIds(new Set(selectableOnPage.map(u => u.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      open: true, title: t('users_delete_bulk_title'),
      message: t('users_delete_bulk_msg', { count: selectedIds.size }),
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false })); setError('');
        let failed = 0; const count = selectedIds.size;
        for (const id of selectedIds) { try { await deleteUser(id); } catch { failed++; } }
        setSelectedIds(new Set());
        if (failed > 0) setError(t('users_failed_delete_n', { count: failed }));
        else setSuccess(t('users_deleted_n', { count }));
        fetchUsers();
      },
    });
  };

  if (loading) return <div className="loading">{t('users_loading')}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>{t('users_title')}</h1>
        <div className="page-header-actions">
          {selectedIds.size > 0 && <button className="btn btn-danger bulk-delete-btn" onClick={handleBulkDelete}>&#128465; {t('users_delete_selected', { count: selectedIds.size })}</button>}
        </div>
      </div>

      <div className="form-card">
        <h3>{t('users_create_title')}</h3>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label>{t('users_email')}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="******@astanait.edu.kz" required />
            </div>
            <div className="form-group">
              <label>{t('users_password')}</label>
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('users_password_ph')} required minLength={6} />
            </div>
            <div className="form-group">
              <label>{t('users_role')}</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="user">{t('users_role_user')}</option>
                <option value="admin">{t('users_role_admin')}</option>
              </select>
            </div>
          </div>
          {role === 'user' && (
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>{t('users_link_student')}</label>
                <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                  <option value="">{t('users_select_student')}</option>
                  {availableStudents.map((s) => (<option key={s.id} value={s.id}>{s.full_name}  {s.barcode} ({s.group})</option>))}
                </select>
              </div>
            </div>
          )}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? t('users_creating') : t('users_create_btn')}
            </button>
          </div>
        </form>
      </div>

      <div className="search-bar">
        <input type="text" className="search-input" placeholder={t('users_search')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="table-container">
        <table>
          <thead><tr>
            <th className="th-checkbox"><input type="checkbox" checked={selectableOnPage.length > 0 && selectableOnPage.every(u => selectedIds.has(u.id))} onChange={toggleSelectAll} /></th>
            <th>#</th>
            <th>{t('users_email')}</th>
            <th>{t('users_student')}</th>
            <th>{t('users_barcode')}</th>
            <th>{t('users_role')}</th>
            <th>{t('users_actions')}</th>
          </tr></thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan="7" className="empty">{t('users_empty')}</td></tr>
            ) : (
              paginated.map((u, idx) => (
                <tr key={u.id} className={selectedIds.has(u.id) ? 'row-selected' : ''}>
                  <td className="td-checkbox">{u.role !== 'admin' && <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)} />}</td>
                  <td>{(currentPage - 1) * pageSize + idx + 1}</td>
                  <td>{u.email}</td>
                  <td>{u.student_name || ''}</td>
                  <td>{u.student_barcode || ''}</td>
                  <td><span className="badge">{u.role}</span></td>
                  <td>{u.role !== 'admin' && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u.id, u.email)}>{t('btn_delete')}</button>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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

export default UsersPage;
