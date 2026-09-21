const Schedule = require('../models/Schedule.model');
const Shift = require('../models/Shift.model');
const User = require('../models/User.model');
const Leave = require('../models/Leave.model');
const Attendance = require('../models/Attendance.model');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const notificationService = require('../services/notification.service');


const normalizeDate = (d) => {
  const date = new Date(d);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

// @desc    Assign a shift to staff
// @route   POST /api/schedules
// @access  Admin, HOD
exports.assignSchedule = async (req, res) => {
  try {
    const { staff: staffId, shift: shiftId, date, startTime, endTime, remarks } = req.body;

    const scheduleDate = normalizeDate(date);

    // 1. Verify staff exists
    const staffUser = await User.findById(staffId);
    if (!staffUser || !staffUser.isActive) {
      return sendError(res, 404, 'Staff member not found or inactive');
    }

    // 2. Department check for HOD
    if (req.user.role === 'HOD') {
      const hodDeptId = (req.user.department?._id || req.user.department).toString();
      const staffDeptId = (staffUser.department?._id || staffUser.department)?.toString();
      if (hodDeptId !== staffDeptId) {
        return sendError(res, 403, 'Access denied: You can only assign shifts to staff in your department');
      }
    }

    // 3. Verify shift exists and is active
    const shift = await Shift.findById(shiftId);
    if (!shift || !shift.isActive) {
      return sendError(res, 404, 'Shift not found or inactive');
    }

    // 4. Check for duplicate schedule for this staff on this date
    const existingSchedule = await Schedule.findOne({ staff: staffId, date: scheduleDate });
    if (existingSchedule) {
      return sendError(
        res,
        409,
        `Staff member already has a shift (${existingSchedule.startTime} - ${existingSchedule.endTime}) assigned on this date`,
        { existingScheduleId: existingSchedule._id }
      );
    }

    // 5. Approved Leave Conflict Detection
    // Check if staff has an approved leave covering this date
    const approvedLeave = await Leave.findOne({
      user: staffId,
      status: 'Approved',
      fromDate: { $lte: scheduleDate },
      toDate: { $gte: scheduleDate },
    });

    // Also check if attendance already marked as Leave
    const leaveAttendance = await Attendance.findOne({
      user: staffId,
      date: scheduleDate,
      status: { $in: ['Leave', 'On-Leave'] },
    });

    const hasLeaveConflict = Boolean(approvedLeave || leaveAttendance);

    let status = 'Scheduled';
    let scheduleRemarks = remarks || '';

    if (hasLeaveConflict) {
      status = 'On Leave';
      const conflictMsg = 'Conflict: Staff has approved leave on this date';
      scheduleRemarks = scheduleRemarks ? `${scheduleRemarks} | ${conflictMsg}` : conflictMsg;
    }

    // Determine shift timings
    const finalStartTime = startTime || shift.startTime;
    const finalEndTime = endTime || shift.endTime;

    const schedule = await Schedule.create({
      staff: staffId,
      department: staffUser.department,
      shift: shiftId,
      date: scheduleDate,
      startTime: finalStartTime,
      endTime: finalEndTime,
      status,
      remarks: scheduleRemarks,
    });

    await schedule.populate([
      { path: 'staff', select: 'name email staffId designation department' },
      { path: 'shift', select: 'name startTime endTime workingHours' },
      { path: 'department', select: 'name code' },
    ]);

    const responsePayload = {
      schedule,
      hasConflict: hasLeaveConflict,
      conflictType: hasLeaveConflict ? 'APPROVED_LEAVE' : null,
      message: hasLeaveConflict
        ? 'Shift assigned, but marked as "On Leave" due to approved leave conflict'
        : 'Shift assigned successfully',
    };

    // Notify Staff
    await notificationService.createNotification({
      user: staffId,
      title: 'New Shift Assigned',
      message: `You have been assigned to ${schedule.shift?.name || 'a shift'} on ${scheduleDate.toLocaleDateString('en-IN')}.`,
      type: 'info'
    });

    return sendSuccess(res, 201, responsePayload.message, responsePayload);
  } catch (error) {
    if (error.code === 11000) {
      return sendError(res, 409, 'A shift is already scheduled for this staff member on this date');
    }
    console.error('assignSchedule error:', error);
    return sendError(res, 500, error.message);
  }
};

// @desc    Get non-teaching staff's own assigned schedule
// @route   GET /api/schedules/my
// @access  Staff, Authenticated
exports.getMySchedule = async (req, res) => {
  try {
    const staffId = req.user._id;
    const { startDate, endDate, month, year } = req.query;

    const filter = { staff: staffId };

    if (startDate && endDate) {
      filter.date = {
        $gte: normalizeDate(startDate),
        $lte: normalizeDate(endDate),
      };
    } else if (month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
      filter.date = { $gte: start, $lte: end };
    }

    const schedules = await Schedule.find(filter)
      .populate('shift', 'name startTime endTime workingHours description')
      .populate('department', 'name code')
      .sort({ date: 1 });

    return sendSuccess(res, 200, 'My schedules retrieved successfully', schedules);
  } catch (error) {
    console.error('getMySchedule error:', error);
    return sendError(res, 500, error.message);
  }
};

// @desc    Get schedules for HOD's department
// @route   GET /api/schedules/department
// @access  HOD, Admin
exports.getDepartmentSchedules = async (req, res) => {
  try {
    let deptId;
    if (req.user.role === 'Admin') {
      deptId = req.query.department;
      if (!deptId) {
        return sendError(res, 400, 'department query parameter is required for Admin on this route');
      }
    } else {
      deptId = req.user.department?._id || req.user.department;
    }

    const { date, startDate, endDate, staff, shift, status } = req.query;
    const filter = { department: deptId };

    if (staff) filter.staff = staff;
    if (shift) filter.shift = shift;
    if (status) filter.status = status;

    if (date) {
      filter.date = normalizeDate(date);
    } else if (startDate && endDate) {
      filter.date = {
        $gte: normalizeDate(startDate),
        $lte: normalizeDate(endDate),
      };
    }

    const schedules = await Schedule.find(filter)
      .populate('staff', 'name email staffId designation department')
      .populate('shift', 'name startTime endTime workingHours')
      .populate('department', 'name code')
      .sort({ date: 1, startTime: 1 });

    return sendSuccess(res, 200, 'Department schedules retrieved successfully', schedules);
  } catch (error) {
    console.error('getDepartmentSchedules error:', error);
    return sendError(res, 500, error.message);
  }
};

// @desc    Get all schedules (Admin global view)
// @route   GET /api/schedules
// @access  Admin
exports.getAllSchedules = async (req, res) => {
  try {
    const { department, staff, shift, status, date, startDate, endDate } = req.query;
    const filter = {};

    if (department) filter.department = department;
    if (staff) filter.staff = staff;
    if (shift) filter.shift = shift;
    if (status) filter.status = status;

    if (date) {
      filter.date = normalizeDate(date);
    } else if (startDate && endDate) {
      filter.date = {
        $gte: normalizeDate(startDate),
        $lte: normalizeDate(endDate),
      };
    }

    const schedules = await Schedule.find(filter)
      .populate('staff', 'name email staffId designation department')
      .populate('shift', 'name startTime endTime workingHours')
      .populate('department', 'name code')
      .sort({ date: -1, startTime: 1 });

    return sendSuccess(res, 200, 'All schedules retrieved successfully', schedules);
  } catch (error) {
    console.error('getAllSchedules error:', error);
    return sendError(res, 500, error.message);
  }
};

// @desc    Update a schedule
// @route   PUT /api/schedules/:id
// @access  Admin, HOD
exports.updateSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return sendError(res, 404, 'Schedule not found');
    }

    // HOD authorization check
    if (req.user.role === 'HOD') {
      const hodDeptId = (req.user.department?._id || req.user.department).toString();
      if (schedule.department.toString() !== hodDeptId) {
        return sendError(res, 403, 'Access denied: You can only update schedules in your department');
      }
    }

    const { shift: shiftId, startTime, endTime, status, remarks } = req.body;

    if (shiftId) {
      const shift = await Shift.findById(shiftId);
      if (!shift || !shift.isActive) {
        return sendError(res, 404, 'Shift not found or inactive');
      }
      schedule.shift = shiftId;
    }

    if (startTime) schedule.startTime = startTime;
    if (endTime) schedule.endTime = endTime;
    if (status) schedule.status = status;
    if (remarks !== undefined) schedule.remarks = remarks;

    await schedule.save();

    await schedule.populate([
      { path: 'staff', select: 'name email staffId designation department' },
      { path: 'shift', select: 'name startTime endTime workingHours' },
      { path: 'department', select: 'name code' },
    ]);

    // Notify Staff
    await notificationService.createNotification({
      user: schedule.staff._id || schedule.staff,
      title: 'Schedule Updated',
      message: `Your schedule on ${new Date(schedule.date).toLocaleDateString('en-IN')} has been updated.`,
      type: 'warning'
    });

    return sendSuccess(res, 200, 'Schedule updated successfully', schedule);
  } catch (error) {
    console.error('updateSchedule error:', error);
    return sendError(res, 500, error.message);
  }
};

// @desc    Delete a schedule
// @route   DELETE /api/schedules/:id
// @access  Admin, HOD
exports.deleteSchedule = async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return sendError(res, 404, 'Schedule not found');
    }

    // HOD authorization check
    if (req.user.role === 'HOD') {
      const hodDeptId = (req.user.department?._id || req.user.department).toString();
      if (schedule.department.toString() !== hodDeptId) {
        return sendError(res, 403, 'Access denied: You can only delete schedules in your department');
      }
    }

    await Schedule.findByIdAndDelete(req.params.id);
    return sendSuccess(res, 200, 'Schedule deleted successfully');
  } catch (error) {
    console.error('deleteSchedule error:', error);
    return sendError(res, 500, error.message);
  }
};
