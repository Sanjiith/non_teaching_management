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
 * Convert HH:MM time string to minutes since midnight
 */
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
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

module.exports = {
  getAttendanceConfig,
  updateAttendanceConfig,
  parseTimeToMinutes,
  getZonedTimeParts,
  isWithinCheckInWindow,
  isBeforeCheckInWindow,
  hasCheckInWindowClosed,
  formatTime12Hour,
};
