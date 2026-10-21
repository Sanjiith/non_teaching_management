const { body, validationResult } = require('express-validator');
const { sendError } = require('../utils/responseHelper');
const { LEAVE_TYPES } = require('../models/Leave.model');

/**
 * Parses a time string like "09:00 AM" / "2:00 PM" / "14:00" into minutes since midnight.
 * Returns null if the format is unrecognisable.
 */
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const trimmed = timeStr.trim().toUpperCase();

  // Match "H:MM AM/PM" or "HH:MM AM/PM"
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3];
    if (period === 'AM') {
      if (hours === 12) hours = 0;
    } else {
      if (hours !== 12) hours += 12;
    }
    return hours * 60 + minutes;
  }

  // Match "HH:MM" (24-hour)
  const h24Match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hours = parseInt(h24Match[1], 10);
    const minutes = parseInt(h24Match[2], 10);
    return hours * 60 + minutes;
  }

  return null;
};

const applyLeaveValidation = [
  // 1. Leave type
  body().custom((value, { req }) => {
    const leaveType = req.body.type || req.body.leaveType;
    if (!leaveType || !LEAVE_TYPES.includes(leaveType)) {
      throw new Error(`Valid leave type is required: ${LEAVE_TYPES.join(', ')}`);
    }
    return true;
  }),

  // 2. Start date — must be valid and not in the past
  body().custom((value, { req }) => {
    const start = req.body.startDate || req.body.fromDate;
    if (!start || isNaN(Date.parse(start))) {
      throw new Error('Valid start date is required');
    }

    // Compare calendar dates only (ignore time-of-day)
    const startParts = new Date(start);
    const startDay = new Date(
      Date.UTC(startParts.getUTCFullYear(), startParts.getUTCMonth(), startParts.getUTCDate())
    );
    const nowUTC = new Date();
    const todayUTC = new Date(
      Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate())
    );

    if (startDay < todayUTC) {
      throw new Error('Start date cannot be in the past');
    }
    return true;
  }),

  // 3. End date — must be valid
  body().custom((value, { req }) => {
    const end = req.body.endDate || req.body.toDate;
    if (!end || isNaN(Date.parse(end))) {
      throw new Error('Valid end date is required');
    }
    return true;
  }),

  // 4. End date must not be before start date
  body().custom((value, { req }) => {
    const start = req.body.startDate || req.body.fromDate;
    const end = req.body.endDate || req.body.toDate;
    if (start && end && Date.parse(end) < Date.parse(start)) {
      throw new Error('End date cannot be before start date');
    }
    return true;
  }),

  // 5. For same-day leave: startTime must be strictly before endTime
  body().custom((value, { req }) => {
    const start = req.body.startDate || req.body.fromDate;
    const end = req.body.endDate || req.body.toDate;
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;

    if (!start || !end) return true;

    const startDay = new Date(start);
    const endDay = new Date(end);

    // Only validate times when it is a same-day leave
    const isSameDay =
      startDay.getUTCFullYear() === endDay.getUTCFullYear() &&
      startDay.getUTCMonth() === endDay.getUTCMonth() &&
      startDay.getUTCDate() === endDay.getUTCDate();

    if (!isSameDay) return true;

    if (!startTime || !endTime) {
      throw new Error('Start time and end time are required for same-day leave');
    }

    const startMins = parseTimeToMinutes(startTime);
    const endMins = parseTimeToMinutes(endTime);

    if (startMins === null || endMins === null) {
      throw new Error('Invalid time format. Use HH:MM AM/PM (e.g. 09:00 AM)');
    }

    if (startMins >= endMins) {
      throw new Error('For same-day leave, start time must be before end time');
    }

    return true;
  }),

  // 6. Reason
  body('reason')
    .notEmpty()
    .withMessage('Reason for leave is required')
    .trim()
    .isLength({ min: 5 })
    .withMessage('Reason must be at least 5 characters'),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, errors.array()[0].msg, errors.array());
  }
  next();
};

module.exports = {
  applyLeaveValidation,
  handleValidationErrors,
  parseTimeToMinutes,
};
