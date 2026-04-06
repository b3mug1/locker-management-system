import api from './axios';

export const getUsers = async () => {
  const response = await api.get('/users/');
  return response.data;
};

export const createUser = async (email, password, role = 'user', studentId = null) => {
  const response = await api.post('/users/', { email, password, role, student_id: studentId });
  return response.data;
};

export const deleteUser = async (userId) => {
  await api.delete(`/users/${userId}`);
};
