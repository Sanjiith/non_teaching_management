import api from './api';

export const getMyAttendance = async (params = {}) => {
  const response = await api.get('/attendance/my', { params });
  return response.data.data;
};

export const getDepartmentAttendance = async (params = {}) => {
  const response = await api.get('/attendance/department', { params });
  return response.data.data;
};

export const getAllAttendance = async (params = {}) => {
  const response = await api.get('/attendance', { params });
  return response.data.data;
};

export const getStaffAttendance = async (userId, params = {}) => {
  const response = await api.get(`/attendance/user/${userId}`, { params });
  return response.data.data;
};

export const markOrCorrectAttendance = async (data) => {
  const response = await api.post('/attendance/mark', data);
  return response.data.data;
};

export const getAttendanceStats = async () => {
  const response = await api.get('/attendance/stats');
  return response.data.data;
};
