/**
 * Attendance Configuration Module
 * Manages configurable attendance rules, check-in time windows, and timezone conversions.
 */

// Default configuration settings (can be overridden via environment variables or runtime Admin updates)
let config = {
  checkInStartTime: process.env.ATTENDANCE_CHECKIN_START || '08:00',
  checkInEndTime: process.env.ATTENDANCE_CHECKIN_END || '11:00',
  timeZone: process.env.ATTENDANCE_TIMEZONE || 'Asia/Kolkata',
  autoMarkAbsentAfterWindow: true,
};

/**
 * Get current attendance configuration
 */
const getAttendanceConfig = () => ({ ...config });

/**
 * Update attendance configuration at runtime (Admin only)
 */
const updateAttendanceConfig = (newConfig = {}) => {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

  if (newConfig.checkInStartTime !== undefined) {
    if (!timeRegex.test(newConfig.checkInStartTime)) {
      throw new Error('checkInStartTime must be in HH:MM (24-hour) format (e.g., "08:00")');
    }
    config.checkInStartTime = newConfig.checkInStartTime;
  }

  if (newConfig.checkInEndTime !== undefined) {
    if (!timeRegex.test(newConfig.checkInEndTime)) {
      throw new Error('checkInEndTime must be in HH:MM (24-hour) format (e.g., "11:00")');
    }
    config.checkInEndTime = newConfig.checkInEndTime;
  }

  if (newConfig.timeZone !== undefined && typeof newConfig.timeZone === 'string') {
    try {
      // Validate timezone identifier
      Intl.DateTimeFormat(undefined, { timeZone: newConfig.timeZone });
      config.timeZone = newConfig.timeZone;
    } catch {
      throw new Error(`Invalid timeZone identifier: ${newConfig.timeZone}`);
    }
  }

  if (newConfig.autoMarkAbsentAfterWindow !== undefined) {
    config.autoMarkAbsentAfterWindow = Boolean(newConfig.autoMarkAbsentAfterWindow);
  }

  return { ...config };
};

/**
 * Convert time string ("09:00 AM", "2:00 PM", "14:00", "08:30") to minutes since midnight
 */
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
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

/**
 * Extract zoned time parts for a given Date in the configured timeZone
 */
const getZonedTimeParts = (date = new Date(), timeZone = config.timeZone) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type) => parts.find((p) => p.type === type)?.value;

  const year = parseInt(getPart('year'), 10);
  const month = parseInt(getPart('month'), 10);
  const day = parseInt(getPart('day'), 10);
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);
  const second = parseInt(getPart('second'), 10);

  const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const minutesSinceMidnight = hour * 60 + minute;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    timeString,
    minutesSinceMidnight,
  };
};

/**
 * Check if the given date/time is currently within the permitted check-in window
 */
const isWithinCheckInWindow = (date = new Date()) => {
  const parts = getZonedTimeParts(date);
  const currentMinutes = parts.minutesSinceMidnight;
  const startMinutes = parseTimeToMinutes(config.checkInStartTime);
  const endMinutes = parseTimeToMinutes(config.checkInEndTime);

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
};

/**
 * Check if current time is strictly before the check-in window starts
 */
const isBeforeCheckInWindow = (date = new Date()) => {
  const parts = getZonedTimeParts(date);
  const currentMinutes = parts.minutesSinceMidnight;
  const startMinutes = parseTimeToMinutes(config.checkInStartTime);

  return currentMinutes < startMinutes;
};

/**
 * Check if check-in window has closed for the given date/time
 */
const hasCheckInWindowClosed = (date = new Date()) => {
  const parts = getZonedTimeParts(date);
  const currentMinutes = parts.minutesSinceMidnight;
  const endMinutes = parseTimeToMinutes(config.checkInEndTime);

  return currentMinutes > endMinutes;
};

/**
 * Format date/time to a user-friendly string in 12-hour format (e.g., "09:15 AM")
 */
const formatTime12Hour = (date, timeZone = config.timeZone) => {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
};

