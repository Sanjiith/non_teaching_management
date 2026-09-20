const Attendance = require('../models/Attendance.model');
const User = require('../models/User.model');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { normalizeRole } = require('../middleware/role.middleware');

/**
 * Normalizes any Date string or Date object to midnight UTC (00:00:00.000Z)
 */
const normalizeDateToUTC = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};

/**
 * Calculates dynamic attendance rate & metrics
 */
const calculateAttendanceStats = (records) => {
  let presentDays = 0;
  let absentDays = 0;
  let leaveDays = 0;
  let holidayDays = 0;
  let weeklyOffDays = 0;

  records.forEach((r) => {
    const s = r.status;
    if (s === 'Present') presentDays++;
    else if (s === 'Absent') absentDays++;
    else if (s === 'Leave' || s === 'On-Leave') leaveDays++;
    else if (s === 'Holiday') holidayDays++;
    else if (s === 'Weekly Off') weeklyOffDays++;
  });

  const totalWorkingTracked = presentDays + absentDays;
  // Excused leave policy: approved leaves do not penalize attendance rate
  const attendanceRate = totalWorkingTracked > 0
    ? Number(((presentDays / totalWorkingTracked) * 100).toFixed(1))
    : records.length > 0
    ? 100.0
    : 0;

  return {
    totalRecords: records.length,
    presentDays,
    absentDays,
    leaveDays,
    holidayDays,
    weeklyOffDays,
    attendanceRate,
  };
};

/**
 * @desc    Get current staff member's attendance
 * @route   GET /api/attendance/my
 * @access  Private (Staff)
 */
