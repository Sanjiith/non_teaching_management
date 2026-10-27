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

export const checkSubstituteRequirement = async (params = {}) => {
  const response = await api.get('/leaves/check-substitute-requirement', { params });
  return response.data.data;
};

export const getEligibleSubstitutes = async (params = {}) => {
  const response = await api.get('/leaves/eligible-substitutes', { params });
  return response.data.data;
};

export const getMySubstituteRequests = async (params = {}) => {
  const response = await api.get('/leaves/substitute-requests', { params });
  return response.data.data;
};

export const respondToSubstituteRequest = async (leaveId, action, remarks = '') => {
  const response = await api.put(`/leaves/${leaveId}/substitute-respond`, { action, remarks });
  return response.data.data;
};

export const reassignSubstitute = async (leaveId, substituteId) => {
  const response = await api.put(`/leaves/${leaveId}/reassign-substitute`, { substitute: substituteId });
  return response.data.data;
};

