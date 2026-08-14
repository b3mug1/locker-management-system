import React, { useEffect, useState } from 'react';
import { getAuditLogs } from '../api/auditLogs';

function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getAuditLogs().then(res => setLogs(res.data)).finally(() => setLoading(false));
  }, []);

  const filtered = logs.filter(log => {
    const q = search.toLowerCase();
    return !q || [log.actor_email, log.action, log.entity_type, log.summary].some(v => (v || '').toLowerCase().includes(q));
  });

  if (loading) return <div className="loading">Loading activity log...</div>;

  return (
    <div className="page">
      <div className="page-header"><h1>Activity Log</h1></div>
      <div className="filter-bar">
        <input className="search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user, action, entity..." />
      </div>
      <div className="table-container">
        <table>
          <thead><tr><th>Date</th><th>User</th><th>Action</th><th>Entity</th><th>Summary</th></tr></thead>
          <tbody>
            {filtered.map(log => (
              <tr key={log.id}>
                <td>{new Date(log.created_at).toLocaleString()}</td>
                <td>{log.actor_email || 'System'}</td>
                <td><span className="badge">{log.action}</span></td>
                <td>{log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}</td>
                <td>{log.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">No activity found.</p>}
      </div>
    </div>
  );
}

export default AuditLogPage;
