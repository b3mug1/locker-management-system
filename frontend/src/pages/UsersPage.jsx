import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getUsers, createUser, deleteUser } from '../api/users';
import { getStudents } from '../api/students';
import { useLanguage } from '../context/LanguageContext';
import ConfirmModal from '../components/ConfirmModal';
import { animateStagger } from '../utils/animations';
import { RefreshCw, Copy, Check, ShieldCheck } from 'lucide-react';

const generateSecurePassword = (length = 10) => {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*';

  let pwd = '';
  pwd += upper.charAt(Math.floor(Math.random() * upper.length));
  pwd += lower.charAt(Math.floor(Math.random() * lower.length));
  pwd += digits.charAt(Math.floor(Math.random() * digits.length));
  pwd += symbols.charAt(Math.floor(Math.random() * symbols.length));

  const all = lower + upper + digits + symbols;
  for (let i = 0; i < length - 4; i++) {
    pwd += all.charAt(Math.floor(Math.random() * all.length));
  }

  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
};

function UsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState([]);
  const [students, setStudents] = useState([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => generateSecurePassword());
  const [copied, setCopied] = useState(false);
  const [lastCreated, setLastCreated] = useState(null);
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

  const handleRegeneratePassword = useCallback(() => {
    const newPwd = generateSecurePassword();
    setPassword(newPwd);
    setCopied(false);
  }, []);

  const handleCopyPassword = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStudentSelect = (selectedId) => {
    setStudentId(selectedId);
    if (!selectedId) return;
    const selectedStudent = students.find(s => String(s.id) === String(selectedId));
    if (selectedStudent && !email) {
      // Suggest university email format based on barcode
      const cleanBarcode = selectedStudent.barcode.toLowerCase().replace(/[^a-z0-9]/g, '');
      setEmail(`${cleanBarcode}@astanait.edu.kz`);
    }
  };

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

  useEffect(() => {
    if (paginated.length > 0) {
      animateStagger('.table tbody tr', { delay: 25, duration: 400, translateY: [12, 0] });
    }
  }, [currentPage, pageSize, search]);

  const handleCreate = async (e) => {
    e.preventDefault(); setError(''); setSuccess(''); setCreating(true);
    const usedPassword = password.trim() || generateSecurePassword();
    try {
      const result = await createUser(email, usedPassword, role, role === 'user' && studentId ? parseInt(studentId) : null);
      setLastCreated({ email, password: usedPassword });
      if (result.email_sent) {
        setSuccess(t('users_created_email', { email }));
      } else {
        setSuccess(t('users_created_no_email', { email }));
      }
      setEmail('');
      setRole('user');
      setStudentId('');
      setPassword(generateSecurePassword());
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.detail || t('users_create_failed'));
    } finally {
      setCreating(false);
    }
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
          {selectedIds.size > 0 && (
            <button className="btn btn-danger bulk-delete-btn" onClick={handleBulkDelete}>
              {t('users_delete_selected', { count: selectedIds.size })}
            </button>
          )}
        </div>
      </div>

      <div className="form-card">
        <h3>{t('users_create_title')}</h3>
        {error && <div className="alert alert-error">{error}</div>}
        {success && (
          <div className="alert alert-success" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
            <div>{success}</div>
            {lastCreated && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,0,0,0.04)', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.78rem' }}>
                <span><strong>Login:</strong> {lastCreated.email}</span>
                <span>·</span>
                <span><strong>Password:</strong> <code style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{lastCreated.password}</code></span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem', marginLeft: '0.25rem' }}
                  onClick={() => navigator.clipboard.writeText(`${lastCreated.email} / ${lastCreated.password}`)}
                >
                  {t('users_copy_password')}
                </button>
              </div>
            )}
          </div>
        )}
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="form-group">
              <label>{t('users_email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="******@astanait.edu.kz"
                required
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ margin: 0 }}>{t('users_password')}</label>
                <span className="badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.45rem' }}>
                  {t('users_generated_badge')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('users_password_ph')}
                  required
                  minLength={6}
                  style={{ fontFamily: 'monospace', fontWeight: 600, letterSpacing: '0.04em' }}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '0 0.65rem' }}
                  onClick={handleRegeneratePassword}
                  title={t('users_regenerate_password')}
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: '0 0.65rem' }}
                  onClick={handleCopyPassword}
                  title={t('users_copy_password')}
                >
                  {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>{t('users_role')}</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="user">{t('users_role_user')}</option>
                <option value="technician">{t('users_role_technician')}</option>
                <option value="admin">{t('users_role_admin')}</option>
              </select>
            </div>
          </div>

          {role === 'user' && (
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>{t('users_link_student')}</label>
                <select value={studentId} onChange={(e) => handleStudentSelect(e.target.value)} required>
                  <option value="">{t('users_select_student')}</option>
                  {availableStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} · {s.barcode} ({s.group})
                    </option>
                  ))}
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
        <input
          type="text"
          className="search-input"
          placeholder={t('users_search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
