const express = require('express');
const router = express.Router();

const {
  previewPayroll,
  generatePayroll,
  getPayrollList,
  getMyPayroll,
  getPayrollById,
  updatePayrollStatus,
  getPayrollStats,
} = require('../controllers/payroll.controller');

const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  generatePayrollValidation,
  previewPayrollValidation,
  updateStatusValidation,
  handleValidationErrors,
} = require('../validators/payroll.validator');

// @route   GET /api/payroll/stats
// @desc    Get payroll summary KPIs
// @access  Private (Admin, HOD)
router.get('/stats', protect, authorize('Admin', 'HOD'), getPayrollStats);

// @route   GET /api/payroll/my
// @desc    Get logged-in staff member's own payroll records
// @access  Private (All authenticated)
router.get('/my', protect, getMyPayroll);

// @route   POST /api/payroll/preview
// @desc    Preview payroll calculation (dry run — does not save)
// @access  Private (Admin)
router.post(
  '/preview',
  protect,
  authorize('Admin'),
  previewPayrollValidation,
  handleValidationErrors,
  previewPayroll
);

// @route   POST /api/payroll/generate
// @desc    Generate and save payroll for one user or all staff
// @access  Private (Admin)
router.post(
  '/generate',
  protect,
  authorize('Admin'),
  generatePayrollValidation,
  handleValidationErrors,
  generatePayroll
);

// @route   GET /api/payroll
// @desc    List payroll records (Admin: all, HOD: dept, Staff: own)
// @access  Private
router.get('/', protect, getPayrollList);

// @route   PATCH /api/payroll/:id/status
// @desc    Update payroll status (Draft → Processed → Paid)
// @access  Private (Admin)
router.patch(
  '/:id/status',
  protect,
  authorize('Admin'),
  updateStatusValidation,
  handleValidationErrors,
  updatePayrollStatus
);

// @route   GET /api/payroll/:id
// @desc    Get single payroll record with full breakdown
// @access  Private (Admin: any, HOD: dept, Staff: own)
router.get('/:id', protect, getPayrollById);

module.exports = router;
