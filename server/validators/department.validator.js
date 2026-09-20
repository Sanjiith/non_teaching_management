const { body, validationResult } = require('express-validator');
const { sendError } = require('../utils/responseHelper');

const createDepartmentValidation = [
  body('name')
    .notEmpty()
    .withMessage('Department name is required')
    .trim(),
  body('code')
    .notEmpty()
    .withMessage('Department code is required')
    .trim()
    .toUpperCase(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
];

const updateDepartmentValidation = [
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Department name cannot be empty')
    .trim(),
  body('code')
    .optional()
    .notEmpty()
    .withMessage('Department code cannot be empty')
    .trim()
    .toUpperCase(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', errors.array());
  }
  next();
};

module.exports = {
  createDepartmentValidation,
  updateDepartmentValidation,
  handleValidationErrors,
};
