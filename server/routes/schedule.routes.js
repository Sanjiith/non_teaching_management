const express = require('express');
const router = express.Router();
const {
  assignSchedule,
  getMySchedule,
  getDepartmentSchedules,
  getAllSchedules,
  updateSchedule,
  deleteSchedule,
} = require('../controllers/schedule.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  assignScheduleValidation,
  updateScheduleValidation,
  handleValidationErrors,
} = require('../validators/schedule.validator');

// All schedule endpoints require authentication
router.use(protect);

// Staff personal schedule
router.get('/my', getMySchedule);

// HOD / Admin department schedules
router.get('/department', authorize('Admin', 'HOD'), getDepartmentSchedules);

// Admin global view of all schedules
router.get('/', authorize('Admin'), getAllSchedules);

// Assign schedule (Admin, HOD)
router.post(
  '/',
  authorize('Admin', 'HOD'),
  assignScheduleValidation,
  handleValidationErrors,
  assignSchedule
);

// Update schedule (Admin, HOD)
router.put(
  '/:id',
  authorize('Admin', 'HOD'),
  updateScheduleValidation,
  handleValidationErrors,
  updateSchedule
);

// Delete schedule (Admin, HOD)
router.delete('/:id', authorize('Admin', 'HOD'), deleteSchedule);

module.exports = router;
