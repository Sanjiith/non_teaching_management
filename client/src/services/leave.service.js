import api from './api';

export const applyLeave = async (leaveData) => {
  const response = await api.post('/leaves', leaveData);
  return response.data.data;
};

export const getMyLeaves = async (params = {}) => {
  const response = await api.get('/leaves/my', { params });
  return response.data.data;
};

export const getDepartmentLeaves = async (params = {}) => {
  const response = await api.get('/leaves/department', { params });
  return response.data.data;
};

export const getAllLeaves = async (params = {}) => {
  const response = await api.get('/leaves', { params });
  return response.data.data;
};

export const approveLeave = async (leaveId, remarks = '') => {
  const response = await api.put(`/leaves/${leaveId}/approve`, { remarks });
  return response.data.data;
};

export const rejectLeave = async (leaveId, remarks = '') => {
  const response = await api.put(`/leaves/${leaveId}/reject`, { remarks });
  return response.data.data;
};

export const cancelLeave = async (leaveId, remarks = '') => {
  const response = await api.put(`/leaves/${leaveId}/cancel`, { remarks });
  return response.data.data;
};
