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
  checkSubstituteRequirement,
  getEligibleSubstitutes,
  getMySubstituteRequests,
  respondToSubstituteRequest,
  reassignSubstitute,
} = require('../controllers/leave.controller');

const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  applyLeaveValidation,
  handleValidationErrors,
} = require('../validators/leave.validator');

// @route   GET /api/leaves/check-substitute-requirement
// @desc    Check if department leave limit requires substitute
// @access  Private
router.get('/check-substitute-requirement', protect, checkSubstituteRequirement);

// @route   GET /api/leaves/eligible-substitutes
// @desc    Get list of active eligible substitutes across departments
// @access  Private
router.get('/eligible-substitutes', protect, getEligibleSubstitutes);

// @route   GET /api/leaves/substitute-requests
// @desc    Get substitute requests received by logged-in staff
// @access  Private (Staff)
router.get('/substitute-requests', protect, getMySubstituteRequests);

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

// @route   PUT /api/leaves/:id/substitute-respond
// @desc    Accept or reject substitute request (Staff)
// @access  Private (Staff)
router.put('/:id/substitute-respond', protect, respondToSubstituteRequest);

// @route   PUT /api/leaves/:id/reassign-substitute
// @desc    Reassign a substitute if previous was rejected (Staff)
// @access  Private (Staff)
router.put('/:id/reassign-substitute', protect, reassignSubstitute);

module.exports = router;
