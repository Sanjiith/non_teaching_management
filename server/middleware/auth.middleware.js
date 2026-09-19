const jwt = require('jsonwebtoken');
const User = require('../models/User.model');
const { sendError } = require('../utils/responseHelper');

/**
 * Protect routes — verifies JWT token and attaches req.user
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header first
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendError(res, 401, 'Not authorized. No token provided.');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user from DB (excluding password)
    const user = await User.findById(decoded.id).select('-password').populate('department', 'name code');

    if (!user) {
      return sendError(res, 401, 'Not authorized. User not found.');
    }

    if (!user.isActive) {
      return sendError(res, 403, 'Your account has been deactivated. Please contact admin.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return sendError(res, 401, 'Not authorized. Invalid token.');
    }
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Not authorized. Token expired. Please log in again.');
    }
    return sendError(res, 500, 'Authentication error.');
  }
};

module.exports = { protect };
