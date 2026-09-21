const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { sendError } = require('../utils/responseHelper');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ALLOWED_STATUSES = ['Scheduled', 'Completed', 'Cancelled', 'On Leave', 'Conflict'];

const assignScheduleValidation = [
  body('staff')
    .notEmpty()
    .withMessage('Staff ID is required')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid Staff ID format'),
  body('shift')
    .notEmpty()
    .withMessage('Shift ID is required')
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid Shift ID format'),
  body('date')
    .notEmpty()
    .withMessage('Date is required')
    .isISO8601()
    .withMessage('Date must be a valid ISO8601 date string (e.g. YYYY-MM-DD)'),
  body('startTime')
    .optional()
    .matches(TIME_REGEX)
    .withMessage('Start time must be in HH:MM format (24-hour)'),
  body('endTime')
    .optional()
    .matches(TIME_REGEX)
    .withMessage('End time must be in HH:MM format (24-hour)'),
  body('remarks')
    .optional()
    .trim(),
];

const updateScheduleValidation = [
  body('shift')
    .optional()
    .custom((val) => mongoose.Types.ObjectId.isValid(val))
    .withMessage('Invalid Shift ID format'),
  body('startTime')
    .optional()
    .matches(TIME_REGEX)
    .withMessage('Start time must be in HH:MM format (24-hour)'),
  body('endTime')
    .optional()
    .matches(TIME_REGEX)
    .withMessage('End time must be in HH:MM format (24-hour)'),
  body('status')
    .optional()
    .isIn(ALLOWED_STATUSES)
    .withMessage(`Status must be one of: ${ALLOWED_STATUSES.join(', ')}`),
  body('remarks')
    .optional()
    .trim(),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', errors.array());
  }
  next();
};

module.exports = {
  assignScheduleValidation,
  updateScheduleValidation,
  handleValidationErrors,
};
