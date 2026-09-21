const { body, param, query, validationResult } = require('express-validator');
const { sendError } = require('../utils/responseHelper');

/**
 * Validates a number field is non-negative
 */
const isNonNegative = (field, label) =>
  body(field)
    .optional()
    .isFloat({ min: 0 })
    .withMessage(`${label} cannot be negative`);

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
    .isInt({ min: 2024, max: 2099 })
    .withMessage('Year must be between 2024 and 2099'),
  body().custom((value, { req }) => {
    const { month, year } = req.body;
    if (month && year) {
      const payrollDate = new Date(year, month - 1, 1);
      const now = new Date();
      const futureLimit = new Date(now.getFullYear(), now.getMonth() + 2, 1);
      if (payrollDate > futureLimit) {
        throw new Error('Cannot generate payroll for a future period more than 1 month ahead');
      }
    }
    return true;
  }),
  body('allowances')
    .optional()
    .isObject()
    .withMessage('Allowances must be an object'),
  body('allowances.*')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Each allowance value must be a non-negative number'),
  body('deductions')
    .optional()
    .isObject()
    .withMessage('Deductions must be an object'),
  body('deductions.*')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Each deduction value must be a non-negative number'),
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
    .isInt({ min: 2024, max: 2099 })
    .withMessage('Year must be between 2024 and 2099'),
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
