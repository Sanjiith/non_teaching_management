const express = require('express');
const router = express.Router();
const {
  createShift,
  getAllShifts,
  getShiftById,
  updateShift,
  deleteShift,
} = require('../controllers/shift.controller');
const { protect } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');
const {
  createShiftValidation,
  updateShiftValidation,
  handleValidationErrors,
} = require('../validators/shift.validator');

// All shift endpoints require authentication
router.use(protect);

router.get('/', getAllShifts);
router.get('/:id', getShiftById);

// Admin-only endpoints for shift template management
router.post(
  '/',
  authorize('Admin'),
  createShiftValidation,
  handleValidationErrors,
  createShift
);

router.put(
  '/:id',
  authorize('Admin'),
  updateShiftValidation,
  handleValidationErrors,
  updateShift
);

router.delete('/:id', authorize('Admin'), deleteShift);

module.exports = router;
