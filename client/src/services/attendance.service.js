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

export const getAttendanceStats = async (params = {}) => {
  const response = await api.get('/attendance/stats', { params });
  return response.data.data;
};

export const staffCheckIn = async () => {
  const response = await api.post('/attendance/check-in');
  return response.data;
};

export const getTodayAttendance = async () => {
  const response = await api.get('/attendance/today');
  return response.data.data;
};

export const getDailyStaffAttendance = async (params = {}) => {
  const response = await api.get('/attendance/daily-staff', { params });
  return response.data.data;
};

export const getAttendanceConfig = async () => {
  const response = await api.get('/attendance/config');
  return response.data.data;
};

export const updateAttendanceConfig = async (data) => {
  const response = await api.put('/attendance/config', data);
  return response.data.data;
};

export const processAbsentees = async (data = {}) => {
  const response = await api.post('/attendance/process-absentees', data);
  return response.data;
};
