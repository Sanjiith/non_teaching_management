import { ROLES, ROUTES } from '../config/constants';

/**
 * Get the default dashboard route for a given role
 */
export const getRoleDashboard = (role) => {
  switch (role) {
    case ROLES.ADMIN: return ROUTES.ADMIN_DASHBOARD;
    case ROLES.HOD:   return ROUTES.HOD_DASHBOARD;
    case ROLES.STAFF: return ROUTES.STAFF_DASHBOARD;
    default:          return ROUTES.LOGIN;
  }
};

/**
 * Check if a user has one of the allowed roles
 */
export const hasRole = (user, ...allowedRoles) => {
  if (!user) return false;
  return allowedRoles.includes(user.role);
};

/**
 * Get a human-readable label for a role
 */
export const getRoleLabel = (role) => {
  const labels = {
    [ROLES.ADMIN]: 'Administrator',
    [ROLES.HOD]:   'Head of Department',
    [ROLES.STAFF]: 'Non-Teaching Staff',
  };
  return labels[role] || role;
};

/**
 * Get initials from a full name
 */
export const getInitials = (name = '') => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
