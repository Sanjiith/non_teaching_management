/**
 * Report Controller
 * Provides aggregate data for Admin, HOD, and Staff reports.
 * All data comes from real database records — no hardcoded values.
 */

const Attendance  = require('../models/Attendance.model');
const Leave       = require('../models/Leave.model');
const Payroll     = require('../models/Payroll.model');
const Schedule    = require('../models/Schedule.model');
const User        = require('../models/User.model');
const Department  = require('../models/Department.model');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// ── helpers ──────────────────────────────────────────────────────────────────

const buildDateRange = (month, year) => {
  if (!year) return null;
  const y = parseInt(year, 10);
  if (month) {
    const m = parseInt(month, 10);
    return {
      $gte: new Date(Date.UTC(y, m - 1, 1)),
      $lte: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
    };
  }
  return {
    $gte: new Date(Date.UTC(y, 0, 1)),
    $lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
  };
};

const calcAttendanceStats = (records) => {
  const counts = { Present: 0, Absent: 0, Leave: 0, Holiday: 0, 'Weekly Off': 0, 'On-Leave': 0 };
  const leaveGroups = new Set();
  const staffOnLeaveSet = new Set();

  records.forEach((r) => {
    if (r.status === 'Leave' || r.status === 'On-Leave') {
      const uid = r.user?._id?.toString() || r.user?.toString() || 'unknown';
      staffOnLeaveSet.add(uid);
      const match = r.remarks?.match(/Leave ID:\s*([a-f0-9]+)/i);
      const leaveKey = match ? `${uid}_${match[1]}` : `${uid}_${r.date ? new Date(r.date).toISOString().split('T')[0] : Math.random()}`;
      leaveGroups.add(leaveKey);
    } else if (counts[r.status] !== undefined) {
      counts[r.status]++;
    }
  });

  const totalLeaveDays = records.filter((r) => r.status === 'Leave' || r.status === 'On-Leave').length;
  counts.Leave = leaveGroups.size;
  counts['On-Leave'] = 0;

  const workable = counts.Present + counts.Absent;
  const attendanceRate = workable > 0 ? Number(((counts.Present / workable) * 100).toFixed(1)) : (records.length > 0 ? 100.0 : 0);
  return {
    ...counts,
    total: records.length,
    attendanceRate,
    leaveApplicationsCount: leaveGroups.size,
    staffOnLeaveCount: staffOnLeaveSet.size,
    totalLeaveDays,
  };
};

// ── ① ADMIN REPORTS ───────────────────────────────────────────────────────────

/**
 * @desc   Admin: Attendance summary (all staff), optionally filtered by month/year/dept/date
 * @route  GET /api/reports/admin/attendance
 */
exports.adminAttendanceReport = async (req, res) => {
  try {
    const { month, year, date, department } = req.query;
    const filter = {};
    if (date) {
      const d = new Date(date);
      const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      filter.date = { $gte: start, $lt: end };
    } else if (year) {
      filter.date = buildDateRange(month, year);
    }

    if (department) {
      const deptUsers = await User.find({ department, role: { $in: ['Staff', 'Non-Teaching Staff'] }, isActive: true }).select('_id');
      filter.user = { $in: deptUsers.map((u) => u._id) };
    }

    const records = await Attendance.find(filter)
      .populate({ path: 'user', select: 'name employeeId department designation', populate: { path: 'department', select: 'name code' } })
      .sort({ date: -1, 'user.name': 1 });

    const stats = calcAttendanceStats(records);

    // Per-department breakdown initialized from all departments in the DB
    const allDepartments = await Department.find({}).sort({ code: 1 });
    const allDeptUsers = await User.find({ role: { $in: ['Staff', 'Non-Teaching Staff'] }, isActive: true }).select('_id department');
    const deptBreakdown = {};

    allDepartments.forEach((d) => {
      deptBreakdown[d.code] = {
        dept: d.code,
        name: d.name,
        Present: 0,
        Absent: 0,
        Leave: 0,
        Holiday: 0,
        'Weekly Off': 0,
        total: 0,
        uniqueStaffOnLeave: new Set(),
      };
    });

    allDeptUsers.forEach((u) => {
      const d = allDepartments.find((dep) => dep._id.toString() === u.department?.toString());
      if (d && deptBreakdown[d.code]) {
        deptBreakdown[d.code].total++;
      }
    });

    records.forEach((r) => {
      const code = r.user?.department?.code;
      if (code && deptBreakdown[code]) {
        if (r.status === 'Leave' || r.status === 'On-Leave') {
          const uid = r.user?._id?.toString() || r.user?.toString();
          if (uid) deptBreakdown[code].uniqueStaffOnLeave.add(uid);
        } else if (deptBreakdown[code][r.status] !== undefined) {
          deptBreakdown[code][r.status]++;
        }
      }
    });

    const breakdownList = Object.values(deptBreakdown).map((item) => ({
      ...item,
      Leave: item.uniqueStaffOnLeave.size,
      uniqueStaffOnLeave: undefined,
    }));

    return sendSuccess(res, 200, 'Attendance report retrieved', {
      stats,
      departmentBreakdown: breakdownList,
      records,
      totalRecords: records.length,
    });
  } catch (err) {
    console.error('adminAttendanceReport error:', err);
    return sendError(res, 500, err.message);
  }
};

