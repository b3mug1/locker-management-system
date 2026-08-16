import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { getAssignments, assignLocker, releaseAssignment, releaseAllAssignments, importCombinedCSV, autoAssignLockers, geminiAllocate, geminiChat } from '../api/assignments';
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

  // Classic 4-tier auto-assign
  const [autoAssignPlan, setAutoAssignPlan] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Gemini allocation
  const [geminiPlan, setGeminiPlan] = useState(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiInstruction, setGeminiInstruction] = useState('');
  const [showGeminiInput, setShowGeminiInput] = useState(false);
  const [activeTab, setActiveTab] = useState('classic'); // 'classic' | 'gemini'

  // Gemini Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'model', text: '👋 Привет! Я Gemini AI. Задайте вопрос о распределении локеров или состоянии системы.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Table state
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleSort = (col) => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc'); } };
  const sortIcon = (col) => { if (sortCol !== col) return ' ⇅'; return sortDir === 'asc' ? ' ↑' : ' ↓'; };

  const fetchAll = useCallback(async () => {
    try {
      const [aRes, sRes, lRes] = await Promise.all([getAssignments(0, 10000), getStudents(0, 10000), getLockers(0, 10000)]);
      setAssignments(aRes.data); setStudents(sRes.data); setLockers(lRes.data);
    } catch { setError(t('assign_failed_load')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useWebSocket({ assignment_change: fetchAll, locker_change: fetchAll, student_change: fetchAll });

  // Scroll chat to bottom
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages, chatOpen]);

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

  const activeCount = assignments.filter(a => !a.released_at).length;

  const handleReleaseAll = () => {
    if (activeCount === 0) return;
    setConfirmModal({
      open: true,
      title: t('assign_release_all_title'),
      message: t('assign_release_all_msg', { count: activeCount }),
      variant: 'danger',
      confirmText: t('assign_release_all_confirm'),
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false })); setError('');
        try {
          const res = await releaseAllAssignments();
          setSuccess(t('assign_release_all_success', { count: res.data.released }));
          fetchAll();
        } catch (err) { setError(err.response?.data?.detail || t('assign_release_failed')); }
      },
    });
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString() : '—';
  const clearFilters = () => { setSearch(''); setFilterStatus(''); setSortCol(''); };
  const hasFilters = search || filterStatus;

  const handleCSVImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setImportStatus(null); setError(''); setSuccess('');
    try { const res = await importCombinedCSV(file); setImportStatus(res.data); fetchAll(); }
    catch (err) { setError(err.response?.data?.detail || t('csv_combined_failed')); }
    e.target.value = '';
  };

  // ── Classic 4-tier auto-assign ──────────────────────────────────────────
  const handleAutoAssignPreview = async () => {
    setError(''); setSuccess(''); setAiLoading(true); setActiveTab('classic');
    try {
      const res = await autoAssignLockers({ commit: false });
      setAutoAssignPlan(res.data);
      if (res.data.planned === 0) setSuccess(t('auto_empty'));
    } catch (err) {
      setError(err.response?.data?.detail || t('auto_preview_failed'));
    } finally {
      setAiLoading(false);
    }
  };

  const handleAutoAssignApply = () => {
    const planned = autoAssignPlan?.planned || 0;
    if (planned === 0) return;
    setConfirmModal({
      open: true,
      title: t('auto_apply_title'),
      message: t('auto_apply_msg', { count: planned }),
      variant: 'warning',
      confirmText: t('auto_apply_confirm'),
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        setError(''); setSuccess('');
        try {
          const res = await autoAssignLockers({ commit: true });
          setSuccess(t('auto_success', { count: res.data.created }));
          setAutoAssignPlan(null);
          fetchAll();
        } catch (err) {
          setError(err.response?.data?.detail || t('auto_failed'));
        }
      },
    });
  };

  // ── Gemini allocation ───────────────────────────────────────────────────
  const handleGeminiPreview = async () => {
    setError(''); setSuccess(''); setGeminiLoading(true); setActiveTab('gemini');
    try {
      const res = await geminiAllocate({ commit: false, instruction: geminiInstruction });
      setGeminiPlan(res.data);
      setShowGeminiInput(false);
      if (res.data.planned === 0) setSuccess('✨ Gemini: все студенты уже распределены.');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Ошибка Gemini API';
      if (detail.includes('GEMINI_API_KEY')) {
        setError('⚠️ Gemini API ключ не настроен. Добавьте GEMINI_API_KEY в backend/.env и перезапустите сервер.');
      } else {
        setError(`Gemini: ${detail}`);
      }
    } finally {
      setGeminiLoading(false);
    }
  };

  const handleGeminiApply = () => {
    const planned = geminiPlan?.planned || 0;
    if (planned === 0) return;
    setConfirmModal({
      open: true,
      title: '✨ Применить распределение Gemini?',
      message: `Gemini предлагает назначить ${planned} студентов. Подтвердить?`,
      variant: 'warning',
      confirmText: 'Применить',
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        setError(''); setSuccess('');
        try {
          const res = await geminiAllocate({ commit: true, instruction: geminiInstruction });
          setSuccess(`✨ Gemini успешно распределил ${res.data.created} студентов!`);
          setGeminiPlan(null);
          fetchAll();
        } catch (err) {
          setError(err.response?.data?.detail || 'Ошибка применения Gemini');
        }
      },
    });
  };

  // ── Gemini Chat ─────────────────────────────────────────────────────────
  const handleChatSend = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const newMessages = [...chatMessages, { role: 'user', text: msg }];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);
    try {
      // Build Gemini history format
      const history = chatMessages
        .filter(m => m.role !== 'model' || chatMessages.indexOf(m) > 0)
        .map(m => ({ role: m.role, parts: [m.text] }));
      const res = await geminiChat(msg, history);
      setChatMessages(prev => [...prev, { role: 'model', text: res.data.reply }]);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Ошибка';
      setChatMessages(prev => [...prev, { role: 'model', text: `⚠️ ${detail}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const tierBadgeClass = (tier) => {
    switch (tier) {
      case 1: return 'badge-tier-1';
      case 2: return 'badge-tier-2';
      case 3: return 'badge-tier-3';
      default: return 'badge-tier-4';
    }
  };

  const currentPlan = activeTab === 'gemini' ? geminiPlan : autoAssignPlan;

  if (loading) return <div className="loading">{t('assign_loading')}</div>;

  return (
    <div className="page">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>{t('assign_title')}</h1>
          <p className="page-subtitle">{t('ai_auto_desc')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => csvInputRef.current?.click()}>{t('csv_combined_import')}</button>
          <input type="file" accept=".csv" ref={csvInputRef} style={{ display: 'none' }} onChange={handleCSVImport} />

          {/* Classic AI */}
          <button className="btn btn-ai-primary" onClick={handleAutoAssignPreview} disabled={aiLoading}>
            {aiLoading ? '🤖 Расчёт...' : t('ai_preview_btn')}
          </button>

          {/* Gemini AI */}
          <button
            className="btn btn-gemini"
            onClick={() => setShowGeminiInput(v => !v)}
            disabled={geminiLoading}
          >
            {geminiLoading ? '✨ Gemini думает...' : '✨ Gemini ИИ'}
          </button>

          <button
            className="btn btn-danger"
            onClick={handleReleaseAll}
            disabled={activeCount === 0}
            title={activeCount === 0 ? t('assign_release_all_none') : undefined}
          >
            {t('assign_release_all')}
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? t('btn_cancel') : t('assign_add')}
          </button>
        </div>
      </div>

      {/* ─── Gemini Instruction Input ─────────────────────────────────── */}
      {showGeminiInput && (
        <div className="gemini-instruction-bar">
          <div className="gemini-instruction-icon">✨</div>
          <input
            type="text"
            className="gemini-instruction-input"
            placeholder="Дополнительные инструкции (необязательно): напр. «приоритет группе SE-2204», «только 1-й этаж»..."
            value={geminiInstruction}
            onChange={e => setGeminiInstruction(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleGeminiPreview()}
          />
          <button className="btn btn-gemini" onClick={handleGeminiPreview} disabled={geminiLoading}>
            {geminiLoading ? 'Думает...' : 'Запустить Gemini'}
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => setShowGeminiInput(false)}>✕</button>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      {importStatus && (
        <div className="alert alert-success">
          {t('csv_combined_result', { students: importStatus.created_students, lockers: importStatus.created_lockers, assignments: importStatus.created_assignments, skipped: importStatus.skipped })}
          {importStatus.errors?.length > 0 && (<ul className="import-errors">{importStatus.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>)}
        </div>
      )}

      {/* ─── AI Preview Panel ─────────────────────────────────────────── */}
      {currentPlan && (
        <div className={`ai-preview-card ${activeTab === 'gemini' ? 'ai-preview-card--gemini' : ''}`}>
          <div className="ai-preview-header">
            <div className="ai-preview-title-wrap">
              <h2>{activeTab === 'gemini' ? '✨ Gemini AI Allocation' : `🤖 ${t('ai_auto_title')}`}</h2>
              <span className={`badge-ai-pulse ${activeTab === 'gemini' ? 'badge-gemini-pulse' : ''}`}>
                {activeTab === 'gemini' ? 'Gemini 1.5 Flash' : 'AI Algorithm Active'}
              </span>
              {activeTab === 'gemini' && currentPlan.summary && (
                <p className="gemini-summary-inline">{currentPlan.summary}</p>
              )}
            </div>
            <div className="ai-header-actions">
              <button
                className={`btn btn-sm ${activeTab === 'gemini' ? 'btn-gemini' : 'btn-success'}`}
                onClick={activeTab === 'gemini' ? handleGeminiApply : handleAutoAssignApply}
                disabled={!currentPlan?.planned}
              >
                ⚡ Применить ({currentPlan.planned})
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => { setAutoAssignPlan(null); setGeminiPlan(null); }}>
                {t('auto_hide')}
              </button>
            </div>
          </div>

          {/* Tier stats */}
          <div className="ai-stats-row">
            <div className="ai-stat-pill pill-tier-1">
              <span className="pill-icon">⭐</span>
              <div className="pill-info">
                <span className="pill-val">{currentPlan.tier_1_count || 0}</span>
                <span className="pill-lbl">{t('ai_tier_1')}</span>
              </div>
            </div>
            <div className="ai-stat-pill pill-tier-2">
              <span className="pill-icon">🚀</span>
              <div className="pill-info">
                <span className="pill-val">{currentPlan.tier_2_count || 0}</span>
                <span className="pill-lbl">{t('ai_tier_2')}</span>
              </div>
            </div>
            <div className="ai-stat-pill pill-tier-3">
              <span className="pill-icon">🎓</span>
              <div className="pill-info">
                <span className="pill-val">{currentPlan.tier_3_count || 0}</span>
                <span className="pill-lbl">{t('ai_tier_3')}</span>
              </div>
            </div>
            <div className="ai-stat-pill pill-tier-4">
              <span className="pill-icon">👥</span>
              <div className="pill-info">
                <span className="pill-val">{currentPlan.tier_4_count || 0}</span>
                <span className="pill-lbl">{t('ai_tier_4')}</span>
              </div>
            </div>
          </div>

          <p className="ai-summary-text">
            {t('ai_simulation_summary', { planned: currentPlan.planned, spots: currentPlan.available_spots, skipped: currentPlan.skipped_students })}
          </p>

          {activeTab === 'gemini' && currentPlan.insights && (
            <div className="gemini-insights-box">
              <span className="gemini-insights-icon">💡</span>
              <p>{currentPlan.insights}</p>
            </div>
          )}

          <div className="table-container ai-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Приоритет</th>
                  <th>{t('assign_student')}</th>
                  <th>{t('students_group')}</th>
                  <th>Метрики</th>
                  <th>{t('assign_locker')}</th>
                  <th>{t('ai_reason_header')}</th>
                </tr>
              </thead>
              <tbody>
                {currentPlan.items.slice(0, 50).map((item, idx) => (
                  <tr key={`${item.student_id}-${item.locker_id}-${idx}`}>
                    <td>
                      <span className={`badge ${tierBadgeClass(item.tier)}`}>
                        {item.tier === 1 ? t('ai_tier_1_badge') : item.tier === 2 ? t('ai_tier_2_badge') : item.tier === 3 ? t('ai_tier_3_badge') : t('ai_tier_4_badge')}
                      </span>
                    </td>
                    <td><strong>{item.student_name}</strong></td>
                    <td><span className="badge badge-light">{item.student_group}</span></td>
                    <td>
                      <span className="metric-pill" title="Активность">⚡ {item.activity_score}</span>
                      <span className="metric-pill" title="GPA">🎓 {item.gpa?.toFixed(2)}</span>
                    </td>
                    <td>
                      <strong>#{item.locker_number}</strong>
                      <span className="text-muted" style={{ display: 'block', fontSize: '0.8rem' }}>
                        Этаж {item.locker_floor} ({item.locker_size})
                      </span>
                    </td>
                    <td className="ai-reason-cell">
                      <span className={`ai-reason-badge ${activeTab === 'gemini' ? 'ai-reason-badge--gemini' : ''}`}>
                        {item.ai_reason}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {currentPlan.items.length > 50 && (
            <p className="analytics-sub text-center" style={{ marginTop: '0.5rem' }}>
              Показаны первые 50 из {currentPlan.items.length} назначений.
            </p>
          )}
        </div>
      )}

      {/* ─── Manual Form ──────────────────────────────────────────────── */}
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
                  {lockers.filter(l => l.status === 'active').map((l) => (
                    <option key={l.id} value={l.id}>
                      #{l.number} ({t('lockers_floor')} {l.floor}, {l.size})
                    </option>
                  ))}
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

      {/* ─── Filter Bar ───────────────────────────────────────────────── */}
      <div className="filter-bar">
        <input
          type="text"
          className="search-input"
          placeholder={t('assign_search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">{t('assign_all_status')}</option>
          <option value="active">{t('assign_active')}</option>
          <option value="released">{t('assign_released_label')}</option>
        </select>
        {hasFilters && <button className="btn btn-sm btn-outline" onClick={clearFilters}>{t('btn_clear')}</button>}
      </div>

      {/* ─── Table ────────────────────────────────────────────────────── */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('student_name')} style={{ cursor: 'pointer' }}>
                {t('assign_student')}{sortIcon('student_name')}
              </th>
              <th onClick={() => handleSort('locker_number')} style={{ cursor: 'pointer' }}>
                {t('assign_locker')}{sortIcon('locker_number')}
              </th>
              <th onClick={() => handleSort('assigned_at')} style={{ cursor: 'pointer' }}>
                {t('assign_assigned_at')}{sortIcon('assigned_at')}
              </th>
              <th onClick={() => handleSort('released_at')} style={{ cursor: 'pointer' }}>
                {t('assign_released_at')}{sortIcon('released_at')}
              </th>
              <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                {t('assign_status')}{sortIcon('status')}
              </th>
              <th>{t('assign_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.student_name}</strong></td>
                <td>#{a.locker_number}</td>
                <td>{formatDate(a.assigned_at)}</td>
                <td>{formatDate(a.released_at)}</td>
                <td>
                  <span className={`status-badge ${a.released_at ? 'status-released' : 'status-active'}`}>
                    {a.released_at ? t('assign_released_label') : t('assign_active')}
                  </span>
                </td>
                <td>
                  {!a.released_at && (
                    <button className="btn btn-sm btn-danger" onClick={() => handleRelease(a.id)}>
                      {t('assign_release')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">{t('assign_empty')}</p>}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-sm btn-outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>←</button>
          <span>{currentPage} / {totalPages}</span>
          <button className="btn btn-sm btn-outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>→</button>
        </div>
      )}

      {/* ─── Gemini Chat Widget ──────────────────────────────────────── */}
      <div className={`gemini-chat-widget ${chatOpen ? 'gemini-chat-widget--open' : ''}`}>
        <button
          className="gemini-chat-toggle"
          onClick={() => setChatOpen(v => !v)}
          title="Gemini AI Ассистент"
        >
          {chatOpen ? '✕' : '✨'}
          {!chatOpen && <span className="gemini-chat-toggle-label">AI Ассистент</span>}
        </button>

        {chatOpen && (
          <div className="gemini-chat-panel">
            <div className="gemini-chat-header">
              <span className="gemini-chat-title">✨ Gemini AI Ассистент</span>
              <span className="gemini-model-tag">gemini-1.5-flash</span>
            </div>
            <div className="gemini-chat-messages">
              {chatMessages.map((m, i) => (
                <div key={i} className={`gemini-msg gemini-msg--${m.role}`}>
                  <div className="gemini-msg-bubble">{m.text}</div>
                </div>
              ))}
              {chatLoading && (
                <div className="gemini-msg gemini-msg--model">
                  <div className="gemini-msg-bubble gemini-thinking">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="gemini-chat-input-row">
              <input
                type="text"
                className="gemini-chat-input"
                placeholder="Спросите Gemini о локерах..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                disabled={chatLoading}
              />
              <button
                className="btn btn-gemini btn-sm"
                onClick={handleChatSend}
                disabled={chatLoading || !chatInput.trim()}
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(m => ({ ...m, open: false }))}
      />
    </div>
  );
}

export default AssignmentsPage;
