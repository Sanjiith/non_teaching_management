const Leave = require('../models/Leave.model');
const Attendance = require('../models/Attendance.model');
const User = require('../models/User.model');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { normalizeRole } = require('../middleware/role.middleware');
const notificationService = require('../services/notification.service');

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

    const calculatedDays = calculateDays(actualStart, actualEnd, startTime, endTime);
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
    const balance = user.leaveBalances?.[balanceKey] || { total: 12, used: 0, reserved: 0 };
    const available = balance.total - balance.used - (balance.reserved || 0);

    if (totalDays > available) {
      return sendError(
        res,
        400,
        `Insufficient leave balance for ${actualType}. Available: ${available} day(s), requested: ${totalDays} day(s).`
      );
    }

    // Reserve balance temporarily until approval/rejection
    if (!user.leaveBalances) {
      user.leaveBalances = {};
    }
    if (!user.leaveBalances[balanceKey]) {
      user.leaveBalances[balanceKey] = { total: 12, used: 0, reserved: 0 };
    }
    user.leaveBalances[balanceKey].reserved = (user.leaveBalances[balanceKey].reserved || 0) + totalDays;
    user.markModified('leaveBalances');
    await user.save();

    const leave = await Leave.create({
      user: userId,
      department: user.department?._id || user.department || null,
      type: actualType,
      fromDate: normalizeDateToUTC(actualStart),
      toDate: normalizeDateToUTC(actualEnd),
      startTime: startTime || '09:00 AM',
      endTime: endTime || '05:00 PM',
      totalDays,
      reason: reason.trim(),
      status: 'Pending',
    });

    const populatedLeave = await Leave.findById(leave._id)
      .populate('user', 'name employeeId staffId designation')
      .populate('department', 'name code');

    // Notify HOD
    if (user.department) {
      const deptId = user.department._id || user.department;
      await notificationService.notifyHOD({
        departmentId: deptId,
        title: 'New Leave Request',
        message: `${user.name} applied for ${totalDays} day(s) of ${actualType}.`,
        type: 'info'
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
      .sort({ createdAt: -1 });

    if (limit) query = query.limit(parseInt(limit, 10));

    const leaves = await query;
    const user = await User.findById(userId).select('leaveBalances');

    return sendSuccess(res, 200, 'Leaves fetched successfully', {
      count: leaves.length,
      leaves,
      leaveBalances: user?.leaveBalances,
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
      .populate('approvedBy', 'name employeeId')
      .sort({ createdAt: -1 });

    if (limit) query = query.limit(parseInt(limit, 10));

    const leaves = await query;

    return sendSuccess(res, 200, 'Department leaves fetched successfully', {
      count: leaves.length,
      leaves,
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
      .populate('department', 'name code')
      .populate('approvedBy', 'name employeeId')
      .sort({ createdAt: -1 });

    if (limit) query = query.limit(parseInt(limit, 10));

    const leaves = await query;

    return sendSuccess(res, 200, 'All leaves fetched successfully', {
      count: leaves.length,
      leaves,
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

    const user = await User.findById(leave.user);
    if (!user) {
      return sendError(res, 404, 'User associated with leave not found.');
    }

    const balanceKey = user.getLeaveBalanceKey(leave.type);
    if (!user.leaveBalances) user.leaveBalances = {};
    if (!user.leaveBalances[balanceKey]) {
      user.leaveBalances[balanceKey] = { total: 12, used: 0, reserved: 0 };
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
    // Create/update attendance records for each date in the leave range to 'Leave'
    // Uses findOneAndUpdate with upsert to guarantee NO DUPLICATES!
    const start = normalizeDateToUTC(leave.fromDate);
    const end = normalizeDateToUTC(leave.toDate);

    const currentDate = new Date(start);
    const updatedAttendanceDates = [];

    while (currentDate <= end) {
      const dayDate = new Date(currentDate);

      await Attendance.findOneAndUpdate(
        { user: leave.user, date: dayDate },
        {
          user: leave.user,
          date: dayDate,
          status: 'Leave',
          remarks: `Approved ${leave.type}`,
        },
        { upsert: true, new: true, runValidators: true }
      );

      updatedAttendanceDates.push(dayDate.toISOString().split('T')[0]);
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    const populatedLeave = await Leave.findById(leave._id)
      .populate('user', 'name employeeId staffId designation')
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

module.exports = {
  applyLeave,
  getMyLeaves,
  getDepartmentLeaves,
  getAllLeaves,
  approveLeave,
  rejectLeave,
  cancelLeave,
};
