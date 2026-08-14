import React, { useEffect, useState } from 'react';
import { getDashboardAnalytics } from '../api/assignments';
import { useLanguage } from '../context/LanguageContext';

function AnalyticsPage() {
  const { t } = useLanguage();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getDashboardAnalytics(period);
        setData(res.data);
      } catch {
        setError(t('analytics_error'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period, t]);

  const maxActivity = Math.max(1, ...(data?.assignments_per_day || []).map(x => x.count), ...(data?.releases_per_day || []).map(x => x.count));
  const periodLabels = { week: t('analytics_week'), month: t('analytics_month'), quarter: t('analytics_quarter') };
  const sizeLabel = (size) => {
    const key = `lockers_${size}`;
    const label = t(key);
    return label === key ? size : label;
  };

  if (loading) return <div className="loading">{t('analytics_loading')}</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return null;

  return (
    <div className="page analytics-page">
      <div className="page-header">
        <h1>{t('analytics_advanced_title')}</h1>
        <div className="analytics-period-toggle">
          {['week', 'month', 'quarter'].map(p => (
            <button key={p} className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPeriod(p)}>
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="analytics-summary">
        <div className="analytics-summary-card"><span className="analytics-summary-value">{data.current_occupied}</span><span className="analytics-summary-label">{t('analytics_current_occupied')}</span></div>
        <div className="analytics-summary-card"><span className="analytics-summary-value">{data.current_rate}%</span><span className="analytics-summary-label">{t('analytics_current_rate')}</span></div>
        <div className="analytics-summary-card"><span className="analytics-summary-value">{data.priority_share}%</span><span className="analytics-summary-label">{t('analytics_priority_students')}</span></div>
        <div className="analytics-summary-card"><span className="analytics-summary-value">{data.students_without_locker}</span><span className="analytics-summary-label">{t('analytics_without_locker')}</span></div>
        <div className="analytics-summary-card"><span className="analytics-summary-value">{data.average_duration_days}</span><span className="analytics-summary-label">{t('analytics_avg_days_used')}</span></div>
        <div className="analytics-summary-card"><span className="analytics-summary-value">{data.maintenance_count}</span><span className="analytics-summary-label">{t('analytics_maintenance')}</span></div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h2>{t('analytics_busiest_floors')}</h2>
          <div className="floor-stats">
            {data.busiest_floors.map(f => (
              <div className="floor-row" key={f.floor}>
                <div className="floor-label"><span className="floor-name">{t('analytics_floor')} {f.floor}</span><span className="floor-detail">{t('analytics_used_detail', { occupied: f.occupied, capacity: f.capacity })}</span></div>
                <div className="floor-bar-track"><div className="floor-bar-fill bar-success" style={{ width: `${f.rate}%` }} /></div>
                <span className="floor-pct">{f.rate}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-card">
          <h2>{t('analytics_popular_sizes')}</h2>
          <div className="analytics-size-grid">
            {data.size_stats.map(s => (
              <div className="analytics-size-card" key={s.size}>
                <div className="analytics-size-header"><span className="analytics-size-name">{sizeLabel(s.size)}</span><span className="analytics-size-pct">{s.rate}%</span></div>
                <div className="analytics-size-detail">{t('analytics_size_detail', { occupied: s.occupied, capacity: s.capacity, lockers: s.lockers })}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-card">
          <h2>{t('analytics_activity')}</h2>
          <div className="analytics-day-list">
            {[...(data.assignments_per_day || []), ...(data.releases_per_day || [])].slice(-12).map((row, i) => (
              <div className="analytics-day-row" key={`${row.date}-${i}`}>
                <span className="analytics-day-date">{row.date}</span>
                <div className="analytics-day-bar-track"><div className="analytics-day-bar" style={{ width: `${row.count / maxActivity * 100}%` }} /></div>
                <span className="analytics-day-count">{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-card">
          <h2>{t('analytics_peak_days')}</h2>
          <div className="analytics-peak-list">
            {data.peak_days.map((d, i) => (
              <div className="analytics-peak-row" key={d.date}>
                <span className="analytics-peak-rank">{i + 1}</span>
                <span className="analytics-peak-date">{d.date}</span>
                <span className="analytics-peak-count">{t('analytics_assignment_count', { count: d.count })}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
