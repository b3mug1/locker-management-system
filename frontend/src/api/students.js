import api from './axios';

export const getStudents = (skip = 0, limit = 200) =>
  api.get('/students', { params: { skip, limit } });

export const getStudentCount = () => api.get('/students/count');

export const createStudent = (data) => api.post('/students', data);

export const updateStudent = (id, data) => api.put(`/students/${id}`, data);

export const deleteStudent = (id) => api.delete(`/students/${id}`);

export const importStudentsCSV = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/students/import-csv', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
