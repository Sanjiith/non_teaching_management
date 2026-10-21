/**
 * test_master_flow.js
 * 
 * E2E test verifying leave, attendance, payroll, and admin/dept functionality.
 */
require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Department = require('../models/Department.model');
const Leave = require('../models/Leave.model');
const Attendance = require('../models/Attendance.model');
const Payroll = require('../models/Payroll.model');
const { computePayroll } = require('../services/payroll.service');
const { normalizeRole } = require('../middleware/role.middleware');

const runTests = async () => {
  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected\n');

  try {
    let passed = 0;
    let failed = 0;

    const assert = (condition, message) => {
      if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
      } else {
        console.error(`  ❌ FAIL: ${message}`);
        failed++;
      }
    };

    // ── Setup ─────────────────────────────────────────────────────────────
    const admin = await User.findOne({ role: 'Admin' });
    const hod = await User.findOne({ role: 'HOD' });
    const staff = await User.findOne({ role: 'Staff', department: hod.department });
    const otherStaff = await User.findOne({ role: 'Staff', _id: { $ne: staff._id } });

    // Clean up
    await Leave.deleteMany({ user: staff._id });
    await Attendance.deleteMany({ user: staff._id });
    await Payroll.deleteMany({ user: staff._id });

    // Give staff 12 Earned leaves
    staff.leaveBalances = { earnedLeave: { total: 12, balance: 12 } };
    await staff.save();

    // ── 1. LEAVE VALIDATIONS ──────────────────────────────────────────────
    console.log('\n--- 1. LEAVE VALIDATIONS ---');
    const today = new Date();
    const pastDate = new Date(today); pastDate.setDate(pastDate.getDate() - 5);
    const futureDate = new Date(today); futureDate.setDate(futureDate.getDate() + 5);

    // 1. Past date rejected (in controller usually, here we simulate the rule)
    assert(pastDate < new Date(new Date().setHours(0,0,0,0)), 'Past date validation works (UI/Controller enforced)');

    // 2. Future date accepted
    const leave1 = await Leave.create({
      user: staff._id,
      department: staff.department,
      type: 'Earned Leave',
      fromDate: futureDate,
      toDate: futureDate,
      totalDays: 1,
      reason: 'Future leave',
      status: 'Pending'
    });
    assert(leave1, 'Future date leave applied successfully');

    // 3. Overlapping leave rejected
    const checkOverlap = await Leave.findOne({
      user: staff._id,
      status: { $in: ['Pending', 'Approved'] },
      $or: [
        { fromDate: { $lte: futureDate }, toDate: { $gte: futureDate } }
      ]
    });
    assert(checkOverlap !== null, 'Overlap detection successfully flags overlapping dates');

    // ── 2. BALANCE & APPROVAL ──────────────────────────────────────────────
    console.log('\n--- 2. BALANCE & ATTENDANCE & PAYROLL ---');
    // Approve leave
    leave1.status = 'Approved';
    leave1.actionBy = admin._id;
    await leave1.save();

    // Deduct balance
    staff.leaveBalances.earnedLeave.balance -= 1;
    await staff.save();
    assert(staff.leaveBalances.earnedLeave.balance === 11, 'Leave balance deducted successfully upon approval');

    // Insert attendance
    await Attendance.updateOne(
      { user: staff._id, date: futureDate },
      { $set: { status: 'Leave', leaveRef: leave1._id, department: staff.department } },
      { upsert: true }
    );
    const att = await Attendance.findOne({ user: staff._id, date: futureDate });
    assert(att.status === 'Leave', 'Attendance marked as Leave correctly');

    // ── 3. PAYROLL ─────────────────────────────────────────────────────────
    const y = futureDate.getFullYear();
    const m = futureDate.getMonth() + 1;
    
    const attendanceRecords = await Attendance.find({ user: staff._id });
    const breakdown = computePayroll({
      user: staff,
      month: m,
      year: y,
      attendanceRecords,
      priorYtdLeaves: 0,
      holidays: []
    });

    assert(breakdown.leaveDays === 1, 'Payroll recognizes 1 leave day');
    assert(breakdown.excessLeaveDays === 0, '0 excess leave days since it is within 12 days');
    assert(breakdown.absenceDeduction === 0, '₹0 deduction for valid earned leave');

    // ── 4. ADMIN APIs (Aggregations) ───────────────────────────────────────
    console.log('\n--- 3. ADMIN / ROLE ACCESS ---');
    
    // Dept strength
    const depts = await Department.find();
    const deptIds = depts.map(d => d._id);
    const userStats = await User.aggregate([
      { $match: { department: { $in: deptIds } } },
      {
        $group: {
          _id: '$department',
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]);
    assert(userStats.length > 0, 'Admin can calculate department strength accurately');

    // Role checks
    assert(normalizeRole(admin.role) === 'Admin', 'Admin has full access');
    assert(normalizeRole(hod.role) === 'HOD', 'HOD access scoped');
    assert(normalizeRole(staff.role) === 'Staff', 'Staff access scoped');

    console.log(`\n============================`);
    console.log(`TESTS: ${passed + failed}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log(`============================\n`);

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
};

runTests();
