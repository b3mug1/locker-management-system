import api from './axios';

export const getIncidents = (params = {}) => api.get('/incidents', { params });
export const createIncident = (data) => api.post('/incidents', data);
export const updateIncident = (id, data) => api.put(`/incidents/${id}`, data);
export const deleteIncident = (id) => api.delete(`/incidents/${id}`);
