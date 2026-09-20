const User = require('../models/User.model');
const { sendError } = require('../utils/responseHelper');

/**
 * Normalizes roles so 'Staff' and 'Non-Teaching Staff' are treated equivalently.
 */
const normalizeRole = (role) => {
  if (!role) return '';
  if (role === 'Non-Teaching Staff' || role === 'Staff') return 'Staff';
  return role;
};

/**
 * Role-based authorization middleware factory.
 * Usage: authorize('Admin', 'HOD')
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  const normalizedAllowed = roles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Not authenticated.');
    }

    const userRole = normalizeRole(req.user.role);
    if (!normalizedAllowed.includes(userRole)) {
      return sendError(
        res,
        403,
        `Access denied. Role '${req.user.role}' is not authorized to access this resource.`
      );
    }

    next();
  };
};

/**
 * Department isolation guard for HOD and Staff.
 * Admin has full access to all departments.
 * HOD can only access their own department.
 * Staff can only access their own department.
 */
const departmentAccessGuard = (req, res, next) => {
  if (!req.user) {
    return sendError(res, 401, 'Not authenticated.');
  }

  const userRole = normalizeRole(req.user.role);
  if (userRole === 'Admin') {
    return next();
  }

  const targetDeptId = req.params.departmentId || req.params.id;
  const userDeptId = req.user.department?._id?.toString() || req.user.department?.toString();

  if (userRole === 'HOD') {
    if (!userDeptId || userDeptId !== targetDeptId) {
      return sendError(
        res,
        403,
        'Access denied. HOD cannot access another department.'
      );
    }
    return next();
  }

  if (userRole === 'Staff') {
    if (!userDeptId || userDeptId !== targetDeptId) {
      return sendError(
        res,
        403,
        'Access denied. Staff cannot access another department.'
      );
    }
    return next();
  }

  return sendError(res, 403, 'Access denied.');
};

/**
 * User data privacy guard:
 * Admin: Can access any user data.
 * HOD: Can access staff data within their own department.
 * Staff: Can ONLY access their own user data.
 */
const userAccessGuard = async (req, res, next) => {
  if (!req.user) {
    return sendError(res, 401, 'Not authenticated.');
  }

  const userRole = normalizeRole(req.user.role);
  const targetUserId = req.params.id;

  // Admin has full access
  if (userRole === 'Admin') {
    return next();
  }

  // Staff can only access their own data
  if (userRole === 'Staff') {
    if (req.user._id.toString() !== targetUserId) {
      return sendError(
        res,
        403,
        "Access denied. Staff cannot access another staff member's private data."
      );
    }
    return next();
  }

  // HOD can access their own data or data of staff in their department
  if (userRole === 'HOD') {
    if (req.user._id.toString() === targetUserId) {
      return next();
    }

    // Check if target user belongs to HOD's department
    const targetUser = await User.findById(targetUserId).select('department role');
    if (!targetUser) {
      return sendError(res, 404, 'User not found.');
    }

    const hodDeptId = req.user.department?._id?.toString() || req.user.department?.toString();
    const targetDeptId = targetUser.department?._id?.toString() || targetUser.department?.toString();

    if (!hodDeptId || hodDeptId !== targetDeptId) {
      return sendError(
        res,
        403,
        'Access denied. HOD cannot access data of users in another department.'
      );
    }

    // HOD cannot manage or view other HODs or Admins outside department scope
    req.targetUser = targetUser;
    return next();
  }

  return sendError(res, 403, 'Access denied.');
};

module.exports = {
  normalizeRole,
  authorize,
  departmentAccessGuard,
  userAccessGuard,
};

