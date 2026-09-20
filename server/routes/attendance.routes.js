const express = require('express');
const router = express.Router();

const {
  getMyAttendance,
  getDepartmentAttendance,
  getAllAttendance,
  getStaffAttendance,
  markOrCorrectAttendance,
  getAttendanceStats,
} = require('../controllers/attendance.controller');

const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  markAttendanceValidation,
  handleValidationErrors,
} = require('../validators/attendance.validator');

// @route   GET /api/attendance/my
// @desc    Get current user's attendance records and statistics
// @access  Private (Staff)
router.get('/my', protect, getMyAttendance);

// @route   GET /api/attendance/department
// @desc    Get attendance for all staff in HOD's department
// @access  Private (HOD, Admin)
router.get('/department', protect, authorize('HOD', 'Admin'), getDepartmentAttendance);

// @route   GET /api/attendance/stats
// @desc    Get today's summary stats for dashboard KPIs
// @access  Private
router.get('/stats', protect, getAttendanceStats);

// @route   GET /api/attendance/user/:userId
// @desc    Get attendance for a specific staff member
// @access  Private (Admin: all, HOD: dept staff, Staff: self only)
router.get('/user/:userId', protect, getStaffAttendance);

// @route   GET /api/attendance
// @desc    Get all attendance (Admin views all, HOD routed to department)
// @access  Private (Admin, HOD)
router.get('/', protect, authorize('Admin', 'HOD'), getAllAttendance);

// @route   POST /api/attendance/mark (or POST /api/attendance)
// @desc    Mark attendance record (Admin, HOD for dept staff)
// @access  Private (Admin, HOD)
router.post(
  '/mark',
  protect,
  authorize('Admin', 'HOD'),
  markAttendanceValidation,
  handleValidationErrors,
  markOrCorrectAttendance
);

router.post(
  '/',
  protect,
  authorize('Admin', 'HOD'),
  markAttendanceValidation,
  handleValidationErrors,
  markOrCorrectAttendance
);

// @route   PUT /api/attendance/:id
// @desc    Correct attendance record (Admin, HOD for dept staff)
// @access  Private (Admin, HOD)
router.put(
  '/:id',
  protect,
  authorize('Admin', 'HOD'),
  markOrCorrectAttendance
);

module.exports = router;
