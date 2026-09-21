const Payroll = require('../models/Payroll.model');
const User = require('../models/User.model');
const Attendance = require('../models/Attendance.model');
const { computePayroll } = require('../services/payroll.service');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { normalizeRole } = require('../middleware/role.middleware');

/**
 * Builds the date range for a given month/year (UTC).
 */
const getMonthRange = (year, month) => ({
  start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
  end:   new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
});

/**
 * Fetches attendance records for a user within a month.
 */
const fetchAttendance = async (userId, year, month) => {
  const { start, end } = getMonthRange(year, month);
  return Attendance.find({
    user: userId,
    date: { $gte: start, $lte: end },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Preview payroll calculation without saving (dry run)
// @route   POST /api/payroll/preview
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const previewPayroll = async (req, res) => {
  try {
    const { userId, month, year, allowances = {}, deductions = {} } = req.body;
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    const user = await User.findById(userId).select('name employeeId staffId basicSalary department designation');
    if (!user) return sendError(res, 404, 'Staff member not found.');

    const attendanceRecords = await fetchAttendance(userId, y, m);

    const breakdown = computePayroll({
      user,
      month: m,
      year: y,
      attendanceRecords,
      holidays: [],
      allowances,
      deductions,
    });

    const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', { month: 'long', timeZone: 'UTC' });

    return sendSuccess(res, 200, 'Payroll preview calculated (not saved)', {
      preview: true,
      staff: {
        _id: user._id,
        name: user.name,
        employeeId: user.employeeId || user.staffId,
        designation: user.designation,
      },
      period: { month: m, year: y, monthName },
      breakdown,
      attendanceSummary: {
        totalRecords: attendanceRecords.length,
      },
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Generate (save) payroll for one user or all staff in a dept
// @route   POST /api/payroll/generate
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const generatePayroll = async (req, res) => {
  try {
    const requesterRole = normalizeRole(req.user.role);
    if (requesterRole !== 'Admin') {
      return sendError(res, 403, 'Access denied. Only Admin can generate payroll.');
    }

    const { userId, month, year, allowances = {}, deductions = {}, remarks = '' } = req.body;
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    // Determine target users
    let targetUsers = [];
    if (userId) {
      const u = await User.findById(userId).select('name employeeId staffId basicSalary department designation role');
      if (!u) return sendError(res, 404, 'Staff member not found.');
      targetUsers = [u];
    } else {
      // Generate for all active non-admin staff
      targetUsers = await User.find({
        role: { $in: ['Staff', 'Non-Teaching Staff', 'HOD'] },
        isActive: true,
      }).select('name employeeId staffId basicSalary department designation role');
    }

    if (targetUsers.length === 0) {
      return sendError(res, 404, 'No eligible staff found to generate payroll for.');
    }

    const results = [];
    const errors = [];

    for (const user of targetUsers) {
      try {
        // Check for existing processed/paid payroll — prevent overwrite
        const existing = await Payroll.findOne({ user: user._id, month: m, year: y });
        if (existing && existing.status !== 'Draft') {
          errors.push({
            userId: user._id,
            name: user.name,
            reason: `Payroll already ${existing.status}. Cannot regenerate.`,
          });
          continue;
        }

        const attendanceRecords = await fetchAttendance(user._id, y, m);

        const breakdown = computePayroll({
          user,
          month: m,
          year: y,
          attendanceRecords,
          holidays: [],
          allowances,
          deductions,
        });

        const payrollData = {
          user: user._id,
          month: m,
          year: y,
          basicSalary: breakdown.basicSalary,
          applicableSalary: breakdown.applicableSalary,
          totalWorkingDays: breakdown.totalWorkingDays,
          presentDays: breakdown.presentDays,
          leaveDays: breakdown.leaveDays,
          absentDays: breakdown.absentDays,
          weeklyOffDays: breakdown.weeklyOffDays,
          holidayDays: breakdown.holidayDays,
          dailySalary: breakdown.dailySalary,
          absenceDeduction: breakdown.absenceDeduction,
          allowances: breakdown.allowances,
          deductions: breakdown.deductions,
          grossSalary: breakdown.grossSalary,
          netSalary: breakdown.netSalary,
          status: 'Draft',
          generatedBy: req.user._id,
          holidays: [],
          remarks: remarks.trim(),
        };

        let payroll;
        if (existing) {
          // Overwrite existing draft
          Object.assign(existing, payrollData);
          payroll = await existing.save();
        } else {
          payroll = await Payroll.create(payrollData);
        }

        results.push({
          payrollId: payroll._id,
          userId: user._id,
          name: user.name,
          employeeId: user.employeeId || user.staffId,
          netSalary: payroll.netSalary,
          status: payroll.status,
        });
      } catch (innerErr) {
        errors.push({ userId: user._id, name: user.name, reason: innerErr.message });
      }
    }

    const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-IN', { month: 'long', timeZone: 'UTC' });

    return sendSuccess(res, 201, `Payroll generated for ${results.length} staff member(s)`, {
      period: { month: m, year: y, monthName },
      generated: results,
      errors,
      totalGenerated: results.length,
      totalErrors: errors.length,
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get list of payroll records
// @route   GET /api/payroll
// @access  Private (Admin: all, HOD: dept, Staff: redirected to /my)
// ─────────────────────────────────────────────────────────────────────────────
const getPayrollList = async (req, res) => {
  try {
    const requesterRole = normalizeRole(req.user.role);
    const { month, year, status, department, userId } = req.query;

    const filter = {};

    if (month)  filter.month = parseInt(month, 10);
    if (year)   filter.year  = parseInt(year, 10);
    if (status) filter.status = status;

    if (requesterRole === 'Admin') {
      // Admin: can filter by department or specific user
      if (userId) {
        filter.user = userId;
      } else if (department) {
        const deptUsers = await User.find({ department }).select('_id');
        filter.user = { $in: deptUsers.map((u) => u._id) };
      }
    } else if (requesterRole === 'HOD') {
      // HOD: only their department
      const deptId = req.user.department?._id || req.user.department;
      if (!deptId) return sendError(res, 400, 'HOD has no department assigned.');
      const deptUsers = await User.find({ department: deptId }).select('_id');
      filter.user = { $in: deptUsers.map((u) => u._id) };
    } else {
      // Staff: redirect to own
      return getMyPayroll(req, res);
    }

    const payrolls = await Payroll.find(filter)
      .populate({
        path: 'user',
        select: 'name employeeId staffId designation department',
        populate: { path: 'department', select: 'name code' },
      })
      .sort({ year: -1, month: -1, createdAt: -1 });

    return sendSuccess(res, 200, 'Payroll records fetched', {
      count: payrolls.length,
      payrolls,
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get logged-in staff member's own payrolls
// @route   GET /api/payroll/my
// @access  Private (Staff)
// ─────────────────────────────────────────────────────────────────────────────
const getMyPayroll = async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = { user: req.user._id };

    if (month) filter.month = parseInt(month, 10);
    if (year)  filter.year  = parseInt(year, 10);

    const payrolls = await Payroll.find(filter)
      .sort({ year: -1, month: -1 });

    return sendSuccess(res, 200, 'My payroll records fetched', {
      count: payrolls.length,
      payrolls,
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get a single payroll record with full breakdown
// @route   GET /api/payroll/:id
// @access  Private (Admin: any, HOD: dept, Staff: own only)
// ─────────────────────────────────────────────────────────────────────────────
const getPayrollById = async (req, res) => {
  try {
    const requesterRole = normalizeRole(req.user.role);

    const payroll = await Payroll.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'name employeeId staffId designation department basicSalary',
        populate: { path: 'department', select: 'name code' },
      })
      .populate('generatedBy', 'name employeeId');

    if (!payroll) return sendError(res, 404, 'Payroll record not found.');

    // Access control
    if (requesterRole === 'Staff') {
      if (payroll.user._id.toString() !== req.user._id.toString()) {
        return sendError(res, 403, 'Access denied. You can only view your own payroll.');
      }
    } else if (requesterRole === 'HOD') {
      const hodDeptId = req.user.department?._id?.toString() || req.user.department?.toString();
      const staffDeptId = payroll.user.department?._id?.toString() || payroll.user.department?.toString();
      if (!hodDeptId || hodDeptId !== staffDeptId) {
        return sendError(res, 403, 'Access denied. HOD cannot view payroll of another department.');
      }
    }

    const monthName = new Date(Date.UTC(payroll.year, payroll.month - 1, 1))
      .toLocaleString('en-IN', { month: 'long', timeZone: 'UTC' });

    return sendSuccess(res, 200, 'Payroll record fetched', {
      payroll,
      period: { month: payroll.month, year: payroll.year, monthName },
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Update payroll status (Draft → Processed → Paid)
// @route   PATCH /api/payroll/:id/status
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const updatePayrollStatus = async (req, res) => {
  try {
    const requesterRole = normalizeRole(req.user.role);
    if (requesterRole !== 'Admin') {
      return sendError(res, 403, 'Access denied. Only Admin can update payroll status.');
    }

    const { status, remarks } = req.body;
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) return sendError(res, 404, 'Payroll record not found.');

    // Enforce valid state transitions
    const validTransitions = {
      Draft: ['Processed'],
      Processed: ['Paid'],
      Paid: [],
    };
    if (!validTransitions[payroll.status].includes(status)) {
      return sendError(
        res,
        400,
        `Invalid status transition: ${payroll.status} → ${status}. Allowed: ${validTransitions[payroll.status].join(', ') || 'none'}`
      );
    }

    payroll.status = status;
    if (remarks) payroll.remarks = remarks;
    if (status === 'Paid') payroll.paidAt = new Date();

    await payroll.save();

    return sendSuccess(res, 200, `Payroll status updated to ${status}`, { payroll });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc    Get payroll summary stats (KPIs for admin dashboard)
// @route   GET /api/payroll/stats
// @access  Private (Admin)
// ─────────────────────────────────────────────────────────────────────────────
const getPayrollStats = async (req, res) => {
  try {
    const { month, year } = req.query;
    const filter = {};
    if (month) filter.month = parseInt(month, 10);
    if (year)  filter.year  = parseInt(year, 10);

    const requesterRole = normalizeRole(req.user.role);

    if (requesterRole === 'HOD') {
      const deptId = req.user.department?._id || req.user.department;
      if (deptId) {
        const deptUsers = await User.find({ department: deptId }).select('_id');
        filter.user = { $in: deptUsers.map((u) => u._id) };
      }
    }

    const payrolls = await Payroll.find(filter);

    const totalPayrolls = payrolls.length;
    const totalNetSalary = payrolls.reduce((s, p) => s + p.netSalary, 0);
    const draft     = payrolls.filter((p) => p.status === 'Draft').length;
    const processed = payrolls.filter((p) => p.status === 'Processed').length;
    const paid      = payrolls.filter((p) => p.status === 'Paid').length;

    return sendSuccess(res, 200, 'Payroll stats fetched', {
      totalPayrolls,
      totalNetSalary: parseFloat(totalNetSalary.toFixed(2)),
      draft,
      processed,
      paid,
    });
  } catch (err) {
    return sendError(res, 500, err.message);
  }
};

module.exports = {
  previewPayroll,
  generatePayroll,
  getPayrollList,
  getMyPayroll,
  getPayrollById,
  updatePayrollStatus,
  getPayrollStats,
};
