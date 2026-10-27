const express = require('express');
const router = express.Router();

const {
  getMyAttendance,
  getDepartmentAttendance,
  getAllAttendance,
  getStaffAttendance,
  markOrCorrectAttendance,
  getAttendanceStats,
  checkIn,
  getTodayAttendance,
  getDailyStaffAttendance,
  getAttendanceConfigEndpoint,
  updateAttendanceConfigEndpoint,
} = require('../controllers/attendance.controller');

const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  markAttendanceValidation,
  handleValidationErrors,
} = require('../validators/attendance.validator');

// @route   POST /api/attendance/check-in
// @desc    Staff Check-In (Biometric alternative)
// @access  Private (Staff, Non-Teaching Staff, HOD)
router.post('/check-in', protect, checkIn);

// @route   GET /api/attendance/today
// @desc    Get current user's today attendance status & check-in time
// @access  Private
router.get('/today', protect, getTodayAttendance);

// @route   GET /api/attendance/daily-staff
// @desc    Get daily attendance for non-teaching staff (HOD: own dept, Admin: all depts)
// @access  Private (HOD, Admin)
router.get('/daily-staff', protect, authorize('HOD', 'Admin'), getDailyStaffAttendance);

// @route   GET /api/attendance/config
// @desc    Get attendance configuration (check-in window, timezone)
// @access  Private
router.get('/config', protect, getAttendanceConfigEndpoint);

// @route   PUT /api/attendance/config
// @desc    Update attendance configuration
// @access  Private (Admin)
router.put('/config', protect, authorize('Admin'), updateAttendanceConfigEndpoint);

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
