const express = require('express');
const router = express.Router();

const {
  adminAttendanceReport,
  adminLeaveReport,
  adminPayrollReport,
  adminScheduleReport,
  hodAttendanceReport,
  hodLeaveReport,
  hodScheduleReport,
  myAttendanceReport,
  myLeaveReport,
  myPayrollReport,
} = require('../controllers/report.controller');

const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

// All report routes require authentication
router.use(protect);

// ── Admin Reports ────────────────────────────────────────────────────────────
router.get('/admin/attendance', authorize('Admin'), adminAttendanceReport);
router.get('/admin/leave',      authorize('Admin'), adminLeaveReport);
router.get('/admin/payroll',    authorize('Admin'), adminPayrollReport);
router.get('/admin/schedule',   authorize('Admin'), adminScheduleReport);

// ── HOD Reports ──────────────────────────────────────────────────────────────
router.get('/hod/attendance', authorize('Admin', 'HOD'), hodAttendanceReport);
router.get('/hod/leave',      authorize('Admin', 'HOD'), hodLeaveReport);
router.get('/hod/schedule',   authorize('Admin', 'HOD'), hodScheduleReport);

// ── Staff Personal Reports ───────────────────────────────────────────────────
router.get('/my/attendance', myAttendanceReport);
router.get('/my/leave',      myLeaveReport);
router.get('/my/payroll',    myPayrollReport);

module.exports = router;