const getMyAttendance = async (req, res) => {
  try {
    const userId = req.user._id;
    const { month, year, limit } = req.query;

    const filter = { user: userId };

    if (year) {
      const y = parseInt(year, 10);
      let start, end;
      if (month) {
        const m = parseInt(month, 10) - 1;
        start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
        end = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
      } else {
        start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
        end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
      }
      filter.date = { $gte: start, $lte: end };
    }

    let query = Attendance.find(filter).sort({ date: -1 });
    if (limit) {
      query = query.limit(parseInt(limit, 10));
    }

    const records = await query;
    const allRecordsForUser = await Attendance.find({ user: userId });
    const stats = calculateAttendanceStats(allRecordsForUser);

    return sendSuccess(res, 200, 'Attendance fetched successfully', {
      count: records.length,
      records,
      stats,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get attendance for staff in HOD's department
 * @route   GET /api/attendance/department
 * @access  Private (HOD)
 */
const getDepartmentAttendance = async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    if (userRole !== 'HOD' && userRole !== 'Admin') {
      return sendError(res, 403, 'Access denied. Only HODs or Admins can view department attendance.');
    }

    const deptId = req.user.department?._id || req.user.department;
    if (!deptId) {
      return sendError(res, 400, 'User has no department assigned.');
    }

    // Find all users in department
    const deptUsers = await User.find({ department: deptId }).select('_id name employeeId designation');
    const userIds = deptUsers.map((u) => u._id);

    const { date, month, year, status } = req.query;
    const filter = { user: { $in: userIds } };

    if (date) {
      const d = normalizeDateToUTC(date);
      const nextD = new Date(d);
      nextD.setUTCDate(nextD.getUTCDate() + 1);
      filter.date = { $gte: d, $lt: nextD };
    } else if (year) {
      const y = parseInt(year, 10);
      if (month) {
        const m = parseInt(month, 10) - 1;
        filter.date = {
          $gte: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)),
          $lte: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
        };
      }
    }

    if (status) {
      filter.status = status === 'On-Leave' ? 'Leave' : status;
    }

    const records = await Attendance.find(filter)
      .populate('user', 'name employeeId staffId designation')
      .sort({ date: -1 });

    return sendSuccess(res, 200, 'Department attendance fetched successfully', {
      count: records.length,
      records,
      departmentStaffCount: deptUsers.length,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get all attendance (Admin)
 * @route   GET /api/attendance
 * @access  Private (Admin)
 */
const getAllAttendance = async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);

    // Redirect HOD automatically to department attendance if hitting /api/attendance
    if (userRole === 'HOD') {
      return getDepartmentAttendance(req, res);
    }

    if (userRole !== 'Admin') {
      return sendError(res, 403, 'Access denied. Admin access required.');
    }

    const { department, user, date, month, year, status } = req.query;
    const filter = {};

    if (user) {
      filter.user = user;
    } else if (department) {
      const deptUsers = await User.find({ department }).select('_id');
      filter.user = { $in: deptUsers.map((u) => u._id) };
    }

    if (date) {
      const d = normalizeDateToUTC(date);
      const nextD = new Date(d);
      nextD.setUTCDate(nextD.getUTCDate() + 1);
      filter.date = { $gte: d, $lt: nextD };
    } else if (year) {
      const y = parseInt(year, 10);
      if (month) {
        const m = parseInt(month, 10) - 1;
        filter.date = {
          $gte: new Date(Date.UTC(y, m, 1, 0, 0, 0, 0)),
          $lte: new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999)),
        };
      }
    }

    if (status) {
      filter.status = status === 'On-Leave' ? 'Leave' : status;
    }

    const records = await Attendance.find(filter)
      .populate({
        path: 'user',
        select: 'name employeeId staffId designation department',
        populate: { path: 'department', select: 'name code' },
      })
      .sort({ date: -1 });

    return sendSuccess(res, 200, 'Attendance records fetched successfully', {
      count: records.length,
      records,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get specific staff member's attendance
 * @route   GET /api/attendance/user/:userId
 * @access  Private (Admin: all, HOD: department staff, Staff: self only)
 */
const getStaffAttendance = async (req, res) => {
  try {
    const targetUserId = req.params.userId;
    const requesterRole = normalizeRole(req.user.role);

    // Staff can only view own attendance
    if (requesterRole === 'Staff') {
      if (req.user._id.toString() !== targetUserId) {
        return sendError(res, 403, "Access denied. Staff cannot access another staff member's private data.");
      }
    }

    // HOD can only view attendance of staff in their department
    if (requesterRole === 'HOD') {
      const targetUser = await User.findById(targetUserId).select('department');
      if (!targetUser) {
        return sendError(res, 404, 'User not found.');
      }
      const hodDeptId = req.user.department?._id?.toString() || req.user.department?.toString();
      const targetDeptId = targetUser.department?._id?.toString() || targetUser.department?.toString();
      if (!hodDeptId || hodDeptId !== targetDeptId) {
        return sendError(res, 403, 'Access denied. HOD cannot access attendance of staff in another department.');
      }
    }

    const records = await Attendance.find({ user: targetUserId })
      .populate('user', 'name employeeId designation')
      .sort({ date: -1 });

    const stats = calculateAttendanceStats(records);

    return sendSuccess(res, 200, 'Staff attendance fetched successfully', {
      count: records.length,
      records,
      stats,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Mark or Correct attendance record (Admin / HOD)
 * @route   POST /api/attendance/mark OR PUT /api/attendance/:id
 * @access  Private (Admin, HOD for own dept)
 */
const markOrCorrectAttendance = async (req, res) => {
  try {
    const requesterRole = normalizeRole(req.user.role);
    if (requesterRole !== 'Admin' && requesterRole !== 'HOD') {
      return sendError(res, 403, 'Access denied. Only Admin and HOD can mark or correct attendance.');
    }

    let { user, date, status, remarks, checkIn, checkOut } = req.body;
    let targetUserId = user || req.params.userId;

    // If updating by record ID
    if (req.params.id && !targetUserId) {
      const existingRecord = await Attendance.findById(req.params.id);
      if (!existingRecord) {
        return sendError(res, 404, 'Attendance record not found.');
      }
      targetUserId = existingRecord.user;
      if (!date) date = existingRecord.date;
    }

    if (!targetUserId) {
      return sendError(res, 400, 'Target user is required.');
    }

    const targetUser = await User.findById(targetUserId).select('department name');
    if (!targetUser) {
      return sendError(res, 404, 'User not found.');
    }

    // HOD department check
    if (requesterRole === 'HOD') {
      const hodDeptId = req.user.department?._id?.toString() || req.user.department?.toString();
      const targetDeptId = targetUser.department?._id?.toString() || targetUser.department?.toString();
      if (!hodDeptId || hodDeptId !== targetDeptId) {
        return sendError(res, 403, 'Access denied. HOD cannot mark or correct attendance for another department.');
      }
    }

    const normalizedDate = normalizeDateToUTC(date);
    const normalizedStatus = status === 'On-Leave' ? 'Leave' : status;

    const updateDoc = {
      user: targetUserId,
      date: normalizedDate,
      status: normalizedStatus,
      remarks: remarks || (requesterRole === 'Admin' ? 'Updated by Admin' : 'Updated by HOD'),
    };

    if (checkIn !== undefined) updateDoc.checkIn = checkIn;
    if (checkOut !== undefined) updateDoc.checkOut = checkOut;

    // Use findOneAndUpdate with upsert to prevent duplicate records per user per day!
    const attendance = await Attendance.findOneAndUpdate(
      { user: targetUserId, date: normalizedDate },
      updateDoc,
      { upsert: true, new: true, runValidators: true }
    ).populate('user', 'name employeeId designation');

    return sendSuccess(res, 200, 'Attendance recorded successfully', { attendance });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get attendance summary statistics (for dashboard KPIs)
 * @route   GET /api/attendance/stats
 * @access  Private
 */
const getAttendanceStats = async (req, res) => {
  try {
    const requesterRole = normalizeRole(req.user.role);
    const today = normalizeDateToUTC(new Date());
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const filter = { date: { $gte: today, $lt: tomorrow } };
    let totalStaff = 0;

    if (requesterRole === 'HOD') {
      const hodDeptId = req.user.department?._id || req.user.department;
      const deptUsers = await User.find({ department: hodDeptId }).select('_id');
      filter.user = { $in: deptUsers.map((u) => u._id) };
      totalStaff = deptUsers.length;
    } else if (requesterRole === 'Admin') {
      totalStaff = await User.countDocuments({ role: { $in: ['Staff', 'Non-Teaching Staff'] } });
    } else {
      // Staff stats
      const myRecords = await Attendance.find({ user: req.user._id });
      const stats = calculateAttendanceStats(myRecords);
      return sendSuccess(res, 200, 'Staff stats fetched', { stats });
    }

    const todayRecords = await Attendance.find(filter);

    let presentToday = 0;
    let absentToday = 0;
    let onLeaveToday = 0;

    todayRecords.forEach((r) => {
      if (r.status === 'Present') presentToday++;
      else if (r.status === 'Absent') absentToday++;
      else if (r.status === 'Leave' || r.status === 'On-Leave') onLeaveToday++;
    });

    const attendanceRateToday = totalStaff > 0
      ? Number(((presentToday / totalStaff) * 100).toFixed(1))
      : 0;

    return sendSuccess(res, 200, 'Stats fetched successfully', {
      totalStaff,
      presentToday,
      absentToday,
      onLeaveToday,
      attendanceRateToday,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getMyAttendance,
  getDepartmentAttendance,
  getAllAttendance,
  getStaffAttendance,
  markOrCorrectAttendance,
  getAttendanceStats,
};
