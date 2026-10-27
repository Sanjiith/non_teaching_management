const Attendance = require('../models/Attendance.model');
const User = require('../models/User.model');
const Leave = require('../models/Leave.model');
const Department = require('../models/Department.model');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { normalizeRole } = require('../middleware/role.middleware');
const {
  getAttendanceConfig,
  updateAttendanceConfig,
  isWithinCheckInWindow,
  isBeforeCheckInWindow,
  hasCheckInWindowClosed,
  formatTime12Hour,
  isLeaveCoveringDateTime,
} = require('../config/attendance.config');

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
  let holidayDays = 0;
  let weeklyOffDays = 0;
  let totalLeaveDays = 0;
  const leaveGroups = new Set();
  const staffOnLeaveSet = new Set();

  records.forEach((r) => {
    const s = r.status;
    if (s === 'Present') presentDays++;
    else if (s === 'Absent') absentDays++;
    else if (s === 'Leave' || s === 'On-Leave') {
      totalLeaveDays++;
      const uid = r.user?._id?.toString() || r.user?.toString() || 'unknown';
      staffOnLeaveSet.add(uid);
      const match = r.remarks?.match(/Leave ID:\s*([a-f0-9]+)/i);
      const leaveKey = match ? `${uid}_${match[1]}` : `${uid}_${r.date ? new Date(r.date).toISOString().split('T')[0] : Math.random()}`;
      leaveGroups.add(leaveKey);
    }
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
    leaveDays: totalLeaveDays,
    totalLeaveDays,
    leaveApplicationsCount: leaveGroups.size,
    staffOnLeaveCount: staffOnLeaveSet.size,
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

    // Stats are calculated from the same period-filtered records so that
    // the attendance rate reflects only the selected month/year, not all history.
    const stats = calculateAttendanceStats(records);

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
      } else {
        filter.date = {
          $gte: new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0)),
          $lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
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
      } else {
        filter.date = {
          $gte: new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0)),
          $lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
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
    const { date } = req.query;
    const targetDate = date ? normalizeDateToUTC(date) : normalizeDateToUTC(new Date());
    const nextDate = new Date(targetDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    const filter = { date: { $gte: targetDate, $lt: nextDate } };
    let totalStaff = 0;
    let hodDeptId = null;

    if (requesterRole === 'HOD') {
      hodDeptId = req.user.department?._id || req.user.department;
      const deptUsers = await User.find({
        department: hodDeptId,
        role: { $in: ['Staff', 'Non-Teaching Staff'] },
        isActive: true,
      }).select('_id');
      filter.user = { $in: deptUsers.map((u) => u._id) };
      totalStaff = deptUsers.length;
    } else if (requesterRole === 'Admin') {
      totalStaff = await User.countDocuments({
        role: { $in: ['Staff', 'Non-Teaching Staff'] },
        isActive: true,
      });
    } else {
      // Staff stats
      const myRecords = await Attendance.find({ user: req.user._id });
      const stats = calculateAttendanceStats(myRecords);
      return sendSuccess(res, 200, 'Staff stats fetched', { stats });
    }

    // 1. Fetch attendance records for target date
    const todayRecords = await Attendance.find(filter);

    const presentUserSet = new Set();
    const absentUserSet = new Set();
    const staffOnLeaveSet = new Set();

    todayRecords.forEach((r) => {
      const uid = r.user?._id?.toString() || r.user?.toString();
      if (!uid) return;
      if (r.status === 'Present') {
        presentUserSet.add(uid);
      } else if (r.status === 'Absent') {
        absentUserSet.add(uid);
      } else if (r.status === 'Leave' || r.status === 'On-Leave') {
        staffOnLeaveSet.add(uid);
      }
    });

    // 2. Fetch approved leaves overlapping target date (fromDate <= targetDate and toDate >= targetDate)
    const approvedLeaveFilter = {
      status: 'Approved',
      fromDate: { $lt: nextDate },
      toDate: { $gte: targetDate },
    };
    if (requesterRole === 'HOD' && hodDeptId) {
      approvedLeaveFilter.department = hodDeptId;
    }
    const approvedLeavesToday = await Leave.find(approvedLeaveFilter).select('user');
    approvedLeavesToday.forEach((l) => {
      const uid = l.user?._id?.toString() || l.user?.toString();
      if (uid) staffOnLeaveSet.add(uid);
    });

    // A user explicitly marked Present cannot be counted as on leave
    presentUserSet.forEach((uid) => staffOnLeaveSet.delete(uid));

    const presentToday = presentUserSet.size;
    const absentToday = absentUserSet.size;
    const onLeaveToday = staffOnLeaveSet.size;
    const staffOnLeaveCount = staffOnLeaveSet.size;

    // 3. Count unique leave requests by status according to scope
    const leaveScopeFilter = {};
    if (requesterRole === 'HOD' && hodDeptId) {
      leaveScopeFilter.department = hodDeptId;
    }
    const [pendingLeavesCount, approvedLeavesCount, rejectedLeavesCount, totalLeaveApplications] = await Promise.all([
      Leave.countDocuments({ ...leaveScopeFilter, status: 'Pending' }),
      Leave.countDocuments({ ...leaveScopeFilter, status: 'Approved' }),
      Leave.countDocuments({ ...leaveScopeFilter, status: 'Rejected' }),
      Leave.countDocuments(leaveScopeFilter),
    ]);

    const attendanceRateToday = totalStaff > 0
      ? Number(((presentToday / totalStaff) * 100).toFixed(1))
      : 0;

    // 4. Department breakdown for Admin (dynamic from real DB data)
    let departmentBreakdown = [];
    if (requesterRole === 'Admin') {
      const departments = await Department.find({}).sort({ code: 1 });
      const allActiveStaff = await User.find({
        role: { $in: ['Staff', 'Non-Teaching Staff'] },
        isActive: true,
      }).select('_id department');

      const deptMap = {};
      departments.forEach((d) => {
        deptMap[d._id.toString()] = {
          dept: d.code,
          name: d.name,
          total: 0,
          present: 0,
          absent: 0,
          leave: 0,
        };
      });

      allActiveStaff.forEach((u) => {
        const dId = u.department?.toString();
        if (dId && deptMap[dId]) {
          deptMap[dId].total++;
          const uid = u._id.toString();
          if (presentUserSet.has(uid)) deptMap[dId].present++;
          else if (absentUserSet.has(uid)) deptMap[dId].absent++;
          else if (staffOnLeaveSet.has(uid)) deptMap[dId].leave++;
        }
      });

      departmentBreakdown = Object.values(deptMap);
    }

    return sendSuccess(res, 200, 'Stats fetched successfully', {
      totalStaff,
      presentToday,
      absentToday,
      onLeaveToday,
      staffOnLeaveCount,
      pendingLeavesCount,
      approvedLeavesCount,
      rejectedLeavesCount,
      totalLeaveApplications,
      attendanceRateToday,
      departmentBreakdown,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
/**
 * Automatically mark absent staff members for a specific date if check-in period has ended.
 * Rules:
 * 1. Only runs if the window has closed for targetDate (or targetDate is in the past).
 * 2. Does NOT mark staff absent if they have an approved leave covering targetDate.
 * 3. Does NOT mark staff absent if targetDate is a Sunday (weekly off) or Holiday under policy.
 * 4. Does NOT overwrite existing records (e.g. Present, Leave, Holiday, Weekly Off).
 * 5. Classifies absent staff as 'Absent' with absenceType: 'Uninformed Absence'.
 * 6. Uses upsert to guarantee idempotency and prevent duplicate records per user per day.
 */
const markAbsenteesForDate = async (targetDateInput) => {
  try {
    const targetDate = normalizeDateToUTC(targetDateInput);
    const nowUTC = normalizeDateToUTC(new Date());

    // Do not mark absent for future dates
    if (targetDate > nowUTC) return { markedCount: 0 };

    // For today, only mark absent if check-in window has closed
    if (targetDate.getTime() === nowUTC.getTime() && !hasCheckInWindowClosed(new Date())) {
      return { markedCount: 0 };
    }

    const nextDate = new Date(targetDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    // 1. Fetch all active non-teaching staff
    const activeStaff = await User.find({
      role: { $in: ['Staff', 'Non-Teaching Staff'] },
      isActive: true,
    }).select('_id employeeId name department basicSalary');

    if (activeStaff.length === 0) return { markedCount: 0 };

    // 2. Fetch all existing attendance records for targetDate
    const existingAttendance = await Attendance.find({
      date: { $gte: targetDate, $lt: nextDate },
    }).select('user status absenceType remarks');

    const existingAttMap = new Map();
    existingAttendance.forEach((r) => {
      existingAttMap.set(r.user.toString(), r);
    });

    // Check if targetDate is Sunday (Weekly Off in institutional policy)
    const isSunday = targetDate.getUTCDay() === 0;

    // 3. Fetch all approved leaves covering targetDate
    const approvedLeaves = await Leave.find({
      status: 'Approved',
      fromDate: { $lt: nextDate },
      toDate: { $gte: targetDate },
    }).select('user type');

    const approvedLeaveUserMap = new Map();
    approvedLeaves.forEach((l) => {
      approvedLeaveUserMap.set(l.user.toString(), l);
    });

    let markedCount = 0;

    for (const staff of activeStaff) {
      const uid = staff._id.toString();
      const existingRec = existingAttMap.get(uid);

      // 1. If staff has approved leave for this date, ensure Leave attendance record
      if (approvedLeaveUserMap.has(uid)) {
        const leave = approvedLeaveUserMap.get(uid);

        // Do not downgrade a Present check-in, but ensure any Absent or missing record is 'Leave'
        if (!existingRec || existingRec.status !== 'Present') {
          await Attendance.findOneAndUpdate(
            { user: staff._id, date: targetDate },
            {
              $set: {
                status: 'Leave',
                absenceType: 'None',
                remarks: `Approved ${leave.type || 'Leave'}`,
              },
              $setOnInsert: {
                user: staff._id,
                date: targetDate,
                checkIn: null,
                checkOut: null,
              },
            },
            { upsert: true, new: true }
          );
        }
        continue;
      }

      // 2. If targetDate is a Sunday (Weekly Off), record Weekly Off instead of Absent
      if (isSunday) {
        if (!existingRec) {
          await Attendance.findOneAndUpdate(
            { user: staff._id, date: targetDate },
            {
              $setOnInsert: {
                user: staff._id,
                date: targetDate,
                status: 'Weekly Off',
                absenceType: 'None',
                remarks: 'Scheduled Weekly Off (Sunday)',
                checkIn: null,
                checkOut: null,
              },
            },
            { upsert: true, new: true }
          );
        }
        continue;
      }

      // 3. If already recorded as Present, Holiday, Weekly Off, or Leave, do not overwrite
      if (existingRec) {
        if (['Present', 'Holiday', 'Weekly Off', 'Leave'].includes(existingRec.status)) {
          continue;
        }
        // If already marked Absent, ensure classified as Uninformed Absence
        if (existingRec.status === 'Absent' && existingRec.absenceType !== 'Uninformed Absence') {
          await Attendance.findByIdAndUpdate(existingRec._id, {
            $set: {
              absenceType: 'Uninformed Absence',
              remarks: 'Uninformed Absence: Check-in deadline (11:00 AM) passed without check-in or approved leave',
            },
          });
        }
        continue;
      }

      // 4. If no check-in and no approved leave on a working day, mark Absent and classify as Uninformed Absence
      await Attendance.findOneAndUpdate(
        { user: staff._id, date: targetDate },
        {
          $setOnInsert: {
            user: staff._id,
            date: targetDate,
            status: 'Absent',
            absenceType: 'Uninformed Absence',
            remarks: 'Uninformed Absence: Check-in deadline (11:00 AM) passed without check-in or approved leave',
            checkIn: null,
            checkOut: null,
          },
        },
        { upsert: true, new: true }
      );
      markedCount++;
    }

    return { markedCount };
  } catch (error) {
    console.error('Error marking absentees:', error);
    return { markedCount: 0, error: error.message };
  }
};

/**
 * @desc    Staff Check-In (Biometric alternative)
 * @route   POST /api/attendance/check-in
 * @access  Private (Staff, Non-Teaching Staff)
 */
const checkIn = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const todayUTC = normalizeDateToUTC(now);
    const config = getAttendanceConfig();

    // 1. Check if user already checked in today (single check-in per staff per day)
    const existing = await Attendance.findOne({
      user: userId,
      date: todayUTC,
    });

    if (existing && (existing.status === 'Present' || existing.checkIn !== null)) {
      const formattedTime = formatTime12Hour(existing.checkIn);
      return sendError(
        res,
        400,
        `You have already checked in today at ${formattedTime}. Duplicate check-ins are not permitted.`
      );
    }

    // 2. Check if user has an approved leave covering the current date and time
    const nextDate = new Date(todayUTC);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    const approvedLeaves = await Leave.find({
      user: userId,
      status: 'Approved',
      fromDate: { $lt: nextDate },
      toDate: { $gte: todayUTC },
    });

    const activeApprovedLeave = approvedLeaves.find((l) => isLeaveCoveringDateTime(l, now));

    if (activeApprovedLeave) {
      return sendError(
        res,
        400,
        'You are on approved leave today. Check-in is unavailable.'
      );
    }

    // 3. Time window validations
    if (isBeforeCheckInWindow(now)) {
      return sendError(
        res,
        400,
        `Check-in period has not started yet. Today's check-in window is ${config.checkInStartTime} to ${config.checkInEndTime}.`
      );
    }

    if (hasCheckInWindowClosed(now)) {
      // Mark absentees since window has closed
      await markAbsenteesForDate(todayUTC);
      return sendError(
        res,
        400,
        `Check-in window closed at ${config.checkInEndTime}. You have been marked Absent (Uninformed Absence) according to attendance rules.`
      );
    }

    // 4. Record successful check-in
    const attendance = await Attendance.findOneAndUpdate(
      { user: userId, date: todayUTC },
      {
        $set: {
          status: 'Present',
          absenceType: 'None',
          checkIn: now,
          remarks: 'Self Check-In (Biometric alternative)',
        },
        $setOnInsert: {
          user: userId,
          date: todayUTC,
        },
      },
      { upsert: true, new: true, runValidators: true }
    ).populate('user', 'name employeeId staffId designation department');

    const formattedTime = formatTime12Hour(now);

    return sendSuccess(res, 200, 'Check-in successful! Attendance marked as Present.', {
      attendance,
      checkInTime: now,
      checkInTimeFormatted: formattedTime,
      status: 'Present',
      date: todayUTC,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get current user's attendance status and check-in time for today
 * @route   GET /api/attendance/today
 * @access  Private
 */
const getTodayAttendance = async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const todayUTC = normalizeDateToUTC(now);
    const config = getAttendanceConfig();

    const isWindowClosed = hasCheckInWindowClosed(now);
    const isWindowOpen = isWithinCheckInWindow(now);
    const isBeforeWindow = isBeforeCheckInWindow(now);

    // If window closed, ensure absence marking is up to date
    if (isWindowClosed) {
      await markAbsenteesForDate(todayUTC);
    }

    const nextDate = new Date(todayUTC);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    const attendance = await Attendance.findOne({
      user: userId,
      date: todayUTC,
    }).populate('user', 'name employeeId designation department');

    const approvedLeaves = await Leave.find({
      user: userId,
      status: 'Approved',
      fromDate: { $lt: nextDate },
      toDate: { $gte: todayUTC },
    });

    const activeApprovedLeave = approvedLeaves.find((l) => isLeaveCoveringDateTime(l, now));
    const todayApprovedLeave = approvedLeaves.length > 0 ? approvedLeaves[0] : null;

    // Check for pending leave (must not block check-in)
    const pendingLeave = await Leave.findOne({
      user: userId,
      status: 'Pending',
      fromDate: { $lt: nextDate },
      toDate: { $gte: todayUTC },
    });

    let status = 'Pending Check-In';
    let absenceType = 'None';
    let checkIn = null;
    let remarks = '';
    const isOnApprovedLeave = Boolean(activeApprovedLeave);

    if (attendance) {
      status = attendance.status;
      absenceType = attendance.absenceType || (attendance.status === 'Absent' ? 'Uninformed Absence' : 'None');
      checkIn = attendance.checkIn;
      remarks = attendance.remarks || '';
      if (isOnApprovedLeave && status !== 'Present') {
        status = 'Leave';
        absenceType = 'None';
      }
    } else if (isOnApprovedLeave) {
      status = 'Leave';
      absenceType = 'None';
      remarks = `Approved ${activeApprovedLeave.type}`;
    } else if (todayApprovedLeave && (todayApprovedLeave.totalDays >= 1 || !isWindowClosed)) {
      status = 'Leave';
      absenceType = 'None';
      remarks = `Approved ${todayApprovedLeave.type}`;
    } else if (isWindowClosed) {
      status = 'Absent';
      absenceType = 'Uninformed Absence';
      remarks = 'Uninformed Absence: Check-in deadline (11:00 AM) passed without check-in or approved leave';
    }

    if (status === 'Absent' && absenceType === 'None') {
      absenceType = 'Uninformed Absence';
    }

    // Daily deduction estimate (under existing policy: 25 working days, max salary cap 40000)
    const applicableSalary = Math.min(req.user.basicSalary || 0, 40000);
    const dailyDeduction = status === 'Absent' ? Math.round((applicableSalary / 25) * 100) / 100 : 0;

    const checkInFormatted = checkIn ? formatTime12Hour(checkIn) : null;
    const canCheckIn = isWindowOpen && status !== 'Present' && !isOnApprovedLeave;
    const alreadyCheckedIn = status === 'Present' && checkIn !== null;

    const leaveMessage = isOnApprovedLeave
      ? 'You are on approved leave today. Check-in is unavailable.'
      : null;

    let windowStatusText = 'Window Open';
    if (isBeforeWindow) {
      windowStatusText = `Opens at ${config.checkInStartTime}`;
    } else if (isWindowClosed) {
      windowStatusText = `Closed at ${config.checkInEndTime}`;
    } else {
      windowStatusText = `Open until ${config.checkInEndTime}`;
    }

    return sendSuccess(res, 200, 'Today attendance status fetched', {
      date: todayUTC,
      status,
      absenceType,
      dailyDeduction,
      checkIn,
      checkInFormatted,
      remarks,
      canCheckIn,
      alreadyCheckedIn,
      isOnApprovedLeave,
      leaveMessage,
      leaveDetails: activeApprovedLeave || todayApprovedLeave || null,
      pendingLeaveDetails: pendingLeave || null,
      window: {
        startTime: config.checkInStartTime,
        endTime: config.checkInEndTime,
        timeZone: config.timeZone,
        isOpen: isWindowOpen,
        isBefore: isBeforeWindow,
        isClosed: isWindowClosed,
        statusText: windowStatusText,
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get daily attendance for non-teaching staff (Staff Directory + Attendance)
 *          For HOD: restricted to own department only
 *          For Admin: institute-wide across all departments with filters
 * @route   GET /api/attendance/daily-staff
 * @access  Private (HOD, Admin)
 */
const getDailyStaffAttendance = async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    if (userRole !== 'HOD' && userRole !== 'Admin') {
      return sendError(res, 403, 'Access denied. Only HOD and Admin can access daily staff attendance.');
    }

    const { date, department, status, search } = req.query;
    const now = new Date();
    const todayUTC = normalizeDateToUTC(now);
    const targetDate = date ? normalizeDateToUTC(date) : todayUTC;
    const config = getAttendanceConfig();

    const isTargetToday = targetDate.getTime() === todayUTC.getTime();
    const isTargetPast = targetDate < todayUTC;
    const isWindowClosed = isTargetPast || (isTargetToday && hasCheckInWindowClosed(now));

    // If check-in window has closed for targetDate, trigger auto-absence marking
    if (isWindowClosed) {
      await markAbsenteesForDate(targetDate);
    }

    // Determine department scope
    let hodDeptId = null;
    const userFilter = {
      role: { $in: ['Staff', 'Non-Teaching Staff'] },
      isActive: true,
    };

    if (userRole === 'HOD') {
      hodDeptId = req.user.department?._id || req.user.department;
      if (!hodDeptId) {
        return sendError(res, 400, 'HOD has no department assigned.');
      }
      userFilter.department = hodDeptId;
    } else if (userRole === 'Admin') {
      if (department && department !== 'all') {
        userFilter.department = department;
      }
    }

    // Search filter (name or employeeId)
    if (search && search.trim()) {
      const term = search.trim();
      userFilter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { employeeId: { $regex: term, $options: 'i' } },
        { staffId: { $regex: term, $options: 'i' } },
      ];
    }

    // Fetch staff members
    const staffMembers = await User.find(userFilter)
      .populate('department', 'name code')
      .select('name employeeId staffId designation department email phone joiningDate basicSalary leaveBalances')
      .sort({ employeeId: 1 });

    const staffIds = staffMembers.map((s) => s._id);

    // Fetch attendance for targetDate
    const nextDate = new Date(targetDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    const attendanceRecords = await Attendance.find({
      user: { $in: staffIds },
      date: { $gte: targetDate, $lt: nextDate },
    });

    const attMap = new Map();
    attendanceRecords.forEach((a) => {
      attMap.set(a.user.toString(), a);
    });

    // Fetch approved leaves overlapping targetDate
    const approvedLeaves = await Leave.find({
      user: { $in: staffIds },
      status: 'Approved',
      fromDate: { $lt: nextDate },
      toDate: { $gte: targetDate },
    });

    const leaveMap = new Map();
    approvedLeaves.forEach((l) => {
      leaveMap.set(l.user.toString(), l);
    });

    let presentCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let pendingCount = 0;

    let items = staffMembers.map((staff) => {
      const uid = staff._id.toString();
      const att = attMap.get(uid);
      const leave = leaveMap.get(uid);

      let itemStatus = 'Pending Check-In';
      let absenceType = 'None';
      let checkIn = null;
      let checkOut = null;
      let remarks = '';
      let recordId = null;

      if (att) {
        itemStatus = att.status;
        absenceType = att.absenceType || (att.status === 'Absent' ? 'Uninformed Absence' : 'None');
        checkIn = att.checkIn;
        checkOut = att.checkOut;
        remarks = att.remarks || '';
        recordId = att._id;
      } else if (leave) {
        itemStatus = 'Leave';
        absenceType = 'None';
        remarks = `Approved ${leave.type}`;
      } else if (isWindowClosed) {
        itemStatus = 'Absent';
        absenceType = 'Uninformed Absence';
        remarks = 'Uninformed Absence: Check-in deadline (11:00 AM) passed without check-in or approved leave';
      } else {
        itemStatus = 'Pending Check-In';
        absenceType = 'None';
        remarks = 'Attendance check-in pending';
      }

      if (itemStatus === 'Absent' && absenceType === 'None') {
        absenceType = 'Uninformed Absence';
      }

      // Applicable daily salary deduction under existing policy (25 working days, capped at ₹40,000)
      const applicableSalary = Math.min(staff.basicSalary || 0, 40000);
      const dailySalary = Math.round((applicableSalary / 25) * 100) / 100;
      const dailyDeduction = itemStatus === 'Absent' ? dailySalary : 0;

      if (itemStatus === 'Present') presentCount++;
      else if (itemStatus === 'Absent') absentCount++;
      else if (itemStatus === 'Leave') leaveCount++;
      else if (itemStatus === 'Pending Check-In') pendingCount++;

      return {
        _id: staff._id,
        recordId,
        user: {
          _id: staff._id,
          name: staff.name,
          employeeId: staff.employeeId || staff.staffId,
          staffId: staff.staffId,
          designation: staff.designation || 'Staff',
          department: staff.department,
          email: staff.email,
          phone: staff.phone,
          joiningDate: staff.joiningDate,
          basicSalary: staff.basicSalary,
          leaveBalances: staff.leaveBalances,
        },
        name: staff.name,
        employeeId: staff.employeeId || staff.staffId,
        department: staff.department,
        designation: staff.designation || 'Staff',
        date: targetDate,
        dateFormatted: targetDate.toISOString().split('T')[0],
        checkIn,
        checkInFormatted: checkIn ? formatTime12Hour(checkIn) : '—',
        checkOut,
        status: itemStatus,
        absenceType,
        dailyDeduction,
        remarks,
      };
    });

    // Apply status filter if provided
    if (status && status !== 'all') {
      items = items.filter((item) => item.status.toLowerCase() === status.toLowerCase());
    }

    return sendSuccess(res, 200, 'Daily staff attendance fetched successfully', {
      date: targetDate,
      dateFormatted: targetDate.toISOString().split('T')[0],
      totalStaff: staffMembers.length,
      filteredCount: items.length,
      presentCount,
      absentCount,
      leaveCount,
      pendingCount,
      window: {
        startTime: config.checkInStartTime,
        endTime: config.checkInEndTime,
        timeZone: config.timeZone,
        isClosed: isWindowClosed,
      },
      records: items,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get attendance configuration
 * @route   GET /api/attendance/config
 * @access  Private
 */
const getAttendanceConfigEndpoint = async (req, res) => {
  try {
    const config = getAttendanceConfig();
    return sendSuccess(res, 200, 'Attendance config fetched', { config });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Update attendance configuration (Admin only)
 * @route   PUT /api/attendance/config
 * @access  Private (Admin)
 */
const updateAttendanceConfigEndpoint = async (req, res) => {
  try {
    const updated = updateAttendanceConfig(req.body);
    return sendSuccess(res, 200, 'Attendance config updated successfully', { config: updated });
  } catch (error) {
    return sendError(res, 400, error.message);
  }
};

/**
 * @desc    Trigger absence processing for a given date or today (Admin only)
 * @route   POST /api/attendance/process-absentees
 * @access  Private (Admin)
 */
const processAbsenteesEndpoint = async (req, res) => {
  try {
    const { date } = req.body || {};
    const targetDate = date ? new Date(date) : new Date();
    const result = await markAbsenteesForDate(targetDate);
    return sendSuccess(res, 200, `Absence processing completed for date: ${targetDate.toISOString().split('T')[0]}`, result);
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
  calculateAttendanceStats,
  checkIn,
  getTodayAttendance,
  getDailyStaffAttendance,
  getAttendanceConfigEndpoint,
  updateAttendanceConfigEndpoint,
  markAbsenteesForDate,
  processAbsenteesEndpoint,
};
