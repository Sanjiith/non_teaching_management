import api from './api';

export const getShifts = async (params = {}) => {
  const response = await api.get('/shifts', { params });
  return response.data.data;
};

export const createShift = async (shiftData) => {
  const response = await api.post('/shifts', shiftData);
  return response.data.data;
};

export const updateShift = async (id, shiftData) => {
  const response = await api.put(`/shifts/${id}`, shiftData);
  return response.data.data;
};

export const deleteShift = async (id) => {
  const response = await api.delete(`/shifts/${id}`);
  return response.data;
};

export const getMySchedules = async (params = {}) => {
  const response = await api.get('/schedules/my', { params });
  return response.data.data;
};

export const getDepartmentSchedules = async (params = {}) => {
  const response = await api.get('/schedules/department', { params });
  return response.data.data;
};

export const getAllSchedules = async (params = {}) => {
  const response = await api.get('/schedules', { params });
  return response.data.data;
};

export const assignSchedule = async (scheduleData) => {
  const response = await api.post('/schedules', scheduleData);
  return response.data;
};

export const updateSchedule = async (id, scheduleData) => {
  const response = await api.put(`/schedules/${id}`, scheduleData);
  return response.data.data;
};

export const deleteSchedule = async (id) => {
  const response = await api.delete(`/schedules/${id}`);
  return response.data;
};
