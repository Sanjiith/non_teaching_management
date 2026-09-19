const { sendError } = require('../utils/responseHelper');

/**
 * Role-based authorization middleware factory.
 * Usage: authorize('Admin', 'HOD')
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Not authenticated.');
    }

    if (!roles.includes(req.user.role)) {
      return sendError(
        res,
        403,
        `Access denied. Role '${req.user.role}' is not allowed to access this resource.`
      );
    }

    next();
  };
};

module.exports = { authorize };
