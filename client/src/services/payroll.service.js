import api from './api';

/**
 * Payroll API service — client-side wrappers
 */

/**
 * Preview payroll calculation (dry run — does not save)
 * @param {string} userId
 * @param {number} month
 * @param {number} year
 * @param {object} allowances
 * @param {object} deductions
 */
export const previewPayroll = async ({ userId, month, year, allowances = {}, deductions = {} }) => {
  const res = await api.post('/payroll/preview', { userId, month, year, allowances, deductions });
  return res.data?.data;
};

/**
 * Generate (save) payroll for one user or all staff
 * @param {object} params
 */
export const generatePayroll = async ({ userId, month, year, allowances = {}, deductions = {}, remarks = '' }) => {
  const res = await api.post('/payroll/generate', { userId, month, year, allowances, deductions, remarks });
  return res.data?.data;
};

/**
 * Get payroll list (Admin: all | HOD: dept | Staff: own)
 * @param {object} filters  { month, year, status, department, userId }
 */
export const getPayrollList = async (filters = {}) => {
  const res = await api.get('/payroll', { params: filters });
  return res.data?.data;
};

/**
 * Get logged-in staff member's own payrolls
 * @param {object} filters  { month, year }
 */
export const getMyPayroll = async (filters = {}) => {
  const res = await api.get('/payroll/my', { params: filters });
  return res.data?.data;
};

/**
 * Get a single payroll record with full breakdown
 * @param {string} payrollId
 */
export const getPayrollById = async (payrollId) => {
  const res = await api.get(`/payroll/${payrollId}`);
  return res.data?.data;
};

/**
 * Update payroll status
 * @param {string} payrollId
 * @param {string} status  'Draft' | 'Processed' | 'Paid'
 * @param {string} remarks
 */
export const updatePayrollStatus = async (payrollId, status, remarks = '') => {
  const res = await api.patch(`/payroll/${payrollId}/status`, { status, remarks });
  return res.data?.data;
};

/**
 * Get payroll summary statistics
 * @param {object} filters  { month, year }
 */
export const getPayrollStats = async (filters = {}) => {
  const res = await api.get('/payroll/stats', { params: filters });
  return res.data?.data;
};
