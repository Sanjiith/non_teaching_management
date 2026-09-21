const { body, validationResult } = require('express-validator');
const { sendError } = require('../utils/responseHelper');

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const createShiftValidation = [
  body('name')
    .notEmpty()
    .withMessage('Shift name is required')
    .trim(),
  body('startTime')
    .notEmpty()
    .withMessage('Start time is required')
    .matches(TIME_REGEX)
    .withMessage('Start time must be in HH:MM format (24-hour)'),
  body('endTime')
    .notEmpty()
    .withMessage('End time is required')
    .matches(TIME_REGEX)
    .withMessage('End time must be in HH:MM format (24-hour)'),
  body('workingHours')
    .optional()
    .isFloat({ min: 0, max: 24 })
    .withMessage('Working hours must be between 0 and 24'),
  body('department')
    .optional({ nullable: true })
    .custom((val) => {
      if (!val || val === '') return true;
      const mongoose = require('mongoose');
      return mongoose.Types.ObjectId.isValid(val);
    })
    .withMessage('Invalid department ID'),
  body('description')
    .optional()
    .trim(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const updateShiftValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Shift name cannot be empty'),
  body('startTime')
    .optional()
    .matches(TIME_REGEX)
    .withMessage('Start time must be in HH:MM format (24-hour)'),
  body('endTime')
    .optional()
    .matches(TIME_REGEX)
    .withMessage('End time must be in HH:MM format (24-hour)'),
  body('workingHours')
    .optional()
    .isFloat({ min: 0, max: 24 })
    .withMessage('Working hours must be between 0 and 24'),
  body('department')
    .optional({ nullable: true })
    .custom((val) => {
      if (!val || val === '') return true;
      const mongoose = require('mongoose');
      return mongoose.Types.ObjectId.isValid(val);
    })
    .withMessage('Invalid department ID'),
  body('description')
    .optional()
    .trim(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', errors.array());
  }
  next();
};

module.exports = {
  createShiftValidation,
  updateShiftValidation,
  handleValidationErrors,
};
