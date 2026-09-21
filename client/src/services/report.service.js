import api from './api';

/**
 * Report API service — client-side wrappers
 */

// ── Admin Reports ─────────────────────────────────────────────────────────────

export const getAdminAttendanceReport = async (filters = {}) => {
  const res = await api.get('/reports/admin/attendance', { params: filters });
  return res.data?.data;
};

export const getAdminLeaveReport = async (filters = {}) => {
  const res = await api.get('/reports/admin/leave', { params: filters });
  return res.data?.data;
};

export const getAdminPayrollReport = async (filters = {}) => {
  const res = await api.get('/reports/admin/payroll', { params: filters });
  return res.data?.data;
};

export const getAdminScheduleReport = async (filters = {}) => {
  const res = await api.get('/reports/admin/schedule', { params: filters });
  return res.data?.data;
};

// ── HOD Reports ───────────────────────────────────────────────────────────────

export const getHODAttendanceReport = async (filters = {}) => {
  const res = await api.get('/reports/hod/attendance', { params: filters });
  return res.data?.data;
};

export const getHODLeaveReport = async (filters = {}) => {
  const res = await api.get('/reports/hod/leave', { params: filters });
  return res.data?.data;
};

export const getHODScheduleReport = async (filters = {}) => {
  const res = await api.get('/reports/hod/schedule', { params: filters });
  return res.data?.data;
};

// ── Staff Personal Reports ────────────────────────────────────────────────────

export const getMyAttendanceReport = async (filters = {}) => {
  const res = await api.get('/reports/my/attendance', { params: filters });
  return res.data?.data;
};

export const getMyLeaveReport = async (filters = {}) => {
  const res = await api.get('/reports/my/leave', { params: filters });
  return res.data?.data;
};

export const getMyPayrollReport = async (filters = {}) => {
  const res = await api.get('/reports/my/payroll', { params: filters });
  return res.data?.data;
};
