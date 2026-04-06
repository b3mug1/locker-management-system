import api from './axios';

export const getLockers = (skip = 0, limit = 200) =>
  api.get('/lockers', { params: { skip, limit } });

export const getLockerCount = () => api.get('/lockers/count');

export const createLocker = (data) => api.post('/lockers', data);

export const updateLocker = (id, data) => api.put(`/lockers/${id}`, data);

export const deleteLocker = (id) => api.delete(`/lockers/${id}`);

export const importLockersCSV = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/lockers/import-csv', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
