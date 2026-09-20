const jwt = require('jsonwebtoken');
const User = require('../models/User.model');

/**
 * Generate JWT token for a user
 */
const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Login service — validates credentials and returns user + token
 * Supports login via employeeId, staffId, or email.
 */
const loginUser = async (identifier, password) => {
  if (!identifier || !password) {
    throw new Error('Please provide login credentials.');
  }

  const queryIdentifier = identifier.trim();
  const upperIdentifier = queryIdentifier.toUpperCase();
  const lowerIdentifier = queryIdentifier.toLowerCase();

  // Find user by employeeId, staffId, or email
  const user = await User.findOne({
    $or: [
      { employeeId: upperIdentifier },
      { staffId: upperIdentifier },
      { email: lowerIdentifier },
    ],
  })
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

  const token = generateToken(user._id, user.role);

  return { user: user.toJSON(), token };
};

module.exports = { generateToken, loginUser };

