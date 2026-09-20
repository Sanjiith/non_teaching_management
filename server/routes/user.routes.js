const express = require('express');
const router = express.Router();

const {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require('../controllers/user.controller');

const { protect } = require('../middleware/auth.middleware');
const { authorize, userAccessGuard } = require('../middleware/role.middleware');
const {
  createUserValidation,
  updateUserValidation,
  handleValidationErrors,
} = require('../validators/user.validator');

// @route   GET /api/users
// @desc    Get all users (Admin gets all, HOD gets department users only)
// @access  Private (Admin, HOD)
router.get('/', protect, authorize('Admin', 'HOD'), getAllUsers);

// @route   GET /api/users/:id
// @desc    Get user by ID (Admin gets any, HOD gets dept staff, Staff gets self only)
// @access  Private
router.get('/:id', protect, userAccessGuard, getUserById);

// @route   POST /api/users
// @desc    Create new user
// @access  Private (Admin only)
router.post(
  '/',
  protect,
  authorize('Admin'),
  createUserValidation,
  handleValidationErrors,
  createUser
);

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin, HOD for dept staff, Staff for self profile)
router.put(
  '/:id',
  protect,
  userAccessGuard,
  updateUserValidation,
  handleValidationErrors,
  updateUser
);

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('Admin'), deleteUser);

module.exports = router;
