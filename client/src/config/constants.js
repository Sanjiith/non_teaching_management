// Application-wide constants sourced from environment variables
// Never hardcode API URLs directly in components — always use these constants

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const APP_NAME = import.meta.env.VITE_APP_NAME || 'BIT Non-Teaching Staff Portal';

// User roles
export const ROLES = {
  ADMIN: 'Admin',
  HOD: 'HOD',
  STAFF: 'Staff',
};

// Local storage keys
export const STORAGE_KEYS = {
  TOKEN: 'bit_portal_token',
  USER: 'bit_portal_user',
};

// Route paths
export const ROUTES = {
  LOGIN: '/login',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_STAFF: '/admin/staff',
  ADMIN_DEPARTMENTS: '/admin/departments',
  ADMIN_LEAVE: '/admin/leave',
  ADMIN_ATTENDANCE: '/admin/attendance',
  ADMIN_PAYROLL: '/admin/payroll',
  ADMIN_SHIFTS: '/admin/shifts',
  HOD_DASHBOARD: '/hod/dashboard',
  HOD_STAFF: '/hod/staff',
  HOD_ATTENDANCE: '/hod/attendance',
  HOD_LEAVE: '/hod/leave',
  HOD_SCHEDULE: '/hod/schedule',
  STAFF_DASHBOARD: '/staff/dashboard',
  STAFF_PROFILE: '/staff/profile',
  STAFF_ATTENDANCE: '/staff/attendance',
  STAFF_LEAVE: '/staff/leave',
  STAFF_SCHEDULE: '/staff/schedule',
  STAFF_PAYROLL: '/staff/payroll',
};
