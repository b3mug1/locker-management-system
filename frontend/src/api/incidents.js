import api from './axios';

export const getIncidents = (params = {}) => api.get('/incidents', { params });
export const getTechnicians = () => api.get('/incidents/technicians');
export const getMyTechnicianTasks = (params = {}) => api.get('/incidents/my-tasks', { params });
export const createIncident = (data) => api.post('/incidents', data);
export const updateIncident = (id, data) => api.put(`/incidents/${id}`, data);
export const assignTechnician = (id, technicianId) => api.post(`/incidents/${id}/assign`, { technician_id: technicianId });
export const startRepair = (id) => api.post(`/incidents/${id}/start`);
export const resolveIncident = (id, notes) => api.post(`/incidents/${id}/resolve`, { notes });
export const deleteIncident = (id) => api.delete(`/incidents/${id}`);
