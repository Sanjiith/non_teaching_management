const Leave = require('../models/Leave.model');
const Attendance = require('../models/Attendance.model');
const User = require('../models/User.model');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { normalizeRole } = require('../middleware/role.middleware');
const notificationService = require('../services/notification.service');
const { parseTimeToMinutes } = require('../validators/leave.validator');

/**
 * Returns a fresh default balance object for the given leave balance key.
 * All leave types are capped at 12 days per year for Non-Teaching Staff.
 * @param {string} balanceKey - e.g. 'casualLeave', 'medicalLeave', 'earnedLeave'
 */
const getDefaultBalance = (balanceKey) => {
  // Per policy: Casual=12, Medical=12, Earned=12
  return { total: 12, used: 0, reserved: 0 };
};

/**
 * Normalizes Date string or Date object to midnight UTC
 */
const normalizeDateToUTC = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};

/**
 * Calculates total days between two dates inclusive
 */
const calculateDays = (startInput, endInput, startTime, endTime) => {
  const start = normalizeDateToUTC(startInput);
  const end = normalizeDateToUTC(endInput);

  if (end < start) {
    throw new Error('End date cannot be earlier than start date.');
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;

  // Check if same-day half day
  if (days === 1 && startTime && endTime) {
    const s = startTime.toLowerCase();
    const e = endTime.toLowerCase();
    if ((s.includes('1:00') || s.includes('13:00')) || (e.includes('1:00') || e.includes('13:00'))) {
      return 0.5;
    }
  }

  return days;
};

/**
 * Checks whether two leave requests overlap, considering both date ranges and times.
 * Returns true if they overlap.
 *
 * Overlap logic:
 *   Two intervals [A_start, A_end] and [B_start, B_end] overlap when:
 *     A_start <= B_end  AND  A_end >= B_start
 *
 * For same-day leaves we additionally compare times.
 */
const leavesOverlap = (newStart, newEnd, newStartTime, newEndTime, existStart, existEnd, existStartTime, existEndTime) => {
  // Compare calendar dates only first
  // newStart/newEnd are already UTC-midnight Date objects
  if (newEnd < existStart || newStart > existEnd) {
    return false; // No date-range overlap at all
  }

  // Check same-day scenario: both leaves are on the exact same single day
  const newIsSingleDay = newStart.getTime() === newEnd.getTime();
  const existIsSingleDay = existStart.getTime() === existEnd.getTime();
  const singleDayMatch = newStart.getTime() === existStart.getTime();

  if (newIsSingleDay && existIsSingleDay && singleDayMatch) {
    // Both are same-day leaves on the same calendar date — compare times
    const newS = parseTimeToMinutes(newStartTime);
    const newE = parseTimeToMinutes(newEndTime);
    const exS = parseTimeToMinutes(existStartTime);
    const exE = parseTimeToMinutes(existEndTime);

    if (newS !== null && newE !== null && exS !== null && exE !== null) {
      // Time-based overlap: new.start < exist.end AND new.end > exist.start
      return newS < exE && newE > exS;
    }
  }

  // Multi-day or mixed scenario — date-range overlap already confirmed above
  return true;
};

/**
 * For a given department and date range, checks each calendar date to determine
 * if the number of distinct staff members on approved leave is >= 2.
 * Returns { requiresSubstitute: boolean, datesExceedingLimit: string[], maxApprovedOnAnyDate: number, dateCounts: Record<string, number> }
 */
const checkDepartmentLeaveLimit = async (departmentId, startDate, endDate, excludeUserId = null, excludeLeaveId = null) => {
  if (!departmentId) {
    return { requiresSubstitute: false, datesExceedingLimit: [], maxApprovedOnAnyDate: 0, dateCounts: {} };
  }

  const start = normalizeDateToUTC(startDate);
  const end = normalizeDateToUTC(endDate);

  const query = {
    department: departmentId,
    status: 'Approved',
    fromDate: { $lte: end },
    toDate: { $gte: start },
  };

  if (excludeUserId) {
    query.user = { $ne: excludeUserId };
  }
  if (excludeLeaveId) {
    query._id = { $ne: excludeLeaveId };
  }

  const approvedLeaves = await Leave.find(query).select('user fromDate toDate');

  const dateCounts = {};
  const datesExceedingLimit = [];
  let maxApprovedOnAnyDate = 0;

  const current = new Date(start);
  while (current <= end) {
    const curTime = current.getTime();
    const dateStr = current.toISOString().split('T')[0];

    const usersOnLeave = new Set();
    for (const leave of approvedLeaves) {
      const lStart = normalizeDateToUTC(leave.fromDate).getTime();
      const lEnd = normalizeDateToUTC(leave.toDate).getTime();
      if (curTime >= lStart && curTime <= lEnd) {
        usersOnLeave.add(leave.user.toString());
      }
    }

    const count = usersOnLeave.size;
    dateCounts[dateStr] = count;
    if (count > maxApprovedOnAnyDate) {
      maxApprovedOnAnyDate = count;
    }

    if (count >= 2) {
      datesExceedingLimit.push(dateStr);
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return {
    requiresSubstitute: datesExceedingLimit.length > 0,
    datesExceedingLimit,
    maxApprovedOnAnyDate,
    dateCounts,
  };
};

/**
 * @desc    Check whether a substitute is required for given dates in user's department
 * @route   GET /api/leaves/check-substitute-requirement
 * @access  Private
 */
const checkSubstituteRequirement = async (req, res) => {
  try {
    const { startDate, endDate, fromDate, toDate, department } = req.query;
    const start = startDate || fromDate;
    const end = endDate || toDate;

    if (!start || !end) {
      return sendError(res, 400, 'Start date and end date are required.');
    }

    const deptId = department || req.user.department?._id || req.user.department;
    if (!deptId) {
      return sendSuccess(res, 200, 'Department limit checked', {
        requiresSubstitute: false,
        datesExceedingLimit: [],
        maxApprovedOnAnyDate: 0,
        dateCounts: {},
      });
    }

    const result = await checkDepartmentLeaveLimit(deptId, start, end, req.user._id);

    return sendSuccess(res, 200, 'Department limit checked', result);
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get eligible non-teaching staff who can serve as a substitute for given dates
 * @route   GET /api/leaves/eligible-substitutes
 * @access  Private
 */
const getEligibleSubstitutes = async (req, res) => {
  try {
    const { startDate, endDate, fromDate, toDate } = req.query;
    const start = startDate || fromDate;
    const end = endDate || toDate;

    if (!start || !end) {
      return sendError(res, 400, 'Start date and end date are required.');
    }

    const startUTC = normalizeDateToUTC(start);
    const endUTC = normalizeDateToUTC(end);
    const applicantId = req.user._id;

    // 1. Find all active non-teaching staff members (any department), excluding applicant
    const candidateStaff = await User.find({
      _id: { $ne: applicantId },
      isActive: true,
      role: { $in: ['Staff', 'Non-Teaching Staff'] },
    })
      .select('name employeeId staffId designation department email')
      .populate('department', 'name code')
      .sort({ name: 1 });

    const candidateIds = candidateStaff.map((u) => u._id);

    // 2. Find candidates who have Approved leave overlapping [startUTC, endUTC]
    const approvedLeaves = await Leave.find({
      user: { $in: candidateIds },
      status: 'Approved',
      fromDate: { $lte: endUTC },
      toDate: { $gte: startUTC },
    }).select('user');

    const unavailableUserIds = new Set(approvedLeaves.map((l) => l.user.toString()));

    // 3. Find candidates who already have Accepted substitute duty overlapping [startUTC, endUTC]
    const activeSubAssignments = await Leave.find({
      substitute: { $in: candidateIds },
      substituteStatus: 'Accepted',
      status: { $in: ['Pending', 'Approved'] },
      fromDate: { $lte: endUTC },
      toDate: { $gte: startUTC },
    }).select('substitute');

    activeSubAssignments.forEach((l) => unavailableUserIds.add(l.substitute.toString()));

    // 4. Filter to eligible candidates
    const eligible = candidateStaff.filter((u) => !unavailableUserIds.has(u._id.toString()));

    return sendSuccess(res, 200, 'Eligible substitutes fetched', {
      count: eligible.length,
      substitutes: eligible,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Apply for leave
 * @route   POST /api/leaves
 * @access  Private (Staff)
 */
const applyLeave = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      type,
      leaveType,
      startDate,
      fromDate,
      endDate,
      toDate,
      startTime,
      endTime,
      reason,
      totalDays: customDays,
    } = req.body;

    const actualType = type || leaveType;
    const actualStart = startDate || fromDate;
    const actualEnd = endDate || toDate;

    if (!actualType || !actualStart || !actualEnd || !reason) {
      return sendError(res, 400, 'Please provide leave type, start date, end date, and reason.');
    }

    // ── BACKEND GUARD: past-date rejection ─────────────────────────────────
    const nowUTC = new Date();
    const todayUTC = new Date(
      Date.UTC(nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate())
    );
    const newFromDate = normalizeDateToUTC(actualStart);
    if (newFromDate < todayUTC) {
      return sendError(res, 400, 'Start date cannot be in the past.');
    }

    const newToDate = normalizeDateToUTC(actualEnd);
    if (newToDate < newFromDate) {
      return sendError(res, 400, 'End date cannot be before start date.');
    }

    const actualStartTime = startTime || '09:00 AM';
    const actualEndTime = endTime || '05:00 PM';

    // Same-day time validation
    if (newFromDate.getTime() === newToDate.getTime()) {
      const startMins = parseTimeToMinutes(actualStartTime);
      const endMins = parseTimeToMinutes(actualEndTime);
      if (startMins !== null && endMins !== null && startMins >= endMins) {
        return sendError(res, 400, 'For same-day leave, start time must be before end time.');
      }
    }

    // ── OVERLAP VALIDATION ─────────────────────────────────────────────────
    // Only Pending and Approved leaves are considered "active" blockers.
    const existingLeaves = await Leave.find({
      user: userId,
      status: { $in: ['Pending', 'Approved'] },
    }).select('fromDate toDate startTime endTime status');

    for (const existing of existingLeaves) {
      const exStart = normalizeDateToUTC(existing.fromDate);
      const exEnd = normalizeDateToUTC(existing.toDate);

      if (
        leavesOverlap(
          newFromDate, newToDate, actualStartTime, actualEndTime,
          exStart, exEnd, existing.startTime, existing.endTime
        )
      ) {
        return sendError(
          res,
          409,
          'You already have a leave request during this period. Please choose different dates.'
        );
      }
    }
    // ───────────────────────────────────────────────────────────────────────

    const calculatedDays = calculateDays(actualStart, actualEnd, actualStartTime, actualEndTime);
    const totalDays = customDays ? Number(customDays) : calculatedDays;

    if (totalDays <= 0) {
      return sendError(res, 400, 'Leave duration must be greater than 0.');
    }

    // Check user's leave balance
    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const balanceKey = user.getLeaveBalanceKey(actualType);
    const balance = user.leaveBalances?.[balanceKey] || getDefaultBalance(balanceKey);
    const available = balance.total - balance.used - (balance.reserved || 0);

    if (totalDays > available) {
      return sendError(
        res,
        400,
        `Insufficient leave balance for ${actualType}. Available: ${available} day(s), requested: ${totalDays} day(s).`
      );
    }

    // ── CHECK 2-STAFF DEPARTMENT LEAVE LIMIT ──────────────────────────────
    const deptId = user.department?._id || user.department;
    const limitCheck = await checkDepartmentLeaveLimit(deptId, newFromDate, newToDate, userId);

    let assignedSubstituteId = null;
    let initialSubstituteStatus = 'None';
    let requiresSubstitute = limitCheck.requiresSubstitute;
    let selectedSubstituteUser = null;

    if (requiresSubstitute) {
      const selectedSubId = req.body.substitute;
      if (!selectedSubId) {
        return sendError(
          res,
          400,
          `A substitute is required. 2 staff members in your department are already on approved leave for date(s): ${limitCheck.datesExceedingLimit.join(', ')}. Please select an eligible substitute.`
        );
      }

      if (selectedSubId.toString() === userId.toString()) {
        return sendError(res, 400, 'You cannot select yourself as a substitute.');
      }

      selectedSubstituteUser = await User.findById(selectedSubId);
      if (!selectedSubstituteUser || !selectedSubstituteUser.isActive) {
        return sendError(res, 400, 'Selected substitute not found or inactive.');
      }

      if (!['Staff', 'Non-Teaching Staff'].includes(selectedSubstituteUser.role)) {
        return sendError(res, 400, 'Substitute must be a non-teaching staff member.');
      }

      // Check substitute's availability
      const subOnLeave = await Leave.findOne({
        user: selectedSubstituteUser._id,
        status: 'Approved',
        fromDate: { $lte: newToDate },
        toDate: { $gte: newFromDate },
      });
      if (subOnLeave) {
        return sendError(
          res,
          400,
          `${selectedSubstituteUser.name} is on approved leave during this period and cannot serve as a substitute.`
        );
      }

      const subBusy = await Leave.findOne({
        substitute: selectedSubstituteUser._id,
        substituteStatus: 'Accepted',
        status: { $in: ['Pending', 'Approved'] },
        fromDate: { $lte: newToDate },
        toDate: { $gte: newFromDate },
      });
      if (subBusy) {
        return sendError(
          res,
          400,
          `${selectedSubstituteUser.name} is already committed as a substitute for another staff member during this period.`
        );
      }

      assignedSubstituteId = selectedSubstituteUser._id;
      initialSubstituteStatus = 'Pending';
    } else if (req.body.substitute) {
      // Optional substitute provided by applicant
      const subUser = await User.findById(req.body.substitute);
      if (subUser && subUser.isActive && subUser._id.toString() !== userId.toString()) {
        selectedSubstituteUser = subUser;
        assignedSubstituteId = subUser._id;
        initialSubstituteStatus = 'Pending';
      }
    }

    // Reserve balance temporarily until approval/rejection
    if (!user.leaveBalances) {
      user.leaveBalances = {};
    }
    if (!user.leaveBalances[balanceKey]) {
      user.leaveBalances[balanceKey] = getDefaultBalance(balanceKey);
    }
    user.leaveBalances[balanceKey].reserved = (user.leaveBalances[balanceKey].reserved || 0) + totalDays;
    user.markModified('leaveBalances');
    await user.save();

    const leave = await Leave.create({
      user: userId,
      department: user.department?._id || user.department || null,
      type: actualType,
      fromDate: newFromDate,
      toDate: newToDate,
      startTime: actualStartTime,
      endTime: actualEndTime,
      totalDays,
      reason: reason.trim(),
      status: 'Pending',
      requiresSubstitute,
      substitute: assignedSubstituteId,
      substituteStatus: initialSubstituteStatus,
    });

    const populatedLeave = await Leave.findById(leave._id)
      .populate('user', 'name employeeId staffId designation')
      .populate('substitute', 'name employeeId staffId designation department')
      .populate('department', 'name code');

    // Notify substitute if assigned
    if (assignedSubstituteId) {
      const fromDateStr = newFromDate.toISOString().split('T')[0];
      const toDateStr = newToDate.toISOString().split('T')[0];
      const dateRangeStr = fromDateStr === toDateStr ? fromDateStr : `${fromDateStr} to ${toDateStr}`;
      await notificationService.createNotification({
        user: assignedSubstituteId,
        title: 'Substitute Request Received',
        message: `${user.name} has requested you as a substitute for leave from ${dateRangeStr}.`,
        type: 'info',
        link: '/staff/leave',
      });
    }

    // Notify HOD
    if (user.department) {
      const deptId = user.department._id || user.department;
      const subNote = requiresSubstitute
        ? ` (Substitute requested: ${selectedSubstituteUser?.name || 'Assigned'}, awaiting acceptance)`
        : '';
      await notificationService.notifyHOD({
        departmentId: deptId,
        title: 'New Leave Request',
        message: `${user.name} applied for ${totalDays} day(s) of ${actualType}${subNote}.`,
        type: 'info',
        link: '/hod/leave',
      });
    }

    return sendSuccess(res, 201, 'Leave application submitted successfully', {
      leave: populatedLeave,
      remainingAvailable: available - totalDays,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get current staff member's leave requests & balances
 * @route   GET /api/leaves/my
 * @access  Private (Staff)
 */
const getMyLeaves = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status, limit } = req.query;

    const filter = { user: userId };
    if (status) filter.status = status;

    let query = Leave.find(filter)
      .populate('approvedBy', 'name employeeId')
      .populate('substitute', 'name employeeId staffId designation department')
      .sort({ createdAt: -1 });

    if (limit) query = query.limit(parseInt(limit, 10));

    const leaves = await query;
    const user = await User.findById(userId).select('leaveBalances');

    const totalCount = await Leave.countDocuments(filter);
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      Leave.countDocuments({ user: userId, status: 'Pending' }),
      Leave.countDocuments({ user: userId, status: 'Approved' }),
      Leave.countDocuments({ user: userId, status: 'Rejected' }),
    ]);

    return sendSuccess(res, 200, 'Leaves fetched successfully', {
      count: leaves.length,
      totalCount,
      leaves,
      leaveBalances: user?.leaveBalances,
      stats: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get department leave requests (HOD)
 * @route   GET /api/leaves/department
 * @access  Private (HOD, Admin)
 */
const getDepartmentLeaves = async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    if (userRole !== 'HOD' && userRole !== 'Admin') {
      return sendError(res, 403, 'Access denied. Only HODs or Admins can view department leave requests.');
    }

    const deptId = req.user.department?._id || req.user.department;
    if (!deptId) {
      return sendError(res, 400, 'HOD has no department assigned.');
    }

    const { status, limit } = req.query;
    const filter = { department: deptId };
    if (status) filter.status = status;

    let query = Leave.find(filter)
      .populate('user', 'name employeeId staffId designation')
      .populate('substitute', 'name employeeId staffId designation department')
      .populate('approvedBy', 'name employeeId')
      .sort({ createdAt: -1 });

    if (limit) query = query.limit(parseInt(limit, 10));

    const leaves = await query;
    const totalCount = await Leave.countDocuments(filter);
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      Leave.countDocuments({ department: deptId, status: 'Pending' }),
      Leave.countDocuments({ department: deptId, status: 'Approved' }),
      Leave.countDocuments({ department: deptId, status: 'Rejected' }),
    ]);

    return sendSuccess(res, 200, 'Department leaves fetched successfully', {
      count: leaves.length,
      totalCount,
      leaves,
      stats: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get all leave requests (Admin)
 * @route   GET /api/leaves
 * @access  Private (Admin)
 */
const getAllLeaves = async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    if (userRole === 'HOD') {
      return getDepartmentLeaves(req, res);
    }
    if (userRole !== 'Admin') {
      return sendError(res, 403, 'Access denied. Admin access required.');
    }

    const { status, department, type, limit } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (department) filter.department = department;
    if (type) filter.type = type;

    let query = Leave.find(filter)
      .populate('user', 'name employeeId staffId designation')
      .populate('substitute', 'name employeeId staffId designation department')
      .populate('department', 'name code')
      .populate('approvedBy', 'name employeeId')
      .sort({ createdAt: -1 });

    if (limit) query = query.limit(parseInt(limit, 10));

    const leaves = await query;
    const totalCount = await Leave.countDocuments(filter);
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      Leave.countDocuments({ ...filter, status: 'Pending' }),
      Leave.countDocuments({ ...filter, status: 'Approved' }),
      Leave.countDocuments({ ...filter, status: 'Rejected' }),
    ]);

    return sendSuccess(res, 200, 'All leaves fetched successfully', {
      count: leaves.length,
      totalCount,
      leaves,
      stats: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Approve leave request (HOD, Admin)
 * @route   PUT /api/leaves/:id/approve
 * @access  Private (HOD for dept, Admin)
 */
const approveLeave = async (req, res) => {
  try {
    const leaveId = req.params.id;
    const requesterRole = normalizeRole(req.user.role);

    if (requesterRole !== 'Admin' && requesterRole !== 'HOD') {
      return sendError(res, 403, 'Access denied. Only HOD or Admin can approve leave requests.');
    }

    const leave = await Leave.findById(leaveId);
    if (!leave) {
      return sendError(res, 404, 'Leave request not found.');
    }

    // Department isolation: HOD cannot approve leave of another department
    if (requesterRole === 'HOD') {
      const hodDeptId = req.user.department?._id?.toString() || req.user.department?.toString();
      const leaveDeptId = leave.department?._id?.toString() || leave.department?.toString();
      if (!hodDeptId || hodDeptId !== leaveDeptId) {
        return sendError(res, 403, 'Access denied. HOD cannot access or approve leave requests from another department.');
      }
    }

    if (leave.status !== 'Pending') {
      return sendError(res, 400, `Cannot approve leave with status '${leave.status}'.`);
    }

    // ── REQUIREMENT 6 & 7: Revalidate department leave count & substitute requirement ──
    const limitCheck = await checkDepartmentLeaveLimit(
      leave.department?._id || leave.department,
      leave.fromDate,
      leave.toDate,
      leave.user,
      leave._id
    );

    const requiresSub = leave.requiresSubstitute || limitCheck.requiresSubstitute;

    if (requiresSub) {
      if (!leave.substitute) {
        return sendError(
          res,
          400,
          `Cannot approve leave request. 2 staff members in this department are already on approved leave for date(s): ${limitCheck.datesExceedingLimit.join(', ')}. A substitute must be assigned and accepted before approval.`
        );
      }
      if (leave.substituteStatus !== 'Accepted') {
        return sendError(
          res,
          400,
          `Cannot approve leave request. The selected substitute has not accepted the request (Current substitute status: ${leave.substituteStatus}).`
        );
      }
    }

    const user = await User.findById(leave.user);
    if (!user) {
      return sendError(res, 404, 'User associated with leave not found.');
    }

    const balanceKey = user.getLeaveBalanceKey(leave.type);
    if (!user.leaveBalances) user.leaveBalances = {};
    if (!user.leaveBalances[balanceKey]) {
      user.leaveBalances[balanceKey] = getDefaultBalance(balanceKey);
    }

    // Deduct leave balance permanently and release reserved
    user.leaveBalances[balanceKey].used = (user.leaveBalances[balanceKey].used || 0) + leave.totalDays;
    user.leaveBalances[balanceKey].reserved = Math.max(0, (user.leaveBalances[balanceKey].reserved || 0) - leave.totalDays);
    user.markModified('leaveBalances');
    await user.save();

    // Update leave record status
    leave.status = 'Approved';
    leave.approvedBy = req.user._id;
    leave.approvedAt = new Date();
    leave.approvalRemarks = req.body.remarks || req.body.approvalRemarks || 'Approved';
    await leave.save();

    // ─── SOURCE OF TRUTH PROPAGATION: APPROVED LEAVE → ATTENDANCE ─────────
    // For each calendar date in the leave range, upsert an attendance record
    // with status 'Leave'.  We use $set so existing fields (checkIn, checkOut,
    // shift) are preserved on UPDATE, and $setOnInsert to set user/date on INSERT.
    // The compound unique index {user, date} prevents duplicate documents.
    const start = normalizeDateToUTC(leave.fromDate);
    const end   = normalizeDateToUTC(leave.toDate);

    const currentDate = new Date(start);
    const updatedAttendanceDates = [];

    while (currentDate <= end) {
      const dayDate = new Date(currentDate);

      await Attendance.findOneAndUpdate(
        { user: leave.user, date: dayDate },
        {
          $set: {
            status: 'Leave',
            remarks: `Approved ${leave.type} (Leave ID: ${leave._id})`,
          },
          $setOnInsert: {
            user: leave.user,
            date: dayDate,
          },
        },
        { upsert: true, new: true, runValidators: true }
      );

      updatedAttendanceDates.push(dayDate.toISOString().split('T')[0]);
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    const populatedLeave = await Leave.findById(leave._id)
      .populate('user', 'name employeeId staffId designation')
      .populate('substitute', 'name employeeId staffId designation department')
      .populate('approvedBy', 'name employeeId');

    // Notify Staff
    await notificationService.createNotification({
      user: leave.user,
      title: 'Leave Approved',
      message: `Your ${leave.type} request has been approved.`,
      type: 'success'
    });

    return sendSuccess(res, 200, 'Leave approved successfully and attendance updated', {
      leave: populatedLeave,
      attendanceUpdated: updatedAttendanceDates,
      updatedBalances: user.leaveBalances,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Reject leave request (HOD, Admin)
 * @route   PUT /api/leaves/:id/reject
 * @access  Private (HOD for dept, Admin)
 */
const rejectLeave = async (req, res) => {
  try {
    const leaveId = req.params.id;
    const requesterRole = normalizeRole(req.user.role);

    if (requesterRole !== 'Admin' && requesterRole !== 'HOD') {
      return sendError(res, 403, 'Access denied. Only HOD or Admin can reject leave requests.');
    }

    const leave = await Leave.findById(leaveId);
    if (!leave) {
      return sendError(res, 404, 'Leave request not found.');
    }

    // Department isolation: HOD cannot reject leave of another department
    if (requesterRole === 'HOD') {
      const hodDeptId = req.user.department?._id?.toString() || req.user.department?.toString();
      const leaveDeptId = leave.department?._id?.toString() || leave.department?.toString();
      if (!hodDeptId || hodDeptId !== leaveDeptId) {
        return sendError(res, 403, 'Access denied. HOD cannot access or reject leave requests from another department.');
      }
    }

    if (leave.status !== 'Pending') {
      return sendError(res, 400, `Cannot reject leave with status '${leave.status}'.`);
    }

    // ── REQUIREMENT 6: The HOD must not be allowed to approve or reject the leave until the selected substitute accepts the request ──
    if (leave.requiresSubstitute && leave.substituteStatus !== 'Accepted') {
      return sendError(
        res,
        400,
        `Cannot reject leave request while substitute request is ${leave.substituteStatus || 'pending'}. The substitute must accept the request before HOD review.`
      );
    }

    const user = await User.findById(leave.user);
    if (user && user.leaveBalances) {
      const balanceKey = user.getLeaveBalanceKey(leave.type);
      if (user.leaveBalances[balanceKey]) {
        // Release reserved balance
        user.leaveBalances[balanceKey].reserved = Math.max(
          0,
          (user.leaveBalances[balanceKey].reserved || 0) - leave.totalDays
        );
        user.markModified('leaveBalances');
        await user.save();
      }
    }

    leave.status = 'Rejected';
    leave.approvedBy = req.user._id;
    leave.approvedAt = new Date();
    leave.approvalRemarks = req.body.remarks || req.body.approvalRemarks || 'Rejected';
    await leave.save();

    const populatedLeave = await Leave.findById(leave._id)
      .populate('user', 'name employeeId staffId designation')
      .populate('substitute', 'name employeeId staffId designation department')
      .populate('approvedBy', 'name employeeId');

    // Notify Staff
    await notificationService.createNotification({
      user: leave.user,
      title: 'Leave Rejected',
      message: `Your ${leave.type} request was rejected.`,
      type: 'error'
    });

    return sendSuccess(res, 200, 'Leave request rejected and reserved balance restored', {
      leave: populatedLeave,
      updatedBalances: user?.leaveBalances,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Cancel leave request (Staff self)
 * @route   PUT /api/leaves/:id/cancel
 * @access  Private (Staff, Admin)
 */
const cancelLeave = async (req, res) => {
  try {
    const leaveId = req.params.id;
    const leave = await Leave.findById(leaveId);

    if (!leave) {
      return sendError(res, 404, 'Leave request not found.');
    }

    const requesterRole = normalizeRole(req.user.role);
    if (requesterRole === 'Staff' && req.user._id.toString() !== leave.user.toString()) {
      return sendError(res, 403, 'Access denied. You can only cancel your own leave requests.');
    }

    if (leave.status === 'Cancelled' || leave.status === 'Rejected') {
      return sendError(res, 400, `Leave is already ${leave.status.toLowerCase()}.`);
    }

    const user = await User.findById(leave.user);
    const balanceKey = user ? user.getLeaveBalanceKey(leave.type) : null;

    if (user && balanceKey && user.leaveBalances?.[balanceKey]) {
      if (leave.status === 'Pending') {
        // Release reserved balance
        user.leaveBalances[balanceKey].reserved = Math.max(
          0,
          (user.leaveBalances[balanceKey].reserved || 0) - leave.totalDays
        );
      } else if (leave.status === 'Approved') {
        // Refund used balance
        user.leaveBalances[balanceKey].used = Math.max(
          0,
          (user.leaveBalances[balanceKey].used || 0) - leave.totalDays
        );

        // Remove the generated Leave attendance records
        const start = normalizeDateToUTC(leave.fromDate);
        const end = normalizeDateToUTC(leave.toDate);
        await Attendance.deleteMany({
          user: leave.user,
          date: { $gte: start, $lte: end },
          status: 'Leave',
        });
      }
      user.markModified('leaveBalances');
      await user.save();
    }

    leave.status = 'Cancelled';
    leave.approvalRemarks = req.body.remarks || 'Cancelled by staff';
    await leave.save();

    // Notify HOD if staff cancelled their leave
    if (user && user.department) {
      const deptId = user.department._id || user.department;
      await notificationService.notifyHOD({
        departmentId: deptId,
        title: 'Leave Cancelled',
        message: `${user.name} cancelled their ${leave.type}.`,
        type: 'warning'
      });
    }

    return sendSuccess(res, 200, 'Leave request cancelled successfully', {
      leave,
      updatedBalances: user?.leaveBalances,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get substitute requests assigned to the logged-in staff member
 * @route   GET /api/leaves/substitute-requests
 * @access  Private (Staff)
 */
const getMySubstituteRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const { status } = req.query;

    const filter = {
      substitute: userId,
      substituteStatus: { $ne: 'None' },
    };

    if (status) {
      filter.substituteStatus = status;
    }

    const requests = await Leave.find(filter)
      .populate('user', 'name employeeId staffId designation department email')
      .populate('department', 'name code')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Substitute requests fetched successfully', {
      count: requests.length,
      requests,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Accept or reject a substitute request (Staff)
 * @route   PUT /api/leaves/:id/substitute-respond
 * @access  Private (Staff)
 */
const respondToSubstituteRequest = async (req, res) => {
  try {
    const leaveId = req.params.id;
    const { action, remarks } = req.body;

    if (!['accept', 'reject'].includes(action)) {
      return sendError(res, 400, "Action must be either 'accept' or 'reject'.");
    }

    const leave = await Leave.findById(leaveId)
      .populate('user', 'name employeeId department')
      .populate('department', 'name code');

    if (!leave) {
      return sendError(res, 404, 'Leave request not found.');
    }

    if (!leave.substitute || leave.substitute.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Access denied. You are not the assigned substitute for this leave request.');
    }

    if (leave.status !== 'Pending') {
      return sendError(res, 400, `Cannot respond to substitute request for a leave that is ${leave.status.toLowerCase()}.`);
    }

    const fromDateStr = new Date(leave.fromDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    const toDateStr = new Date(leave.toDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    const dateRangeStr = fromDateStr === toDateStr ? fromDateStr : `${fromDateStr} – ${toDateStr}`;

    if (action === 'accept') {
      leave.substituteStatus = 'Accepted';
      leave.substituteActionAt = new Date();
      leave.substituteRemarks = (remarks || 'Accepted by substitute').trim();
      await leave.save();

      // Notify Applicant
      await notificationService.createNotification({
        user: leave.user._id,
        title: 'Substitute Request Accepted',
        message: `${req.user.name} accepted your substitute request for leave (${dateRangeStr}). Your request is now ready for HOD review.`,
        type: 'success',
        link: '/staff/leave',
      });

      // Notify HOD
      const deptId = leave.department?._id || leave.department || leave.user.department;
      if (deptId) {
        await notificationService.notifyHOD({
          departmentId: deptId,
          title: 'Substitute Accepted',
          message: `${req.user.name} accepted substitute duty for ${leave.user.name}'s leave (${dateRangeStr}). Ready for review.`,
          type: 'info',
          link: '/hod/leave',
        });
      }

      return sendSuccess(res, 200, 'Substitute request accepted successfully', { leave });
    } else {
      leave.substituteStatus = 'Rejected';
      leave.substituteActionAt = new Date();
      leave.substituteRemarks = (remarks || 'Declined by substitute').trim();
      await leave.save();

      // Notify Applicant
      await notificationService.createNotification({
        user: leave.user._id,
        title: 'Substitute Request Declined',
        message: `${req.user.name} declined your substitute request for leave (${dateRangeStr}). Please select another eligible substitute.`,
        type: 'warning',
        link: '/staff/leave',
      });

      return sendSuccess(res, 200, 'Substitute request declined', { leave });
    }
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Reassign an eligible substitute when the previous substitute declined
 * @route   PUT /api/leaves/:id/reassign-substitute
 * @access  Private (Staff)
 */
const reassignSubstitute = async (req, res) => {
  try {
    const leaveId = req.params.id;
    const { substitute: newSubstituteId } = req.body;

    if (!newSubstituteId) {
      return sendError(res, 400, 'New substitute ID is required.');
    }

    const leave = await Leave.findById(leaveId);
    if (!leave) {
      return sendError(res, 404, 'Leave request not found.');
    }

    if (leave.user.toString() !== req.user._id.toString()) {
      return sendError(res, 403, 'Access denied. You can only update substitute for your own leave request.');
    }

    if (leave.status !== 'Pending') {
      return sendError(res, 400, `Cannot reassign substitute for leave with status '${leave.status}'.`);
    }

    if (leave.substituteStatus !== 'Rejected') {
      return sendError(res, 400, 'Can only reassign a substitute when the current substitute request was declined.');
    }

    if (newSubstituteId.toString() === req.user._id.toString()) {
      return sendError(res, 400, 'You cannot select yourself as a substitute.');
    }

    // Validate new substitute
    const newSubUser = await User.findById(newSubstituteId);
    if (!newSubUser || !newSubUser.isActive) {
      return sendError(res, 400, 'Selected substitute not found or inactive.');
    }

    if (!['Staff', 'Non-Teaching Staff'].includes(newSubUser.role)) {
      return sendError(res, 400, 'Substitute must be a non-teaching staff member.');
    }

    // Check availability
    const subOnLeave = await Leave.findOne({
      user: newSubUser._id,
      status: 'Approved',
      fromDate: { $lte: leave.toDate },
      toDate: { $gte: leave.fromDate },
    });
    if (subOnLeave) {
      return sendError(
        res,
        400,
        `${newSubUser.name} is on approved leave during this period and cannot serve as a substitute.`
      );
    }

    const subBusy = await Leave.findOne({
      substitute: newSubUser._id,
      substituteStatus: 'Accepted',
      status: { $in: ['Pending', 'Approved'] },
      fromDate: { $lte: leave.toDate },
      toDate: { $gte: leave.fromDate },
    });
    if (subBusy) {
      return sendError(
        res,
        400,
        `${newSubUser.name} is already committed as a substitute for another staff member during this period.`
      );
    }

    // Update leave
    leave.substitute = newSubUser._id;
    leave.substituteStatus = 'Pending';
    leave.substituteRemarks = '';
    leave.substituteActionAt = null;
    await leave.save();

    const fromDateStr = new Date(leave.fromDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    const toDateStr = new Date(leave.toDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    const dateRangeStr = fromDateStr === toDateStr ? fromDateStr : `${fromDateStr} – ${toDateStr}`;

    // Notify new substitute
    await notificationService.createNotification({
      user: newSubUser._id,
      title: 'Substitute Request Received',
      message: `${req.user.name} has requested you as a substitute for leave from ${dateRangeStr}.`,
      type: 'info',
      link: '/staff/leave',
    });

    // Notify HOD
    const deptId = leave.department || req.user.department?._id || req.user.department;
    if (deptId) {
      await notificationService.notifyHOD({
        departmentId: deptId,
        title: 'Substitute Reassigned',
        message: `${req.user.name} selected a new substitute (${newSubUser.name}) for their leave. Awaiting substitute acceptance.`,
        type: 'info',
        link: '/hod/leave',
      });
    }

    const populatedLeave = await Leave.findById(leave._id)
      .populate('user', 'name employeeId staffId designation')
      .populate('substitute', 'name employeeId staffId designation department')
      .populate('department', 'name code');

    return sendSuccess(res, 200, 'Substitute reassigned successfully and request sent', { leave: populatedLeave });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  applyLeave,
  getMyLeaves,
  getDepartmentLeaves,
  getAllLeaves,
  approveLeave,
  rejectLeave,
  cancelLeave,
  checkSubstituteRequirement,
  getEligibleSubstitutes,
  getMySubstituteRequests,
  respondToSubstituteRequest,
  reassignSubstitute,
  checkDepartmentLeaveLimit,
};
