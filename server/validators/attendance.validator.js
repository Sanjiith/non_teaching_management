const { body, query, validationResult } = require('express-validator');
const { sendError } = require('../utils/responseHelper');

const ALLOWED_STATUSES = ['Present', 'Absent', 'Leave', 'Holiday', 'Weekly Off', 'On-Leave'];

const markAttendanceValidation = [
  body('date')
    .notEmpty()
    .withMessage('Attendance date is required')
    .isISO8601()
    .withMessage('Date must be a valid ISO8601 date string (e.g. YYYY-MM-DD)'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
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
  markAttendanceValidation,
  handleValidationErrors,
};
