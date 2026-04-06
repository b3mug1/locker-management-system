import api from './axios';

export const getAssignments = (skip = 0, limit = 500) =>
  api.get('/assignments', { params: { skip, limit } });

export const getMyAssignments = () => api.get('/assignments/my');

export const getMyDashboard = () => api.get('/assignments/my-dashboard');

export const getActiveCount = () => api.get('/assignments/active-count');

export const assignLocker = (data) => api.post('/assignments', data);

export const releaseAssignment = (id) => api.post(`/assignments/${id}/release`);

export const getDashboardStats = () => api.get('/dashboard/stats');

export const getDashboardAnalytics = (period = 'month') =>
  api.get('/dashboard/analytics', { params: { period } });

export const importCombinedCSV = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/assignments/import-combined-csv', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
