const { body, validationResult } = require('express-validator');
const { sendError } = require('../utils/responseHelper');
const { LEAVE_TYPES } = require('../models/Leave.model');

const applyLeaveValidation = [
  body().custom((value, { req }) => {
    const leaveType = req.body.type || req.body.leaveType;
    if (!leaveType || !LEAVE_TYPES.includes(leaveType)) {
      throw new Error(`Valid leave type is required: ${LEAVE_TYPES.join(', ')}`);
    }
    return true;
  }),
  body().custom((value, { req }) => {
    const start = req.body.startDate || req.body.fromDate;
    if (!start || isNaN(Date.parse(start))) {
      throw new Error('Valid start date is required');
    }
    return true;
  }),
  body().custom((value, { req }) => {
    const end = req.body.endDate || req.body.toDate;
    if (!end || isNaN(Date.parse(end))) {
      throw new Error('Valid end date is required');
    }
    return true;
  }),
  body('reason')
    .notEmpty()
    .withMessage('Reason for leave is required')
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
  applyLeaveValidation,
  handleValidationErrors,
};