/**
 * Checks whether an approved leave covers a given date and time.
 * Evaluates:
 * 1. Leave status must be 'Approved'. Pending, Rejected, or Cancelled returns false.
 * 2. Date range: checkDate must fall within [fromDate, toDate] inclusive.
 * 3. Time window:
 *    - On start date, if startTime is specified, checkDateTime must be >= startTime.
 *    - On end date, if endTime is specified, checkDateTime must be <= endTime.
 *    - For full-day leaves (totalDays >= 1 or standard workday), the leave covers the working day.
 *
 * @param {Object} leave - Leave document
 * @param {Date} checkDateTime - Current Date/Time (default: new Date())
 * @param {string} timeZone - TimeZone string (default: config.timeZone)
 * @returns {boolean} true if leave covers checkDateTime
 */
const isLeaveCoveringDateTime = (leave, checkDateTime = new Date(), timeZone = config.timeZone) => {
  if (!leave || leave.status !== 'Approved') {
    return false;
  }

  const checkDateUTC = new Date(Date.UTC(
    checkDateTime.getUTCFullYear(),
    checkDateTime.getUTCMonth(),
    checkDateTime.getUTCDate(),
    0, 0, 0, 0
  ));

  const fromDateUTC = new Date(Date.UTC(
    new Date(leave.fromDate).getUTCFullYear(),
    new Date(leave.fromDate).getUTCMonth(),
    new Date(leave.fromDate).getUTCDate(),
    0, 0, 0, 0
  ));

  const toDateUTC = new Date(Date.UTC(
    new Date(leave.toDate).getUTCFullYear(),
    new Date(leave.toDate).getUTCMonth(),
    new Date(leave.toDate).getUTCDate(),
    0, 0, 0, 0
  ));

  // 1. If check date is strictly outside [fromDate, toDate], it does NOT cover current date
  if (checkDateUTC < fromDateUTC || checkDateUTC > toDateUTC) {
    return false;
  }

  const parts = getZonedTimeParts(checkDateTime, timeZone);
  const currentMinutes = parts.minutesSinceMidnight;

  const startMinutes = parseTimeToMinutes(leave.startTime);
  const endMinutes = parseTimeToMinutes(leave.endTime);

  // 2. Middle days of a multi-day leave are always fully covered
  if (checkDateUTC > fromDateUTC && checkDateUTC < toDateUTC) {
    return true;
  }

  const isStartDay = checkDateUTC.getTime() === fromDateUTC.getTime();
  const isEndDay = checkDateUTC.getTime() === toDateUTC.getTime();

  // 3. For full day leaves (totalDays >= 1) where start time is standard workday start (<= 9:30 AM):
  // It covers the entire workday including morning check-in window
  const isFullDayOrMultiDay = (leave.totalDays >= 1) || (fromDateUTC.getTime() !== toDateUTC.getTime());
  if (isFullDayOrMultiDay && (startMinutes === null || startMinutes <= 570) && (endMinutes === null || endMinutes >= 1020)) {
    return true;
  }

  // 4. Same-day leave
  if (isStartDay && isEndDay) {
    if (startMinutes !== null && endMinutes !== null) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }
    if (startMinutes !== null) {
      return currentMinutes >= startMinutes;
    }
    if (endMinutes !== null) {
      return currentMinutes <= endMinutes;
    }
    return true;
  }

  // 5. Start day of multi-day leave
  if (isStartDay) {
    if (startMinutes !== null) {
      return currentMinutes >= startMinutes;
    }
    return true;
  }

  // 6. End day of multi-day leave
  if (isEndDay) {
    if (endMinutes !== null) {
      return currentMinutes <= endMinutes;
    }
    return true;
  }

  return true;
};

module.exports = {
  getAttendanceConfig,
  updateAttendanceConfig,
  parseTimeToMinutes,
  getZonedTimeParts,
  isWithinCheckInWindow,
  isBeforeCheckInWindow,
  hasCheckInWindowClosed,
  formatTime12Hour,
  isLeaveCoveringDateTime,
};
