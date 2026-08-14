import api from './axios';

export const getNotifications = (skip = 0, limit = 100) =>
  api.get('/notifications', { params: { skip, limit } });

export const getUnreadNotificationCount = () => api.get('/notifications/unread-count');
export const markNotificationRead = (id) => api.post(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.post('/notifications/read-all');
