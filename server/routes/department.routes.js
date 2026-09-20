const express = require('express');
const router = express.Router();

const {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require('../controllers/department.controller');

const { protect } = require('../middleware/auth.middleware');
const { authorize, departmentAccessGuard } = require('../middleware/role.middleware');
const {
  createDepartmentValidation,
  updateDepartmentValidation,
  handleValidationErrors,
} = require('../validators/department.validator');

// @route   GET /api/departments
// @desc    Get all departments
// @access  Private
router.get('/', protect, getAllDepartments);

// @route   GET /api/departments/:id
// @desc    Get department by ID (Admin can get any; HOD/Staff guarded to own department)
// @access  Private
router.get('/:id', protect, departmentAccessGuard, getDepartmentById);

// @route   POST /api/departments
// @desc    Create new department
// @access  Private (Admin only)
router.post(
  '/',
  protect,
  authorize('Admin'),
  createDepartmentValidation,
  handleValidationErrors,
  createDepartment
);

// @route   PUT /api/departments/:id
// @desc    Update department
// @access  Private (Admin only)
router.put(
  '/:id',
  protect,
  authorize('Admin'),
  updateDepartmentValidation,
  handleValidationErrors,
  updateDepartment
);

// @route   DELETE /api/departments/:id
// @desc    Delete department
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('Admin'), deleteDepartment);

module.exports = router;
