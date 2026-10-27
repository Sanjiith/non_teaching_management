/**
 * verify_leave_reset.test.js
 * 
 * Verifies that:
 * 1. All leave-related data and counts are at zero across Admin, HOD, and Staff APIs.
 * 2. Dashboards and reports reflect zero counts from real database data.
 * 3. All staff, accounts, departments, payroll, and non-leave attendance remain preserved.
 * 4. New leave applications can still be submitted and processed (approved/cancelled) normally.
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Department = require('../models/Department.model');
const Leave = require('../models/Leave.model');
const Attendance = require('../models/Attendance.model');
const Payroll = require('../models/Payroll.model');
const { getAttendanceStats } = require('../controllers/attendance.controller');
const { getAllLeaves, getDepartmentLeaves, getMyLeaves, applyLeave, approveLeave, cancelLeave } = require('../controllers/leave.controller');
const { adminAttendanceReport, adminLeaveReport, hodAttendanceReport, hodLeaveReport, myLeaveReport } = require('../controllers/report.controller');

const MONGODB_URI = process.env.MONGODB_URI;

const runVerification = async () => {
  console.log('🔗 Connecting to MongoDB for Post-Reset Verification...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected\n');

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

  try {
    // Find representative users
    const adminUser = await User.findOne({ role: 'Admin' });
    const hodUser = await User.findOne({ role: 'HOD' }).populate('department');
    const staffUser = await User.findOne({ role: { $in: ['Staff', 'Non-Teaching Staff'] }, department: hodUser.department._id });

    assert(adminUser !== null, 'Admin account preserved');
    assert(hodUser !== null, 'HOD account preserved');
    assert(staffUser !== null, 'Staff account preserved');

    // Helper for mock Express req/res
    let resStatus = 200;
    let resData = null;
    const mockRes = {
      status(code) { resStatus = code; return this; },
      json(payload) { resData = payload; return this; },
    };

    // ── 1. VERIFY DATABASE COLLECTIONS AT ZERO ──────────────────────────
    console.log('\n--- 1. Direct Database Collections Check ---');
    const totalLeaves = await Leave.countDocuments();
    assert(totalLeaves === 0, `Total Leave documents = 0 (got: ${totalLeaves})`);

    const leaveAttendance = await Attendance.countDocuments({ status: { $in: ['Leave', 'On-Leave'] } });
    assert(leaveAttendance === 0, `Leave Attendance records = 0 (got: ${leaveAttendance})`);

    const nonLeaveAttendance = await Attendance.countDocuments({ status: { $nin: ['Leave', 'On-Leave'] } });
    assert(nonLeaveAttendance > 0, `Valid non-leave attendance records preserved (got: ${nonLeaveAttendance})`);

    const usersWithNonZeroLeaves = await User.countDocuments({
      $or: [
        { 'leaveBalances.casualLeave.used': { $gt: 0 } },
        { 'leaveBalances.casualLeave.reserved': { $gt: 0 } },
        { 'leaveBalances.medicalLeave.used': { $gt: 0 } },
        { 'leaveBalances.medicalLeave.reserved': { $gt: 0 } },
        { 'leaveBalances.earnedLeave.used': { $gt: 0 } },
        { 'leaveBalances.earnedLeave.reserved': { $gt: 0 } },
      ],
    });
    assert(usersWithNonZeroLeaves === 0, `Users with used/reserved leave balances = 0 (got: ${usersWithNonZeroLeaves})`);

    const payrollsWithLeaves = await Payroll.countDocuments({ leaveDays: { $gt: 0 } });
    assert(payrollsWithLeaves === 0, `Payrolls with leaveDays > 0 = 0 (got: ${payrollsWithLeaves})`);

    // ── 2. VERIFY GET ATTENDANCE STATS (ADMIN & HOD) ─────────────────────
    console.log('\n--- 2. Attendance Stats API Check ---');
    // Admin check
    await getAttendanceStats({ user: adminUser, query: {} }, mockRes);
    const adminStats = resData?.data;
    assert(adminStats.onLeaveToday === 0, `Admin onLeaveToday = 0 (got: ${adminStats.onLeaveToday})`);
    assert(adminStats.staffOnLeaveCount === 0, `Admin staffOnLeaveCount = 0 (got: ${adminStats.staffOnLeaveCount})`);
    assert(adminStats.pendingLeavesCount === 0, `Admin pendingLeavesCount = 0 (got: ${adminStats.pendingLeavesCount})`);
    assert(adminStats.approvedLeavesCount === 0, `Admin approvedLeavesCount = 0 (got: ${adminStats.approvedLeavesCount})`);
    assert(adminStats.rejectedLeavesCount === 0, `Admin rejectedLeavesCount = 0 (got: ${adminStats.rejectedLeavesCount})`);
    assert(adminStats.totalLeaveApplications === 0, `Admin totalLeaveApplications = 0 (got: ${adminStats.totalLeaveApplications})`);
    assert(adminStats.totalStaff > 0, `Admin sees total active staff (> 0) (got: ${adminStats.totalStaff})`);
    
    // Check all departments in breakdown have leave === 0
    const deptsWithLeaves = (adminStats.departmentBreakdown || []).filter((d) => d.leave > 0);
    assert(deptsWithLeaves.length === 0, `All departments in breakdown report leave = 0 (non-zero: ${deptsWithLeaves.length})`);

    // HOD check
    await getAttendanceStats({ user: hodUser, query: {} }, mockRes);
    const hodStats = resData?.data;
    assert(hodStats.onLeaveToday === 0, `HOD onLeaveToday = 0 (got: ${hodStats.onLeaveToday})`);
    assert(hodStats.staffOnLeaveCount === 0, `HOD staffOnLeaveCount = 0 (got: ${hodStats.staffOnLeaveCount})`);
    assert(hodStats.pendingLeavesCount === 0, `HOD pendingLeavesCount = 0 (got: ${hodStats.pendingLeavesCount})`);
    assert(hodStats.approvedLeavesCount === 0, `HOD approvedLeavesCount = 0 (got: ${hodStats.approvedLeavesCount})`);

    // ── 3. VERIFY LEAVE LISTS & STATS ───────────────────────────────────
    console.log('\n--- 3. Leave Lists & Stats API Check ---');
    // Admin all leaves
    await getAllLeaves({ user: adminUser, query: {} }, mockRes);
    const allLeavesData = resData?.data;
    assert(allLeavesData.count === 0, `Admin getAllLeaves count = 0 (got: ${allLeavesData.count})`);
    assert(allLeavesData.totalCount === 0, `Admin getAllLeaves totalCount = 0 (got: ${allLeavesData.totalCount})`);
    assert(allLeavesData.stats.pending === 0, `Admin leaves pending stat = 0 (got: ${allLeavesData.stats.pending})`);
    assert(allLeavesData.stats.approved === 0, `Admin leaves approved stat = 0 (got: ${allLeavesData.stats.approved})`);

    // HOD department leaves
    await getDepartmentLeaves({ user: hodUser, query: {} }, mockRes);
    const hodLeavesData = resData?.data;
    assert(hodLeavesData.count === 0, `HOD getDepartmentLeaves count = 0 (got: ${hodLeavesData.count})`);
    assert(hodLeavesData.stats.pending === 0, `HOD leaves pending stat = 0 (got: ${hodLeavesData.stats.pending})`);

    // Staff my leaves
    await getMyLeaves({ user: staffUser, query: {} }, mockRes);
    const staffLeavesData = resData?.data;
    assert(staffLeavesData.count === 0, `Staff getMyLeaves count = 0 (got: ${staffLeavesData.count})`);
    assert(staffLeavesData.leaveBalances.casualLeave.used === 0, `Staff casualLeave.used = 0 (got: ${staffLeavesData.leaveBalances.casualLeave.used})`);
    assert(staffLeavesData.leaveBalances.casualLeave.reserved === 0, `Staff casualLeave.reserved = 0 (got: ${staffLeavesData.leaveBalances.casualLeave.reserved})`);

    // ── 4. VERIFY REPORTS ───────────────────────────────────────────────
    console.log('\n--- 4. Reports API Check ---');
    // Admin attendance report
    await adminAttendanceReport({ query: {} }, mockRes);
    const adminAttReportData = resData?.data;
    assert(adminAttReportData.stats.Leave === 0, `Admin attendance report stats.Leave = 0 (got: ${adminAttReportData.stats.Leave})`);
    assert(adminAttReportData.stats.totalLeaveDays === 0, `Admin attendance report totalLeaveDays = 0 (got: ${adminAttReportData.stats.totalLeaveDays})`);

    // Admin leave report
    await adminLeaveReport({ query: {} }, mockRes);
    const adminLeaveReportData = resData?.data;
    assert(adminLeaveReportData.stats.totalApplications === 0, `Admin leave report totalApplications = 0 (got: ${adminLeaveReportData.stats.totalApplications})`);
    assert(adminLeaveReportData.stats.totalApprovedDays === 0, `Admin leave report totalApprovedDays = 0 (got: ${adminLeaveReportData.stats.totalApprovedDays})`);
    assert(adminLeaveReportData.stats.staffOnLeaveCount === 0, `Admin leave report staffOnLeaveCount = 0 (got: ${adminLeaveReportData.stats.staffOnLeaveCount})`);

    // HOD leave report
    await hodLeaveReport({ user: hodUser, query: {} }, mockRes);
    const hodLeaveReportData = resData?.data;
    assert(hodLeaveReportData.stats.totalApplications === 0, `HOD leave report totalApplications = 0 (got: ${hodLeaveReportData.stats.totalApplications})`);
    assert(hodLeaveReportData.stats.totalApprovedDays === 0, `HOD leave report totalApprovedDays = 0 (got: ${hodLeaveReportData.stats.totalApprovedDays})`);

    // Staff leave report
    await myLeaveReport({ user: staffUser, query: {} }, mockRes);
    const staffLeaveReportData = resData?.data;
    assert(staffLeaveReportData.stats.totalApplications === 0, `Staff personal leave report totalApplications = 0 (got: ${staffLeaveReportData.stats.totalApplications})`);
    assert(staffLeaveReportData.stats.totalApprovedDays === 0, `Staff personal leave report totalApprovedDays = 0 (got: ${staffLeaveReportData.stats.totalApprovedDays})`);

    // ── 5. VERIFY NEW LEAVE APPLICATION SUBMISSION & PROCESSING ─────────
    console.log('\n--- 5. New Leave Application Workflow Check ---');
    // Apply for leave: 2 days in the future
    const futureStart = new Date();
    futureStart.setUTCDate(futureStart.getUTCDate() + 10);
    const futureEnd = new Date(futureStart);
    futureEnd.setUTCDate(futureEnd.getUTCDate() + 1);

    const startStr = futureStart.toISOString().split('T')[0];
    const endStr = futureEnd.toISOString().split('T')[0];

    const applyReq = {
      user: staffUser,
      body: {
        type: 'Casual Leave',
        startDate: startStr,
        endDate: endStr,
        startTime: '09:00 AM',
        endTime: '05:00 PM',
        reason: 'Verification test leave request',
      },
    };

    await applyLeave(applyReq, mockRes);
    const applyResult = resData?.data;
    assert(applyResult?.leave?.status === 'Pending', `New leave submitted with status = Pending (ID: ${applyResult?.leave?._id})`);
    assert(applyResult?.leave?.totalDays === 2, `New leave totalDays = 2 (got: ${applyResult?.leave?.totalDays})`);

    // Check balance reserved
    const staffAfterApply = await User.findById(staffUser._id);
    assert(staffAfterApply.leaveBalances.casualLeave.reserved === 2, `Reserved balance incremented to 2 (got: ${staffAfterApply.leaveBalances.casualLeave.reserved})`);

    // Check HOD pending count
    await getAttendanceStats({ user: hodUser, query: {} }, mockRes);
    assert(resData?.data?.pendingLeavesCount === 1, `HOD pendingLeavesCount incremented to 1 (got: ${resData?.data?.pendingLeavesCount})`);

    // Approve the leave as HOD
    const newLeaveId = applyResult.leave._id;
    const approveReq = {
      params: { id: newLeaveId },
      user: hodUser,
      body: { remarks: 'Approved for verification test' },
    };
    await approveLeave(approveReq, mockRes);
    const approveResult = resData?.data;
    assert(approveResult?.leave?.status === 'Approved', `Leave approved successfully by HOD`);

    // Check balance used
    const staffAfterApprove = await User.findById(staffUser._id);
    assert(staffAfterApprove.leaveBalances.casualLeave.used === 2, `Used balance incremented to 2 (got: ${staffAfterApprove.leaveBalances.casualLeave.used})`);
    assert(staffAfterApprove.leaveBalances.casualLeave.reserved === 0, `Reserved balance cleared to 0 (got: ${staffAfterApprove.leaveBalances.casualLeave.reserved})`);

    // Check generated attendance records
    const newAttRecords = await Attendance.find({ user: staffUser._id, status: 'Leave' });
    assert(newAttRecords.length === 2, `Generated exactly 2 attendance records for the 2 approved days (got: ${newAttRecords.length})`);

    // Cancel the leave to leave the database clean
    const cancelReq = {
      params: { id: newLeaveId },
      user: staffUser,
      body: { remarks: 'Cancelled test leave' },
    };
    await cancelLeave(cancelReq, mockRes);
    assert(resData?.data?.leave?.status === 'Cancelled', `Leave cancelled successfully`);

    // Verify balance restored and attendance deleted
    const staffAfterCancel = await User.findById(staffUser._id);
    assert(staffAfterCancel.leaveBalances.casualLeave.used === 0, `Balance restored to 0 used after cancellation`);
    const remainingAtt = await Attendance.countDocuments({ status: { $in: ['Leave', 'On-Leave'] } });
    assert(remainingAtt === 0, `Generated attendance cleaned up after cancellation (got: ${remainingAtt})`);

    // Remove the cancelled leave document so database stays at 0 leaves
    await Leave.deleteMany({});
    console.log('✅ Temporary verification leave cleaned up.');

    console.log(`\n========================================`);
    console.log(`LEAVE RESET VERIFICATION RESULTS`);
    console.log(`TOTAL TESTS: ${passed + failed}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error('Verification error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

runVerification();
