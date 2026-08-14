import React, { useEffect, useState } from 'react';
import { getAuditLogs } from '../api/auditLogs';
import { useLanguage } from '../context/LanguageContext';

const translateAction = (action, t) => {
  const key = `audit_action_${action?.toLowerCase().replace(/ /g, '_')}`;
  const translated = t(key);
  return translated === key ? action : translated;
};

const translateEntity = (entity, t) => {
  const key = `audit_entity_${entity?.toLowerCase()}`;
  const translated = t(key);
  return translated === key ? entity : translated;
};

function AuditLogPage() {
  const { t, lang } = useLanguage();
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

  const formatDate = (d) => {
    if (!d) return '\u2014';
    const date = new Date(d);
    const locale = lang === 'ru' ? 'ru-RU' : 'en-GB';
    return date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="loading">{t('audit_loading')}</div>;

  return (
    <div className="page">
      <div className="page-header"><h1>{t('audit_title')}</h1></div>
      <div className="filter-bar">
        <input className="search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('audit_search')} />
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>{t('audit_date')}</th>
              <th>{t('audit_user')}</th>
              <th>{t('audit_action')}</th>
              <th>{t('audit_entity')}</th>
              <th>{t('audit_summary')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(log => (
              <tr key={log.id}>
                <td>{formatDate(log.created_at)}</td>
                <td>{log.actor_email || t('audit_system')}</td>
                <td><span className="badge">{translateAction(log.action, t)}</span></td>
                <td>{translateEntity(log.entity_type, t)}{log.entity_id ? ` #${log.entity_id}` : ''}</td>
                <td>{log.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">{t('audit_empty')}</p>}
      </div>
    </div>
  );
}

export default AuditLogPage;
