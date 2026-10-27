/**
 * Absence Processor Service
 * Autonomous scheduled job and backend service that runs reliably after the 11:00 AM check-in deadline.
 * Marks staff members who have not checked in and have no approved leave as 'Absent' ('Uninformed Absence').
 */

const { getAttendanceConfig, hasCheckInWindowClosed, getZonedTimeParts } = require('../config/attendance.config');
const { markAbsenteesForDate } = require('../controllers/attendance.controller');

let timerId = null;
let lastProcessedDateString = null;
let isProcessing = false;

/**
 * Runs the absence check for the current date if the check-in window has closed.
 * Idempotent: can run repeatedly without duplicating records.
 */
const runAbsenceCheck = async (force = false) => {
  if (isProcessing) return { skipped: true, reason: 'Already processing' };

  try {
    isProcessing = true;
    const now = new Date();
    const config = getAttendanceConfig();
    const zoned = getZonedTimeParts(now, config.timeZone);
    const currentDateString = `${zoned.year}-${String(zoned.month).padStart(2, '0')}-${String(zoned.day).padStart(2, '0')}`;

    const windowClosed = hasCheckInWindowClosed(now);

    // If window hasn't closed yet and not forced, skip
    if (!windowClosed && !force) {
      return {
        skipped: true,
        reason: `Check-in window is still open until ${config.checkInEndTime} (${config.timeZone})`,
        windowClosed: false,
      };
    }

    // If already processed for today and not forced, skip
    if (lastProcessedDateString === currentDateString && !force) {
      return {
        skipped: true,
        reason: `Absentees for ${currentDateString} have already been processed`,
        alreadyProcessed: true,
      };
    }

    // Process absentees for today
    const result = await markAbsenteesForDate(now);
    lastProcessedDateString = currentDateString;

    console.log(
      `[AbsenceProcessor] Checked absentees for ${currentDateString}: ${result.markedCount || 0} staff marked Absent (Uninformed Absence)`
    );

    return {
      success: true,
      date: currentDateString,
      markedCount: result.markedCount || 0,
    };
  } catch (error) {
    console.error('[AbsenceProcessor] Error during absence check:', error.message);
    return { success: false, error: error.message };
  } finally {
    isProcessing = false;
  }
};

/**
 * Starts the periodic absence processor background timer
 * Interval: checks every 60 seconds
 */
const startAbsenceProcessingJob = (intervalMs = 60000) => {
  if (timerId) {
    clearInterval(timerId);
  }

  // Initial check on server boot (in case server restarted after 11:00 AM)
  runAbsenceCheck().catch((err) => {
    console.error('[AbsenceProcessor] Initial check failed:', err.message);
  });

  timerId = setInterval(() => {
    runAbsenceCheck().catch((err) => {
      console.error('[AbsenceProcessor] Periodic check failed:', err.message);
    });
  }, intervalMs);

  // Prevent interval from blocking Node event loop exit in tests
  if (timerId.unref) {
    timerId.unref();
  }

  console.log('[AbsenceProcessor] Autonomous absence processing job started (interval: 60s)');
};

/**
 * Stops the periodic absence processor background timer
 */
const stopAbsenceProcessingJob = () => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
    console.log('[AbsenceProcessor] Absence processing job stopped');
  }
};

module.exports = {
  runAbsenceCheck,
  startAbsenceProcessingJob,
  stopAbsenceProcessingJob,
};
