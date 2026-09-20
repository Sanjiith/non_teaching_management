const { body, validationResult } = require('express-validator');
const { sendError } = require('../utils/responseHelper');

/**
 * Login validation rules
 */
const loginValidation = [
  body().custom((value, { req }) => {
    const identifier = req.body.employeeId || req.body.staffId || req.body.email;
    if (!identifier || (typeof identifier === 'string' && !identifier.trim())) {
      throw new Error('Employee ID, Staff ID, or Email is required');
    }
    return true;
  }),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', errors.array());
  }
  next();
};

module.exports = { loginValidation, handleValidationErrors };