/**
 * @desc   Admin: Leave summary
 * @route  GET /api/reports/admin/leave
 */
exports.adminLeaveReport = async (req, res) => {
  try {
    const { month, year, date, department, status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    if (date) {
      const targetDate = new Date(date);
      filter.fromDate = { $lte: targetDate };
      filter.toDate = { $gte: targetDate };
    } else if (month && year) {
      const range = buildDateRange(month, year);
      filter.$or = [{ fromDate: range }, { toDate: range }];
    }
    if (department) filter.department = department;

    const leaves = await Leave.find(filter)
      .populate('user', 'name employeeId designation department')
      .populate('department', 'name code')
      .sort({ createdAt: -1 });

    const statusCounts = { Pending: 0, Approved: 0, Rejected: 0, Cancelled: 0 };
    const typeCounts = {};
    const uniqueStaffSet = new Set();
    const approvedStaffSet = new Set();
    let totalApprovedDays = 0;
    let totalCalendarDays = 0;

    leaves.forEach((l) => {
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      typeCounts[l.type] = (typeCounts[l.type] || 0) + 1;
      const uid = l.user?._id?.toString() || l.user?.toString();
      if (uid) uniqueStaffSet.add(uid);
      if (l.status === 'Approved') {
        if (uid) approvedStaffSet.add(uid);
        totalApprovedDays += l.totalDays || 0;
      }
      totalCalendarDays += l.totalDays || 0;
    });

    return sendSuccess(res, 200, 'Leave report retrieved', {
      stats: {
        totalApplications: leaves.length,
        totalStaffCount: uniqueStaffSet.size,
        staffOnLeaveCount: approvedStaffSet.size,
        statusCounts,
        typeCounts,
        totalApprovedDays,
        totalCalendarDays,
      },
      leaves,
    });
  } catch (err) {
    console.error('adminLeaveReport error:', err);
    return sendError(res, 500, err.message);
  }
};

/**
 * @desc   Admin: Payroll summary
 * @route  GET /api/reports/admin/payroll
 */
exports.adminPayrollReport = async (req, res) => {
  try {
    const { month, year, department } = req.query;
    const filter = {};
    if (month) filter.month = parseInt(month, 10);
    if (year) filter.year = parseInt(year, 10);

    const payrolls = await Payroll.find(filter)
      .populate({ path: 'user', select: 'name employeeId designation department', populate: { path: 'department', select: 'name code' } })
      .sort({ year: -1, month: -1 });

    const filtered = department
      ? payrolls.filter((p) => p.user?.department?._id?.toString() === department || p.user?.department?.code === department)
      : payrolls;

    const statusCounts = { Draft: 0, Processed: 0, Paid: 0 };
    let totalGross = 0, totalNet = 0, totalDeductions = 0;

    filtered.forEach((p) => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
      totalGross += p.grossSalary || 0;
      totalNet += p.netSalary || 0;
      totalDeductions += (p.grossSalary - p.netSalary) || 0;
    });

    return sendSuccess(res, 200, 'Payroll report retrieved', {
      stats: {
        totalRecords: filtered.length,
        statusCounts,
        totalGrossSalary: totalGross,
        totalNetSalary: totalNet,
        totalDeductions,
      },
      payrolls: filtered,
    });
  } catch (err) {
    console.error('adminPayrollReport error:', err);
    return sendError(res, 500, err.message);
  }
};

