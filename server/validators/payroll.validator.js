const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');
const { sendError } = require('../utils/responseHelper');

/**
 * Validation rules for generating payroll
 */
const generatePayrollValidation = [
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('userId must be a valid MongoDB ID'),
  body('month')
    .notEmpty()
    .withMessage('Month is required')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  body('year')
    .notEmpty()
    .withMessage('Year is required')
    .isInt({ min: 2024 })
    .withMessage('Year must be 2024 or later'),
  body('allowances')
    .optional()
    .isObject()
    .withMessage('Allowances must be an object'),
  body('deductions')
    .optional()
    .isObject()
    .withMessage('Deductions must be an object'),
];

/**
 * Validation rules for previewing payroll (dry run)
 */
const previewPayrollValidation = [
  body('userId')
    .notEmpty()
    .withMessage('userId is required for preview')
    .isMongoId()
    .withMessage('userId must be a valid MongoDB ID'),
  body('month')
    .notEmpty()
    .withMessage('Month is required')
    .isInt({ min: 1, max: 12 })
    .withMessage('Month must be between 1 and 12'),
  body('year')
    .notEmpty()
    .withMessage('Year is required')
    .isInt({ min: 2024 })
    .withMessage('Year must be 2024 or later'),
];

/**
 * Validation rules for updating payroll status
 */
const updateStatusValidation = [
  param('id')
    .isMongoId()
    .withMessage('Payroll ID must be a valid MongoDB ID'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['Draft', 'Processed', 'Paid'])
    .withMessage("Status must be one of: 'Draft', 'Processed', 'Paid'"),
];

/**
 * Middleware to catch and return validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', errors.array());
  }
  next();
};

module.exports = {
  generatePayrollValidation,
  previewPayrollValidation,
  updateStatusValidation,
  handleValidationErrors,
};
