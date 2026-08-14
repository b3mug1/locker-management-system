import api from './axios';

export const getAuditLogs = (skip = 0, limit = 200) =>
  api.get('/audit-logs', { params: { skip, limit } });
