/**
 * day2_leave_counts.test.js
 * 
 * Comprehensive Day 2 Verification Test Suite:
 * 1. Leave application count = unique leave requests (not date count).
 * 2. Leave duration = 8 calendar days (kept separate from application & staff counts).
 * 3. One approved staff on leave on qualifying date (Oct 16) -> staffOnLeaveCount = 1.
 * 4. Three different staff on approved leave on same date -> staffOnLeaveCount = 3 (+ baseline).
 * 5. Pending request -> pending count = 1, but staffOnLeaveCount = 0.
 * 6. Rejected request -> rejected count = 1, but staffOnLeaveCount = 0.
 * 7. Admin sees institute-wide counts; HOD sees department-level counts.
 * 8. Day 1 single-row display & attendance helper consolidation remains intact.
 * 9. getAttendanceStats & report controllers return accurate metrics without hardcoded numbers.
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Department = require('../models/Department.model');
const Leave = require('../models/Leave.model');
const Attendance = require('../models/Attendance.model');
const { getAttendanceStats, calculateAttendanceStats } = require('../controllers/attendance.controller');
const { adminAttendanceReport, adminLeaveReport, hodLeaveReport } = require('../controllers/report.controller');
const { consolidateAttendanceRecords } = require('../../client/src/utils/attendanceHelper');

const MONGODB_URI = process.env.MONGODB_URI;

const runDay2Tests = async () => {
  console.log('🔗 Connecting to MongoDB...');
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
    console.log('--- Setting Up Test Fixtures ---');

    // Clean up prior test data
    const priorTestUsers = await User.find({ email: /@testday2\.bit\.edu/i });
    const priorIds = priorTestUsers.map((u) => u._id);
    await Leave.deleteMany({ user: { $in: priorIds } });
    await Attendance.deleteMany({ user: { $in: priorIds } });
    await User.deleteMany({ _id: { $in: priorIds } });
    await Department.deleteMany({ code: { $in: ['T-DEPTA', 'T-DEPTB'] } });

    // Create isolated test departments
    const deptA = await Department.create({ name: 'Test Dept Alpha', code: 'T-DEPTA' });
    const deptB = await Department.create({ name: 'Test Dept Beta', code: 'T-DEPTB' });

    // Create test admin
    const testAdmin = await User.create({
      name: 'Admin Day2 Tester',
      email: 'admin@testday2.bit.edu',
      password: 'password123',
      role: 'Admin',
      employeeId: 'ADM-D2-01',
      isActive: true,
    });

    // Create test HOD for Dept A
    const testHodA = await User.create({
      name: 'HOD Alpha',
      email: 'hod_a@testday2.bit.edu',
      password: 'password123',
      role: 'HOD',
      employeeId: 'HOD-D2-A',
      department: deptA._id,
      isActive: true,
    });

    // Create test HOD for Dept B
    const testHodB = await User.create({
      name: 'HOD Beta',
      email: 'hod_b@testday2.bit.edu',
      password: 'password123',
      role: 'HOD',
      employeeId: 'HOD-D2-B',
      department: deptB._id,
      isActive: true,
    });

    // Staff 1 & 2 in Dept A
    const staff1 = await User.create({
      name: 'Staff Alpha One',
      email: 'staff1@testday2.bit.edu',
      password: 'password123',
      role: 'Staff',
      employeeId: 'STF-D2-A1',
      department: deptA._id,
      isActive: true,
      leaveBalances: { casualLeave: { total: 20, used: 0, reserved: 0 } },
    });

    const staff2 = await User.create({
      name: 'Staff Alpha Two',
      email: 'staff2@testday2.bit.edu',
      password: 'password123',
      role: 'Staff',
      employeeId: 'STF-D2-A2',
      department: deptA._id,
      isActive: true,
      leaveBalances: { casualLeave: { total: 20, used: 0, reserved: 0 } },
    });

    // Staff 3 in Dept B
    const staff3 = await User.create({
      name: 'Staff Beta One',
      email: 'staff3@testday2.bit.edu',
      password: 'password123',
      role: 'Staff',
      employeeId: 'STF-D2-B1',
      department: deptB._id,
      isActive: true,
      leaveBalances: { casualLeave: { total: 20, used: 0, reserved: 0 } },
    });

    console.log('✅ Fixtures created successfully\n');

    // Helper for mock Express req/res
    let resData = null;
    const mockRes = {
      status(code) { return this; },
      json(payload) { resData = payload; return this; },
    };

    // ── TEST 1: One request covering Oct 14–21 -> application count = 1, calendar duration = 8 days ──
    console.log('--- TEST 1: Application Count vs. Calendar Duration ---');
    const oct14 = new Date(Date.UTC(2026, 9, 14));
    const oct21 = new Date(Date.UTC(2026, 9, 21));
    const leave1 = await Leave.create({
      user: staff1._id,
      department: deptA._id,
      type: 'Casual Leave',
      fromDate: oct14,
      toDate: oct21,
      totalDays: 8,
      reason: 'Personal work',
      status: 'Pending',
    });

    const staff1Requests = await Leave.countDocuments({ user: staff1._id });
    assert(staff1Requests === 1, `One 8-day leave request yields application count = 1 (got: ${staff1Requests})`);
    assert(leave1.totalDays === 8, `Calendar duration is separately calculated as 8 days (got: ${leave1.totalDays})`);

    // ── TEST 2: Pending request -> pending count = 1, but not counted as staff on approved leave ──
    console.log('\n--- TEST 2: Pending Request Exclusion from Approved Leave Count ---');
    const mockReqHodAOct16 = {
      user: testHodA,
      query: { date: '2026-10-16' },
    };

    await getAttendanceStats(mockReqHodAOct16, mockRes);
    const hodStatsPending = resData?.data;
    assert(hodStatsPending.pendingLeavesCount === 1, `Pending applications count = 1 in Dept A (got: ${hodStatsPending.pendingLeavesCount})`);
    assert(hodStatsPending.onLeaveToday === 0, `Pending request is NOT counted in onLeaveToday on Oct 16 (got: ${hodStatsPending.onLeaveToday})`);
    assert(hodStatsPending.staffOnLeaveCount === 0, `Pending request is NOT counted in staffOnLeaveCount on Oct 16 (got: ${hodStatsPending.staffOnLeaveCount})`);

    // ── TEST 3: Approved request on qualifying date (Oct 16) -> staff on leave count = 1 ──
    console.log('\n--- TEST 3: Approved Request on Qualifying Date ---');
    leave1.status = 'Approved';
    leave1.approvedBy = testHodA._id;
    await leave1.save();

    for (let d = 14; d <= 21; d++) {
      await Attendance.create({
        user: staff1._id,
        date: new Date(Date.UTC(2026, 9, d)),
        status: 'Leave',
        remarks: `Approved Casual Leave (Leave ID: ${leave1._id})`,
      });
    }

    await getAttendanceStats(mockReqHodAOct16, mockRes);
    const hodStatsApproved = resData?.data;
    assert(hodStatsApproved.pendingLeavesCount === 0, `After approval, pending count drops to 0 (got: ${hodStatsApproved.pendingLeavesCount})`);
    assert(hodStatsApproved.approvedLeavesCount === 1, `Approved applications count = 1 in Dept A (got: ${hodStatsApproved.approvedLeavesCount})`);
    assert(hodStatsApproved.staffOnLeaveCount === 1, `Single staff on approved 8-day leave on Oct 16 displays staffOnLeaveCount = 1, NOT 8 (got: ${hodStatsApproved.staffOnLeaveCount})`);
    assert(hodStatsApproved.onLeaveToday === 1, `onLeaveToday displays 1 (got: ${hodStatsApproved.onLeaveToday})`);

    // On a non-qualifying date (Oct 25)
    const mockReqHodAOct25 = {
      user: testHodA,
      query: { date: '2026-10-25' },
    };
    await getAttendanceStats(mockReqHodAOct25, mockRes);
    assert(resData?.data.staffOnLeaveCount === 0, `On non-qualifying date (Oct 25), staffOnLeaveCount = 0 (got: ${resData?.data.staffOnLeaveCount})`);

    // ── TEST 4: Three different staff members on approved leave on Oct 16 ──
    console.log('\n--- TEST 4: Multiple Staff with Overlapping Leaves on Same Date ---');
    // Staff 2 applies Oct 15–18 (4 days) in Dept A
    const leave2 = await Leave.create({
      user: staff2._id,
      department: deptA._id,
      type: 'Casual Leave',
      fromDate: new Date(Date.UTC(2026, 9, 15)),
      toDate: new Date(Date.UTC(2026, 9, 18)),
      totalDays: 4,
      reason: 'Personal work',
      status: 'Approved',
      approvedBy: testHodA._id,
    });
    for (let d = 15; d <= 18; d++) {
      await Attendance.create({
        user: staff2._id,
        date: new Date(Date.UTC(2026, 9, d)),
        status: 'Leave',
        remarks: `Approved Casual Leave (Leave ID: ${leave2._id})`,
      });
    }

    // In Dept A on Oct 16: Staff 1 (8 days) + Staff 2 (4 days) = 2 staff members!
    await getAttendanceStats(mockReqHodAOct16, mockRes);
    const hodStatsMulti = resData?.data;
    assert(hodStatsMulti.staffOnLeaveCount === 2, `HOD Dept A sees exactly 2 staff on leave on Oct 16, NOT 8 + 4 = 12 (got: ${hodStatsMulti.staffOnLeaveCount})`);

    // Staff 3 applies Oct 16–16 (1 day) in Dept B
    const leave3 = await Leave.create({
      user: staff3._id,
      department: deptB._id,
      type: 'Casual Leave',
      fromDate: new Date(Date.UTC(2026, 9, 16)),
      toDate: new Date(Date.UTC(2026, 9, 16)),
      totalDays: 1,
      reason: 'Medical checkup',
      status: 'Approved',
      approvedBy: testHodB._id,
    });
    await Attendance.create({
      user: staff3._id,
      date: new Date(Date.UTC(2026, 9, 16)),
      status: 'Leave',
      remarks: `Approved Casual Leave (Leave ID: ${leave3._id})`,
    });

    // In Dept B on Oct 16: Staff 3 = 1 staff member!
    const mockReqHodBOct16 = {
      user: testHodB,
      query: { date: '2026-10-16' },
    };
    await getAttendanceStats(mockReqHodBOct16, mockRes);
    assert(resData?.data.staffOnLeaveCount === 1, `HOD Dept B sees exactly 1 staff on leave on Oct 16 (got: ${resData?.data.staffOnLeaveCount})`);

    // ── TEST 5: Role-based access (HOD Dept A vs Admin) ──
    console.log('\n--- TEST 5: Role-Based Access Scoping ---');
    // HOD A still sees only 2 staff on leave in Dept A, never Dept B
    await getAttendanceStats(mockReqHodAOct16, mockRes);
    assert(resData?.data.staffOnLeaveCount === 2, `HOD Dept A is strictly isolated from Dept B (staffOnLeaveCount = 2, got: ${resData?.data.staffOnLeaveCount})`);
    assert(resData?.data.totalStaff === 2, `HOD Dept A total staff is 2 (got: ${resData?.data.totalStaff})`);

    // Admin sees all departments combined
    const mockReqAdminOct16 = {
      user: testAdmin,
      query: { date: '2026-10-16' },
    };
    await getAttendanceStats(mockReqAdminOct16, mockRes);
    const adminStatsOct16 = resData?.data;
    // 3 test staff + 1 existing seed staff (Anand Krishnan) = 4 unique staff
    assert(adminStatsOct16.staffOnLeaveCount >= 3, `Admin institute-wide staffOnLeaveCount counts all unique staff across departments (got: ${adminStatsOct16.staffOnLeaveCount})`);
    assert(adminStatsOct16.totalStaff >= 3, `Admin sees total staff across all departments (got: ${adminStatsOct16.totalStaff})`);

    // ── TEST 6: Rejected Request Exclusion ──
    console.log('\n--- TEST 6: Rejected Request Exclusion ---');
    const oct28 = new Date(Date.UTC(2026, 9, 28));
    const leave4 = await Leave.create({
      user: staff1._id,
      department: deptA._id,
      type: 'Casual Leave',
      fromDate: oct28,
      toDate: oct28,
      totalDays: 1,
      reason: 'Urgent errand',
      status: 'Rejected',
      rejectionReason: 'Department workload',
    });

    const mockReqHodAOct28 = {
      user: testHodA,
      query: { date: '2026-10-28' },
    };
    await getAttendanceStats(mockReqHodAOct28, mockRes);
    const hodStatsOct28 = resData?.data;
    assert(hodStatsOct28.rejectedLeavesCount === 1, `Rejected requests count is tracked as 1 in Dept A (got: ${hodStatsOct28.rejectedLeavesCount})`);
    assert(hodStatsOct28.staffOnLeaveCount === 0, `Rejected request on Oct 28 produces staffOnLeaveCount = 0 (got: ${hodStatsOct28.staffOnLeaveCount})`);

    // ── TEST 7: HOD Leave Report Metrics Separation ──
    console.log('\n--- TEST 7: HOD Leave Report Metrics Separation ---');
    const mockHodReportReq = {
      user: testHodA,
      query: { month: '10', year: '2026' },
    };
    await hodLeaveReport(mockHodReportReq, mockRes);
    const hodReportStats = resData?.data?.stats;
    assert(hodReportStats.totalApplications === 3, `HOD report counts unique requests in Dept A (expected 3: leave1, leave2, leave4; got: ${hodReportStats.totalApplications})`);
    assert(hodReportStats.statusCounts.Approved === 2, `HOD report approved requests = 2 (got: ${hodReportStats.statusCounts.Approved})`);
    assert(hodReportStats.statusCounts.Rejected === 1, `HOD report rejected requests = 1 (got: ${hodReportStats.statusCounts.Rejected})`);
    assert(hodReportStats.totalApprovedDays === 12, `HOD report totalApprovedDays = 8 + 4 = 12 (got: ${hodReportStats.totalApprovedDays})`);
    assert(hodReportStats.totalCalendarDays === 13, `HOD report totalCalendarDays = 8 + 4 + 1 = 13 (got: ${hodReportStats.totalCalendarDays})`);
    assert(hodReportStats.totalStaffCount === 2, `HOD report totalStaffCount = 2 unique staff (got: ${hodReportStats.totalStaffCount})`);

    // ── TEST 8: calculateAttendanceStats helper unit test ──
    console.log('\n--- TEST 8: calculateAttendanceStats Helper ---');
    const mockAttendanceRecords = [
      { status: 'Present', date: '2026-10-01' },
      { status: 'Present', date: '2026-10-02' },
      { status: 'Absent', date: '2026-10-03' },
      // 8-day leave records with same Leave ID
      { status: 'Leave', date: '2026-10-14', remarks: 'Leave ID: 671d1234abcd', user: staff1._id },
      { status: 'Leave', date: '2026-10-15', remarks: 'Leave ID: 671d1234abcd', user: staff1._id },
      { status: 'Leave', date: '2026-10-16', remarks: 'Leave ID: 671d1234abcd', user: staff1._id },
      { status: 'Leave', date: '2026-10-17', remarks: 'Leave ID: 671d1234abcd', user: staff1._id },
      { status: 'Leave', date: '2026-10-18', remarks: 'Leave ID: 671d1234abcd', user: staff1._id },
      { status: 'Leave', date: '2026-10-19', remarks: 'Leave ID: 671d1234abcd', user: staff1._id },
      { status: 'Leave', date: '2026-10-20', remarks: 'Leave ID: 671d1234abcd', user: staff1._id },
      { status: 'Leave', date: '2026-10-21', remarks: 'Leave ID: 671d1234abcd', user: staff1._id },
    ];

    const calcResult = calculateAttendanceStats(mockAttendanceRecords);
    assert(calcResult.leaveApplicationsCount === 1, `calcResult.leaveApplicationsCount = 1 for 8-day leave (got: ${calcResult.leaveApplicationsCount})`);
    assert(calcResult.staffOnLeaveCount === 1, `calcResult.staffOnLeaveCount = 1 (got: ${calcResult.staffOnLeaveCount})`);
    assert(calcResult.totalLeaveDays === 8, `calcResult.totalLeaveDays = 8 (got: ${calcResult.totalLeaveDays})`);
    assert(calcResult.presentDays === 2, `calcResult.presentDays = 2`);
    assert(calcResult.absentDays === 1, `calcResult.absentDays = 1`);
    assert(calcResult.attendanceRate === 66.7, `calcResult.attendanceRate = 66.7% (got: ${calcResult.attendanceRate}%)`);

    // ── TEST 9: Day 1 Single-Row Attendance Consolidation Intact ──
    console.log('\n--- TEST 9: Day 1 Single-Row Display Preservation ---');
    const consolidated = consolidateAttendanceRecords(mockAttendanceRecords);
    assert(consolidated.length === 4, `8 daily leave records consolidate into 1 single row (total rows: ${consolidated.length})`);
    const consolidatedLeave = consolidated.find((r) => r.isGrouped);
    assert(consolidatedLeave !== undefined, 'Consolidated leave row exists');
    assert(consolidatedLeave.totalDays === 8, `Consolidated leave duration shows 8 days (got: ${consolidatedLeave.totalDays})`);
    assert(consolidatedLeave.dateDisplay.includes('14 Oct 2026 – 21 Oct 2026'), `Consolidated date display shows full range (got: ${consolidatedLeave.dateDisplay})`);

    // ── TEST 10: Dynamic Department Breakdown in Admin Stats ──
    console.log('\n--- TEST 10: Department Breakdown Real Data (No Hardcoding) ---');
    await getAttendanceStats(mockReqAdminOct16, mockRes);
    const deptBreakdown = resData?.data?.departmentBreakdown;
    assert(Array.isArray(deptBreakdown) && deptBreakdown.length >= 2, `Dynamic departmentBreakdown returned (${deptBreakdown?.length} depts)`);
    const deptAEntry = deptBreakdown.find((d) => d.dept === 'T-DEPTA');
    assert(deptAEntry !== undefined, 'Dept Alpha exists in dynamic breakdown');
    assert(deptAEntry.total === 2, `Dept Alpha total staff = 2 (got: ${deptAEntry.total})`);
    assert(deptAEntry.leave === 2, `Dept Alpha has exactly 2 staff on leave on Oct 16 (got: ${deptAEntry.leave})`);

    // Clean up test data
    const allTestUserIds = [testAdmin._id, testHodA._id, testHodB._id, staff1._id, staff2._id, staff3._id];
    await Leave.deleteMany({ user: { $in: allTestUserIds } });
    await Attendance.deleteMany({ user: { $in: allTestUserIds } });
    await User.deleteMany({ _id: { $in: allTestUserIds } });
    await Department.deleteMany({ _id: { $in: [deptA._id, deptB._id] } });

    console.log(`\n========================================`);
    console.log(`DAY 2 TEST RESULTS`);
    console.log(`TOTAL TESTS: ${passed + failed}`);
    console.log(`PASSED: ${passed}`);
    console.log(`FAILED: ${failed}`);
    console.log(`========================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

runDay2Tests();
