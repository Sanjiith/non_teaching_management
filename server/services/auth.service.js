const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

/**
 * Generate JWT token for a user
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Login service — validates credentials and returns user + token
 */
const loginUser = async (employeeId, password) => {
  // Find user by employeeId and include password for comparison
  const user = await User.findOne({ employeeId: employeeId.toUpperCase() })
    .select('+password')
    .populate('department', 'name code');

  if (!user) {
    throw new Error('Invalid Employee ID or password.');
  }

  if (!user.isActive) {
    throw new Error('Your account has been deactivated. Please contact admin.');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new Error('Invalid Employee ID or password.');
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const token = generateToken(user._id);

  return { user: user.toJSON(), token };
};

module.exports = { generateToken, loginUser };
