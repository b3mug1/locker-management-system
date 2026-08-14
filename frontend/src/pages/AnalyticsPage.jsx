import React, { useEffect, useState } from 'react';
import { getDashboardAnalytics } from '../api/assignments';

function AnalyticsPage() {
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
        setError('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  const maxActivity = Math.max(1, ...(data?.assignments_per_day || []).map(x => x.count), ...(data?.releases_per_day || []).map(x => x.count));

  if (loading) return <div className="loading">Loading analytics...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return null;

  return (
    <div className="page analytics-page">
      <div className="page-header">
        <h1>Advanced Analytics</h1>
        <div className="analytics-period-toggle">
          {['week', 'month', 'quarter'].map(p => (
            <button key={p} className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-outline'}`} onClick={() => setPeriod(p)}>
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="analytics-summary">
        <div className="analytics-summary-card"><span className="analytics-summary-value">{data.current_occupied}</span><span className="analytics-summary-label">Occupied now</span></div>
        <div className="analytics-summary-card"><span className="analytics-summary-value">{data.current_rate}%</span><span className="analytics-summary-label">Occupancy rate</span></div>
        <div className="analytics-summary-card"><span className="analytics-summary-value">{data.priority_share}%</span><span className="analytics-summary-label">Priority students</span></div>
        <div className="analytics-summary-card"><span className="analytics-summary-value">{data.students_without_locker}</span><span className="analytics-summary-label">Without locker</span></div>
        <div className="analytics-summary-card"><span className="analytics-summary-value">{data.average_duration_days}</span><span className="analytics-summary-label">Avg days used</span></div>
        <div className="analytics-summary-card"><span className="analytics-summary-value">{data.maintenance_count}</span><span className="analytics-summary-label">Maintenance</span></div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h2>Busiest Floors</h2>
          <div className="floor-stats">
            {data.busiest_floors.map(f => (
              <div className="floor-row" key={f.floor}>
                <div className="floor-label"><span className="floor-name">Floor {f.floor}</span><span className="floor-detail">{f.occupied}/{f.capacity} used</span></div>
                <div className="floor-bar-track"><div className="floor-bar-fill bar-success" style={{ width: `${f.rate}%` }} /></div>
                <span className="floor-pct">{f.rate}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-card">
          <h2>Popular Sizes</h2>
          <div className="analytics-size-grid">
            {data.size_stats.map(s => (
              <div className="analytics-size-card" key={s.size}>
                <div className="analytics-size-header"><span className="analytics-size-name">{s.size}</span><span className="analytics-size-pct">{s.rate}%</span></div>
                <div className="analytics-size-detail">{s.occupied}/{s.capacity} spots, {s.lockers} lockers</div>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-card">
          <h2>Activity</h2>
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
          <h2>Peak Days</h2>
          <div className="analytics-peak-list">
            {data.peak_days.map((d, i) => (
              <div className="analytics-peak-row" key={d.date}>
                <span className="analytics-peak-rank">{i + 1}</span>
                <span className="analytics-peak-date">{d.date}</span>
                <span className="analytics-peak-count">{d.count} assignments</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
