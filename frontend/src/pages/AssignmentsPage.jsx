import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { getAssignments, assignLocker, releaseAssignment, releaseAllAssignments, importCombinedCSV, geminiAllocate } from '../api/assignments';
import { getStudents } from '../api/students';
import { getLockers } from '../api/lockers';
import { useWebSocket } from '../hooks/useWebSocket';
import { useLanguage } from '../context/LanguageContext';
import ConfirmModal from '../components/ConfirmModal';
import { animateStagger, animateCounter } from '../utils/animations';
import { animate } from 'animejs';

function AssignmentsPage() {
  const { t, lang } = useLanguage();
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

  // Gemini allocation states
  const [geminiPlan, setGeminiPlan] = useState(null);
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiInstruction, setGeminiInstruction] = useState('');
  const [calcStep, setCalcStep] = useState(1);

  // Animation refs
  const calcBarRef = useRef(null);
  const tier1Ref = useRef(null);
  const tier2Ref = useRef(null);
  const tier3Ref = useRef(null);
  const tier4Ref = useRef(null);

  // Animate dynamic wave equalizer and progress glow bar with animejs
  useEffect(() => {
    let barAnim = null;
    let waveAnim = null;
    let stepInterval = null;

    if (geminiLoading) {
      setCalcStep(1);
      stepInterval = setInterval(() => {
        setCalcStep(s => (s < 4 ? s + 1 : 1));
      }, 600);

      try {
        if (calcBarRef.current) {
          barAnim = animate(calcBarRef.current, {
            width: ['10%', '94%'],
            duration: 1500,
            ease: 'inOutSine',
            loop: true,
            direction: 'alternate',
          });
        }

        waveAnim = animate('.ai-wave-bar', {
          height: [6, 26, 10, 22, 6],
          delay: (el, i) => i * 75,
          duration: 800,
          ease: 'inOutSine',
          loop: true,
        });
      } catch (err) {
        console.debug('Anime.js wave fallback', err);
      }
    }

    return () => {
      if (stepInterval) clearInterval(stepInterval);
      if (barAnim && barAnim.pause) barAnim.pause();
      if (waveAnim && waveAnim.pause) waveAnim.pause();
    };
  }, [geminiLoading]);

  // Animate simulation results & counters on plan ready
  useEffect(() => {
    if (geminiPlan) {
      animateStagger('.ai-simulation-card, .ai-tier-stat-box, .ai-sim-table-wrap tbody tr', {
        delay: 30,
        duration: 400,
      });

      if (tier1Ref.current) animateCounter(tier1Ref.current, geminiPlan.tier_1_count || 0, { duration: 600 });
      if (tier2Ref.current) animateCounter(tier2Ref.current, geminiPlan.tier_2_count || 0, { duration: 600 });
      if (tier3Ref.current) animateCounter(tier3Ref.current, geminiPlan.tier_3_count || 0, { duration: 600 });
      if (tier4Ref.current) animateCounter(tier4Ref.current, geminiPlan.tier_4_count || 0, { duration: 600 });
    }
  }, [geminiPlan]);
  // Table sorting and pagination
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const sortIcon = (col) => {
    if (sortCol !== col) return ' ⇅';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const fetchAll = useCallback(async () => {
    try {
      const [aRes, sRes, lRes] = await Promise.all([
        getAssignments(0, 10000),
        getStudents(0, 10000),
        getLockers(0, 10000)
      ]);
      setAssignments(aRes.data);
      setStudents(sRes.data);
      setLockers(lRes.data);
    } catch {
      setError(t('assign_failed_load'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useWebSocket({
    assignment_change: fetchAll,
    locker_change: fetchAll,
    student_change: fetchAll
  });

  const filtered = useMemo(() => {
    let data = assignments;
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(a =>
        (a.student_name || '').toLowerCase().includes(q) ||
        (a.locker_number || '').toLowerCase().includes(q)
      );
    }
    if (filterStatus === 'active') data = data.filter(a => !a.released_at);
    if (filterStatus === 'released') data = data.filter(a => a.released_at);
    if (sortCol) {
      data = [...data].sort((a, b) => {
        let va, vb;
        if (sortCol === 'status') {
          va = a.released_at ? 1 : 0;
          vb = b.released_at ? 1 : 0;
        } else {
          va = a[sortCol];
          vb = b[sortCol];
        }
        if (va == null) va = '';
        if (vb == null) vb = '';
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [assignments, search, filterStatus, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, filterStatus]);

  const handleAssign = async (e, force = false) => {
    if (e) e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await assignLocker({
        student_id: Number(form.student_id),
        locker_id: Number(form.locker_id),
        force
      });
      setSuccess(t('assign_success'));
      setForm({ student_id: '', locker_id: '' });
      setShowForm(false);
      fetchAll();
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
          onConfirm: () => {
            setConfirmModal(m => ({ ...m, open: false }));
            handleAssign(null, true);
          },
        });
      } else {
        setError(detail || t('assign_failed'));
      }
    }
  };

  const handleRelease = async (id) => {
    const a = assignments.find(x => x.id === id);
    setConfirmModal({
      open: true,
      title: t('assign_release_title'),
      message: t('assign_release_msg', {
        locker: a?.locker_number || '#' + id,
        student: a?.student_name || t('assign_student_lc')
      }),
      variant: 'warning',
      confirmText: t('assign_release'),
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        setError('');
        try {
          await releaseAssignment(id);
          setSuccess(t('assign_released'));
          fetchAll();
        } catch (err) {
          setError(err.response?.data?.detail || t('assign_release_failed'));
        }
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
        setConfirmModal(m => ({ ...m, open: false }));
        setError('');
        try {
          const res = await releaseAllAssignments();
          setSuccess(t('assign_release_all_success', { count: res.data.released }));
          fetchAll();
        } catch (err) {
          setError(err.response?.data?.detail || t('assign_release_failed'));
        }
      },
    });
  };

  const formatDate = (d) => d ? new Date(d).toLocaleString() : '—';
  const clearFilters = () => {
    setSearch('');
    setFilterStatus('');
    setSortCol('');
  };
  const hasFilters = search || filterStatus;

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportStatus(null);
    setError('');
    setSuccess('');
    try {
      const res = await importCombinedCSV(file);
      setImportStatus(res.data);
      fetchAll();
    } catch (err) {
      setError(err.response?.data?.detail || t('csv_combined_failed'));
    }
    e.target.value = '';
  };

  // ── Gemini AI Allocation ───────────────────────────────────────────────
  const handleGeminiPreview = async () => {
    setError('');
    setSuccess('');
    setGeminiLoading(true);
    try {
      const res = await geminiAllocate({ commit: false, instruction: geminiInstruction, lang });
      setGeminiPlan(res.data);
      if (res.data.planned === 0) {
        setSuccess(t('ai_already_all_assigned'));
      }
    } catch (err) {
      console.error('Gemini allocation error:', err);
      const detail = err.response?.data?.detail || err.message || 'Gemini API Error';
      if (typeof detail === 'string' && detail.includes('GEMINI_API_KEY')) {
        setError(t('ai_api_key_missing'));
      } else {
        setError(`AI Engine: ${detail}`);
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
      title: t('ai_commit_confirm_title'),
      message: t('ai_commit_confirm_msg', { count: planned }),
      variant: 'warning',
      confirmText: t('ai_commit_btn_text'),
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        setError('');
        setSuccess('');
        try {
          const res = await geminiAllocate({ commit: true, instruction: geminiInstruction, lang });
          setSuccess(t('ai_commit_success_msg', { count: res.data.created }));
          setGeminiPlan(null);
          setGeminiInstruction('');
          fetchAll();
        } catch (err) {
          setError(err.response?.data?.detail || t('assign_failed'));
        }
      },
    });
  };

  const tierBadgeClass = (tier) => {
    switch (tier) {
      case 1: return 'badge-tier-1';
      case 2: return 'badge-tier-2';
      case 3: return 'badge-tier-3';
      default: return 'badge-tier-4';
    }
  };

  if (loading) return <div className="loading">{t('assign_loading')}</div>;

  return (
    <div className="page">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1>{t('assign_title')}</h1>
          <p className="page-subtitle">{t('ai_page_subtitle')}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline" onClick={() => csvInputRef.current?.click()}>{t('csv_combined_import')}</button>
          <input type="file" accept=".csv" ref={csvInputRef} style={{ display: 'none' }} onChange={handleCSVImport} />

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

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}
      {importStatus && (
        <div className="alert alert-success">
          {t('csv_combined_result', {
            students: importStatus.created_students,
            lockers: importStatus.created_lockers,
            assignments: importStatus.created_assignments,
            skipped: importStatus.skipped
          })}
          {importStatus.errors?.length > 0 && (
            <ul className="import-errors">
              {importStatus.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* ─── AI Smart Allocation Control Panel (System Design Cohesive Block) ─── */}
      <div className="ai-allocation-control-card">
        <div className="ai-allocation-card-header">
          <div className="ai-title-section">
            <h3>{t('ai_auto_title')}</h3>
            <p className="ai-subtitle-text">{t('ai_auto_desc')}</p>
          </div>
          <div className="ai-action-section">
            <button
              className="btn btn-gemini"
              onClick={handleGeminiPreview}
              disabled={geminiLoading}
            >
              {geminiLoading ? t('ai_running_btn') : t('ai_run_btn')}
            </button>
          </div>
        </div>

        <div className="ai-allocation-rules-grid">
          <div className="rule-step">
            <span className="step-num">I</span>
            <div className="step-info">
              <strong>{t('ai_step_1_title')}</strong>
              <span>{t('ai_step_1_desc')}</span>
            </div>
          </div>
          <div className="rule-step">
            <span className="step-num">II</span>
            <div className="step-info">
              <strong>{t('ai_step_2_title')}</strong>
              <span>{t('ai_step_2_desc')}</span>
            </div>
          </div>
          <div className="rule-step">
            <span className="step-num">III</span>
            <div className="step-info">
              <strong>{t('ai_step_3_title')}</strong>
              <span>{t('ai_step_3_desc')}</span>
            </div>
          </div>
          <div className="rule-step">
            <span className="step-num">IV</span>
            <div className="step-info">
              <strong>{t('ai_step_4_title')}</strong>
              <span>{t('ai_step_4_desc')}</span>
            </div>
          </div>
        </div>

        <div className="ai-custom-prompt-row">
          <label className="ai-prompt-label">{t('ai_custom_rules_label')}</label>
          <div className="ai-prompt-input-wrapper">
            <input
              type="text"
              className="ai-prompt-input"
              placeholder={t('ai_custom_rules_placeholder')}
              value={geminiInstruction}
              onChange={e => setGeminiInstruction(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleGeminiPreview()}
              disabled={geminiLoading}
            />
          </div>
        </div>
      </div>

      {/* ─── AI Calculating Banner with Anime.js Neural Processing Animation ─── */}
      {geminiLoading && (
        <div className="ai-calc-loading-card">
          <div className="ai-calc-hero">
            <div className="ai-calc-core-status">
              <div className="ai-calc-waves-wrapper">
                <div className="ai-wave-bar" />
                <div className="ai-wave-bar" />
                <div className="ai-wave-bar" />
                <div className="ai-wave-bar" />
                <div className="ai-wave-bar" />
                <div className="ai-wave-bar" />
                <div className="ai-wave-bar" />
                <div className="ai-wave-bar" />
              </div>
              <div className="ai-calc-title-group">
                <h3>{t('ai_calc_title')}</h3>
                <p className="ai-calc-substatus">
                  {calcStep === 1 && t('ai_calc_step_1')}
                  {calcStep === 2 && t('ai_calc_step_2')}
                  {calcStep === 3 && t('ai_calc_step_3')}
                  {calcStep === 4 && t('ai_calc_step_4')}
                </p>
              </div>
            </div>
            <span className="ai-calc-badge">Smart AI Engine</span>
          </div>

          <div className="ai-calc-track">
            <div ref={calcBarRef} className="ai-calc-glow-bar" />
          </div>

          <div className="ai-calc-steps-grid">
            <div className={`ai-calc-step-card ${calcStep === 1 ? 'active' : ''}`}>
              <div className="ai-step-indicator">1</div>
              <span className="ai-step-text">{t('ai_calc_step_1')}</span>
            </div>
            <div className={`ai-calc-step-card ${calcStep === 2 ? 'active' : ''}`}>
              <div className="ai-step-indicator">2</div>
              <span className="ai-step-text">{t('ai_calc_step_2')}</span>
            </div>
            <div className={`ai-calc-step-card ${calcStep === 3 ? 'active' : ''}`}>
              <div className="ai-step-indicator">3</div>
              <span className="ai-step-text">{t('ai_calc_step_3')}</span>
            </div>
            <div className={`ai-calc-step-card ${calcStep === 4 ? 'active' : ''}`}>
              <div className="ai-step-indicator">4</div>
              <span className="ai-step-text">{t('ai_calc_step_4')}</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── AI Allocation Simulation Results ─────────────────────────────── */}
      {geminiPlan && (
        <div className="ai-simulation-card">
          <div className="ai-sim-header">
            <div className="ai-sim-title-group">
              <div className="ai-sim-heading-row">
                <h2>{t('ai_sim_title')}</h2>
                <span className="badge-ai-model">Smart AI Engine</span>
              </div>
              {geminiPlan.summary && (
                <p className="ai-sim-summary">{geminiPlan.summary}</p>
              )}
            </div>
            <div className="ai-sim-actions">
              <button
                className="btn btn-primary"
                onClick={handleGeminiApply}
                disabled={!geminiPlan.planned}
              >
                {t('ai_sim_commit_btn', { count: geminiPlan.planned })}
              </button>
              <button className="btn btn-outline" onClick={() => setGeminiPlan(null)}>
                {t('ai_sim_hide_btn')}
              </button>
            </div>
          </div>

          {/* 4 Tier Stat Cards */}
          <div className="ai-tier-stat-grid">
            <div className="ai-tier-stat-box tier-box-1">
              <div className="tier-box-badge">I</div>
              <div className="tier-box-content">
                <span ref={tier1Ref} className="tier-box-num">{geminiPlan.tier_1_count || 0}</span>
                <span className="tier-box-label">{t('ai_tier_1')}</span>
              </div>
            </div>
            <div className="ai-tier-stat-box tier-box-2">
              <div className="tier-box-badge">II</div>
              <div className="tier-box-content">
                <span ref={tier2Ref} className="tier-box-num">{geminiPlan.tier_2_count || 0}</span>
                <span className="tier-box-label">{t('ai_tier_2')}</span>
              </div>
            </div>
            <div className="ai-tier-stat-box tier-box-3">
              <div className="tier-box-badge">III</div>
              <div className="tier-box-content">
                <span ref={tier3Ref} className="tier-box-num">{geminiPlan.tier_3_count || 0}</span>
                <span className="tier-box-label">{t('ai_tier_3')}</span>
              </div>
            </div>
            <div className="ai-tier-stat-box tier-box-4">
              <div className="tier-box-badge">IV</div>
              <div className="tier-box-content">
                <span ref={tier4Ref} className="tier-box-num">{geminiPlan.tier_4_count || 0}</span>
                <span className="tier-box-label">{t('ai_tier_4')}</span>
              </div>
            </div>
          </div>

          <div className="ai-sim-meta-row">
            <span className="ai-sim-meta-text">
              {t('ai_sim_summary_text', {
                planned: geminiPlan.planned,
                spots: geminiPlan.available_spots,
                skipped: geminiPlan.skipped_students
              })}
            </span>
          </div>

          {geminiPlan.insights && (
            <div className="ai-sim-insights-callout">
              <span className="insights-tag">INFO</span>
              <p>{geminiPlan.insights}</p>
            </div>
          )}

          <div className="table-container ai-sim-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('assign_col_priority')}</th>
                  <th>{t('assign_student')}</th>
                  <th>{t('students_group')}</th>
                  <th>{t('assign_col_metrics')}</th>
                  <th>{t('assign_locker')}</th>
                  <th>{t('ai_reason_header')}</th>
                </tr>
              </thead>
              <tbody>
                {(geminiPlan.items || []).slice(0, 50).map((item, idx) => (
                  <tr key={`${item.student_id}-${item.locker_id}-${idx}`}>
                    <td>
                      <span className={`badge ${tierBadgeClass(item.tier)}`}>
                        {item.tier === 1 ? t('ai_tier_1_badge') : item.tier === 2 ? t('ai_tier_2_badge') : item.tier === 3 ? t('ai_tier_3_badge') : t('ai_tier_4_badge')}
                      </span>
                    </td>
                    <td><strong className="sim-student-name">{item.student_name}</strong></td>
                    <td><span className="badge badge-light">{item.student_group}</span></td>
                    <td>
                      <div className="sim-metrics-group">
                        <span className="metric-chip">Act: {item.activity_score}</span>
                        <span className="metric-chip">GPA: {item.gpa?.toFixed(2)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="sim-locker-cell">
                        <strong>#{item.locker_number}</strong>
                        <span className="sim-locker-sub">
                          {t('analytics_floor')} {item.locker_floor} ({item.locker_size})
                        </span>
                      </div>
                    </td>
                    <td className="sim-reason-cell">
                      <div className="sim-reason-pill">
                        {item.ai_reason}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(geminiPlan.items || []).length > 50 && (
            <p className="sim-pagination-note">
              {t('assign_showing_first_n', {
                count: Math.min(50, (geminiPlan.items || []).length),
                total: (geminiPlan.items || []).length
              })}
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
                      {s.inclusive_status && s.inclusive_status !== 'none' ? '(Priority) ' : ''}{s.full_name} ({s.group})
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
