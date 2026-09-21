const { body, validationResult } = require('express-validator');
const { sendError } = require('../utils/responseHelper');
const { ROLES } = require('../models/User.model');

const allowedRoles = Object.values(ROLES);

const createUserValidation = [
  body().custom((value, { req }) => {
    const id = req.body.employeeId || req.body.staffId;
    if (!id || !id.toString().trim()) {
      throw new Error('Employee ID or Staff ID is required');
    }
    // Staff ID format: BIT-XXX-NNN
    const idStr = id.toString().trim().toUpperCase();
    if (!/^BIT-[A-Z]+-\d{3,}$/.test(idStr)) {
      throw new Error('Staff ID must follow the format BIT-ROLE-NNN (e.g. BIT-NTS-001)');
    }
    return true;
  }),
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .trim(),
  body('email')
    .isEmail()
    .withMessage('A valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(allowedRoles)
    .withMessage(`Role must be one of: ${allowedRoles.join(', ')}`),
  body('basicSalary')
    .optional()
    .isFloat({ min: 0, max: 40000 })
    .withMessage('Basic salary must be between ₹0 and ₹40,000'),
  body('phone')
    .optional()
    .trim(),
  body('designation')
    .optional()
    .trim(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean value'),
];

const updateUserValidation = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('A valid email is required')
    .normalizeEmail(),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(allowedRoles)
    .withMessage(`Role must be one of: ${allowedRoles.join(', ')}`),
  body('basicSalary')
    .optional()
    .isFloat({ min: 0, max: 40000 })
    .withMessage('Basic salary must be between ₹0 and ₹40,000'),
  body('phone')
    .optional()
    .trim(),
  body('designation')
    .optional()
    .trim(),
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
  createUserValidation,
  updateUserValidation,
  handleValidationErrors,
};