/**
 * @desc   Admin: Schedule/Shift summary
 * @route  GET /api/reports/admin/schedule
 */
exports.adminScheduleReport = async (req, res) => {
  try {
    const { month, year, department } = req.query;
    const filter = {};
    if (month && year) filter.date = buildDateRange(month, year);
    if (department) filter.department = department;

    const schedules = await Schedule.find(filter)
      .populate('staff', 'name employeeId designation')
      .populate('department', 'name code')
      .populate('shift', 'name startTime endTime workingHours')
      .sort({ date: -1 });

    const statusCounts = {};
    schedules.forEach((s) => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });

    return sendSuccess(res, 200, 'Schedule report retrieved', {
      stats: { totalSchedules: schedules.length, statusCounts },
      schedules,
    });
  } catch (err) {
    console.error('adminScheduleReport error:', err);
    return sendError(res, 500, err.message);
  }
};

// ── ② HOD REPORTS ────────────────────────────────────────────────────────────

/**
 * @desc   HOD: Department attendance report
 * @route  GET /api/reports/hod/attendance
 */
exports.hodAttendanceReport = async (req, res) => {
  try {
    const deptId = req.user.department?._id || req.user.department;
    if (!deptId) return sendError(res, 400, 'HOD department not assigned');

    const { month, year } = req.query;
    const deptUsers = await User.find({ department: deptId, role: 'Staff', isActive: true }).select('_id');
    const filter = { user: { $in: deptUsers.map((u) => u._id) } };
    if (year) filter.date = buildDateRange(month, year);

    const records = await Attendance.find(filter)
      .populate('user', 'name employeeId designation')
      .sort({ date: -1 });

    const stats = calcAttendanceStats(records);

    // Per-staff breakdown
    const staffBreakdown = {};
    records.forEach((r) => {
      const uid = r.user?._id?.toString();
      if (!staffBreakdown[uid]) {
        staffBreakdown[uid] = {
          id: uid,
          name: r.user?.name,
          employeeId: r.user?.employeeId,
          designation: r.user?.designation,
          Present: 0, Absent: 0, Leave: 0, Holiday: 0, 'Weekly Off': 0, total: 0,
        };
      }
      staffBreakdown[uid].total++;
      if (staffBreakdown[uid][r.status] !== undefined) staffBreakdown[uid][r.status]++;
    });

    return sendSuccess(res, 200, 'Department attendance report retrieved', {
      stats,
      staffBreakdown: Object.values(staffBreakdown),
      totalStaff: deptUsers.length,
    });
  } catch (err) {
    console.error('hodAttendanceReport error:', err);
    return sendError(res, 500, err.message);
  }
};

/**
 * @desc   HOD: Department leave report
 * @route  GET /api/reports/hod/leave
 */
exports.hodLeaveReport = async (req, res) => {
  try {
    const deptId = req.user.department?._id || req.user.department;
    if (!deptId) return sendError(res, 400, 'HOD department not assigned');

    const { month, year, date, status } = req.query;
    const filter = { department: deptId };
    if (status) filter.status = status;
    if (date) {
      const targetDate = new Date(date);
      filter.fromDate = { $lte: targetDate };
      filter.toDate = { $gte: targetDate };
    } else if (month && year) {
      const range = buildDateRange(month, year);
      filter.$or = [{ fromDate: range }, { toDate: range }];
    }

    const leaves = await Leave.find(filter)
      .populate('user', 'name employeeId designation')
      .sort({ createdAt: -1 });

    const statusCounts = { Pending: 0, Approved: 0, Rejected: 0, Cancelled: 0 };
    const typeCounts = {};
    const uniqueStaffSet = new Set();
    const approvedStaffSet = new Set();
    let totalApprovedDays = 0;
    let totalCalendarDays = 0;

    leaves.forEach((l) => {
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      typeCounts[l.type] = (typeCounts[l.type] || 0) + 1;
      const uid = l.user?._id?.toString() || l.user?.toString();
      if (uid) uniqueStaffSet.add(uid);
      if (l.status === 'Approved') {
        if (uid) approvedStaffSet.add(uid);
        totalApprovedDays += l.totalDays || 0;
      }
      totalCalendarDays += l.totalDays || 0;
    });

    return sendSuccess(res, 200, 'Department leave report retrieved', {
      stats: {
        totalApplications: leaves.length,
        totalStaffCount: uniqueStaffSet.size,
        staffOnLeaveCount: approvedStaffSet.size,
        statusCounts,
        typeCounts,
        totalApprovedDays,
        totalCalendarDays,
      },
      leaves,
    });
  } catch (err) {
    console.error('hodLeaveReport error:', err);
    return sendError(res, 500, err.message);
  }
};

