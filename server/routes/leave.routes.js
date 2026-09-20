const express = require('express');
const router = express.Router();

const {
  applyLeave,
  getMyLeaves,
  getDepartmentLeaves,
  getAllLeaves,
  approveLeave,
  rejectLeave,
  cancelLeave,
} = require('../controllers/leave.controller');

const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  applyLeaveValidation,
  handleValidationErrors,
} = require('../validators/leave.validator');

// @route   POST /api/leaves
// @desc    Apply for leave (Staff)
// @access  Private (Staff, Admin, HOD)
router.post('/', protect, applyLeaveValidation, handleValidationErrors, applyLeave);

// @route   GET /api/leaves/my
// @desc    Get current staff member's leaves & balances
// @access  Private (Staff)
router.get('/my', protect, getMyLeaves);

// @route   GET /api/leaves/department
// @desc    Get department leave requests (HOD, Admin)
// @access  Private (HOD, Admin)
router.get('/department', protect, authorize('HOD', 'Admin'), getDepartmentLeaves);

// @route   GET /api/leaves
// @desc    Get all leave requests (Admin, HOD for dept)
// @access  Private (Admin, HOD)
router.get('/', protect, authorize('Admin', 'HOD'), getAllLeaves);

// @route   PUT /api/leaves/:id/approve
// @desc    Approve leave request (HOD for dept, Admin)
// @access  Private (HOD, Admin)
router.put('/:id/approve', protect, authorize('HOD', 'Admin'), approveLeave);

// @route   PUT /api/leaves/:id/reject
// @desc    Reject leave request (HOD for dept, Admin)
// @access  Private (HOD, Admin)
router.put('/:id/reject', protect, authorize('HOD', 'Admin'), rejectLeave);

// @route   PUT /api/leaves/:id/cancel
// @desc    Cancel leave request (Staff)
// @access  Private
router.put('/:id/cancel', protect, cancelLeave);

module.exports = router;
