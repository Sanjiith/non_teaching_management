const { loginUser } = require('../services/auth.service');
const { sendSuccess, sendError } = require('../utils/responseHelper');

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { employeeId, staffId, email, password } = req.body;
    const identifier = employeeId || staffId || email;
    const { user, token } = await loginUser(identifier, password);

    return sendSuccess(res, 200, 'Login successful', { user, token });
  } catch (error) {
    return sendError(res, 401, error.message);
  }
};

/**
 * @desc    Get current authenticated user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    return sendSuccess(res, 200, 'User fetched successfully', { user: req.user });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Logout user (client-side token removal; endpoint for audit log)
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    return sendSuccess(res, 200, 'Logged out successfully');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = { login, getMe, logout };