/**
 * @desc   HOD: Department schedule report
 * @route  GET /api/reports/hod/schedule
 */
exports.hodScheduleReport = async (req, res) => {
  try {
    const deptId = req.user.department?._id || req.user.department;
    if (!deptId) return sendError(res, 400, 'HOD department not assigned');

    const { month, year } = req.query;
    const filter = { department: deptId };
    if (month && year) filter.date = buildDateRange(month, year);

    const schedules = await Schedule.find(filter)
      .populate('staff', 'name employeeId designation')
      .populate('shift', 'name startTime endTime workingHours')
      .sort({ date: -1 });

    const statusCounts = {};
    schedules.forEach((s) => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });

    return sendSuccess(res, 200, 'Department schedule report retrieved', {
      stats: { totalSchedules: schedules.length, statusCounts },
      schedules,
    });
  } catch (err) {
    console.error('hodScheduleReport error:', err);
    return sendError(res, 500, err.message);
  }
};

// ── ③ STAFF PERSONAL REPORTS ──────────────────────────────────────────────────

/**
 * @desc   Staff: Personal attendance report
 * @route  GET /api/reports/my/attendance
 */
exports.myAttendanceReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = { user: req.user._id };
    if (month && year) filter.date = buildDateRange(month, year);

    const records = await Attendance.find(filter).sort({ date: 1 });
    const stats = calcAttendanceStats(records);

    return sendSuccess(res, 200, 'Personal attendance report retrieved', { stats, records });
  } catch (err) {
    console.error('myAttendanceReport error:', err);
    return sendError(res, 500, err.message);
  }
};

/**
 * @desc   Staff: Personal leave history
 * @route  GET /api/reports/my/leave
 */
exports.myLeaveReport = async (req, res) => {
  try {
    const { year } = req.query;
    const filter = { user: req.user._id };
    if (year) {
      const y = parseInt(year, 10);
      filter.$or = [
        { fromDate: { $gte: new Date(Date.UTC(y, 0, 1)), $lte: new Date(Date.UTC(y, 11, 31, 23, 59, 59)) } },
      ];
    }

    const leaves = await Leave.find(filter).sort({ createdAt: -1 });
    const statusCounts = { Pending: 0, Approved: 0, Rejected: 0, Cancelled: 0 };
    const typeCounts = {};
    let totalApproved = 0;
    let totalCalendarDays = 0;

    leaves.forEach((l) => {
      statusCounts[l.status] = (statusCounts[l.status] || 0) + 1;
      typeCounts[l.type] = (typeCounts[l.type] || 0) + 1;
      if (l.status === 'Approved') totalApproved += l.totalDays || 0;
      totalCalendarDays += l.totalDays || 0;
    });

    return sendSuccess(res, 200, 'Personal leave history retrieved', {
      stats: {
        totalApplications: leaves.length,
        statusCounts,
        typeCounts,
        totalApprovedDays: totalApproved,
        totalCalendarDays,
      },
      leaves,
      leaveBalances: req.user.leaveBalances,
    });
  } catch (err) {
    console.error('myLeaveReport error:', err);
    return sendError(res, 500, err.message);
  }
};

/**
 * @desc   Staff: Personal payroll history
 * @route  GET /api/reports/my/payroll
 */
exports.myPayrollReport = async (req, res) => {
  try {
    const payrolls = await Payroll.find({ user: req.user._id }).sort({ year: -1, month: -1 });
    let totalEarned = 0;
    payrolls.forEach((p) => { if (p.status === 'Paid') totalEarned += p.netSalary || 0; });

    return sendSuccess(res, 200, 'Personal payroll history retrieved', {
      stats: { totalRecords: payrolls.length, totalEarned },
      payrolls,
    });
  } catch (err) {
    console.error('myPayrollReport error:', err);
    return sendError(res, 500, err.message);
  }
};
