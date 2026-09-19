const express = require('express');
const router = express.Router();

const { login, getMe, logout } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { loginValidation, handleValidationErrors } = require('../validators/auth.validator');

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
// @access  Public
router.post('/login', loginValidation, handleValidationErrors, login);

// @route   GET /api/auth/me
// @desc    Get currently authenticated user
// @access  Private
router.get('/me', protect, getMe);

// @route   POST /api/auth/logout
// @desc    Logout (client clears token; server logs event)
// @access  Private
router.post('/logout', protect, logout);

module.exports = router;
