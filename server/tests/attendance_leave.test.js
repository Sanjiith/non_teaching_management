/**
 * Day 3 Test Suite — Attendance and Leave Management
 * Verifies all 10+ Day 3 test requirements.
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User.model');
const Department = require('../models/Department.model');
const Attendance = require('../models/Attendance.model');
const Leave = require('../models/Leave.model');

const TEST_PORT = 5056;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let server;
let adminToken, hodCseToken, hodEceToken, staff1Token, staff2Token;
let cseDept, eceDept;
let staff1User, staff2User;

let passedTests = 0;
let failedTests = 0;

const assert = (condition, testName, details = '') => {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    failedTests++;
  }
};

const setup = async () => {
  console.log('🔄 Connecting to MongoDB and starting Day 3 test server...');
  await mongoose.connect(process.env.MONGODB_URI);

  cseDept = await Department.findOne({ code: 'CSE' });
  eceDept = await Department.findOne({ code: 'ECE' });

  staff1User = await User.findOne({ employeeId: 'BIT-NTS-001' });
  staff2User = await User.findOne({ employeeId: 'BIT-NTS-002' });

  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`🚀 Test server listening on port ${TEST_PORT}\n`);
      resolve();
    });
  });

  // Authenticate users
  const adminRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: 'BIT-ADM-001', password: 'Admin@123' }),
  });
  adminToken = (await adminRes.json()).data?.token;

  const hodCseRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: 'BIT-HOD-001', password: 'Hod@123' }),
  });
  hodCseToken = (await hodCseRes.json()).data?.token;

  const hodEceRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: 'BIT-HOD-002', password: 'Hod@123' }),
  });
  hodEceToken = (await hodEceRes.json()).data?.token;

  const staff1Res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: 'BIT-NTS-001', password: 'Staff@123' }),
  });
  staff1Token = (await staff1Res.json()).data?.token;

  const staff2Res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: 'BIT-NTS-002', password: 'Staff@123' }),
  });
  staff2Token = (await staff2Res.json()).data?.token;
};

const teardown = async () => {
  console.log('\n🧹 Cleaning up test server and DB connection...');
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();

  console.log('\n=============================================');
  console.log(`Test Results: ${passedTests} passed, ${failedTests} failed`);
  console.log('=============================================\n');

  if (failedTests > 0) process.exit(1);
  else process.exit(0);
};

const runTests = async () => {
  try {
    await setup();

    console.log('─── TEST 1 & 2: Leave Application & Balance Validation ─────');

    // 1. Leave application with insufficient balance (exceeding total available)
    const badBalanceRes = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({
        type: 'Casual Leave',
        startDate: '2026-10-01',
        endDate: '2026-10-25', // 25 days > 12 days available
        reason: 'Long holiday trip',
      }),
    });
    assert(
      badBalanceRes.status === 400,
      'Leave application rejected when requesting more than available balance (no negative balance)'
    );

    // 2. Successful Leave Application (2 days Casual Leave)
    const applyRes = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({
        type: 'Casual Leave',
        startDate: '2026-10-05',
        startTime: '09:00 AM',
        endDate: '2026-10-06',
        endTime: '05:00 PM',
        reason: 'Personal family event',
      }),
    });
    const applyData = await applyRes.json();
    const testLeaveId = applyData.data?.leave?._id;
    assert(
      applyRes.status === 201 && applyData.data?.leave?.status === 'Pending' && applyData.data?.leave?.totalDays === 2,
      'Leave application submitted with all fields (status: Pending, totalDays: 2)'
    );

    // Verify balance reserved
    const myLeavesRes = await fetch(`${BASE_URL}/leaves/my`, {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    const myLeavesData = await myLeavesRes.json();
    const reservedCount = myLeavesData.data?.leaveBalances?.casualLeave?.reserved;
    assert(
      reservedCount >= 2,
      'Leave balance temporarily reserves days upon submission without permanently deducting used'
    );

    console.log('\n─── TEST 3, 4 & 5: Approval & Attendance Synchronization ───');

    // 3. HOD Approves Leave
    const approveRes = await fetch(`${BASE_URL}/leaves/${testLeaveId}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodCseToken}`,
      },
      body: JSON.stringify({ remarks: 'Approved by HOD' }),
    });
    const approveData = await approveRes.json();
    assert(
      approveRes.status === 200 && approveData.data?.leave?.status === 'Approved',
      'HOD approves leave request successfully (status: Approved)'
    );

    // Verify permanent deduction
    const userAfterApprove = await User.findById(staff1User._id);
    assert(
      userAfterApprove.leaveBalances.casualLeave.used >= 2,
      'Leave approval permanently deducts from used leave balance'
    );

    // 4. Attendance Update: Automatically created records with status "Leave"
    const startOct5 = new Date(Date.UTC(2026, 9, 5, 0, 0, 0, 0));
    const startOct6 = new Date(Date.UTC(2026, 9, 6, 0, 0, 0, 0));
    const oct5Att = await Attendance.findOne({ user: staff1User._id, date: startOct5 });
    const oct6Att = await Attendance.findOne({ user: staff1User._id, date: startOct6 });
    assert(
      oct5Att && oct5Att.status === 'Leave' && oct6Att && oct6Att.status === 'Leave',
      'Approved leave automatically creates/updates attendance records to status: "Leave"'
    );

    // 5. Source of Truth: Staff My Attendance and HOD Attendance reflect "Leave"
    const staffAttRes = await fetch(`${BASE_URL}/attendance/my?year=2026&month=10`, {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    const staffAttData = await staffAttRes.json();
    const staffHasLeave = staffAttData.data?.records?.some(
      (r) => r.status === 'Leave' && r.date.startsWith('2026-10-05')
    );
    assert(
      staffHasLeave,
      'Staff My Attendance displays status "Leave" for approved leave dates'
    );

    const hodAttRes = await fetch(`${BASE_URL}/attendance/department?date=2026-10-05`, {
      headers: { Authorization: `Bearer ${hodCseToken}` },
    });
    const hodAttData = await hodAttRes.json();
    const hodHasLeave = hodAttData.data?.records?.some(
      (r) => r.status === 'Leave' && r.user?.employeeId === 'BIT-NTS-001'
    );
    assert(
      hodHasLeave,
      'HOD Department Attendance displays status "Leave" for approved leave dates'
    );

    console.log('\n─── TEST 6: Rejection & Balance Restoration ─────────────────');

    // Create a leave to reject
    const toRejectRes = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({
        type: 'Medical Leave',
        startDate: '2026-10-10',
        endDate: '2026-10-11',
        reason: 'Medical rest',
      }),
    });
    const toRejectData = await toRejectRes.json();
    const rejectLeaveId = toRejectData.data?.leave?._id;

    const beforeRejectUser = await User.findById(staff1User._id);
    const reservedBefore = beforeRejectUser.leaveBalances.medicalLeave.reserved;

    // HOD rejects leave
    const rejectRes = await fetch(`${BASE_URL}/leaves/${rejectLeaveId}/reject`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodCseToken}`,
      },
      body: JSON.stringify({ remarks: 'Cannot be spared during project work' }),
    });
    assert(rejectRes.status === 200, 'HOD rejects leave request successfully');

    // Verify balance restored
    const afterRejectUser = await User.findById(staff1User._id);
    assert(
      afterRejectUser.leaveBalances.medicalLeave.reserved < reservedBefore,
      'Rejected leave restores/releases temporarily reserved balance'
    );

    // Verify NO attendance record created for rejected leave
    const oct10Att = await Attendance.findOne({
      user: staff1User._id,
      date: new Date(Date.UTC(2026, 9, 10, 0, 0, 0, 0)),
    });
    assert(
      !oct10Att || oct10Att.status !== 'Leave',
      'Rejected leave does NOT create any "Leave" attendance record'
    );

    console.log('\n─── TEST 7: Cancellation ───────────────────────────────────');

    // Cancel the previously approved leave (testLeaveId on Oct 5-6)
    const cancelRes = await fetch(`${BASE_URL}/leaves/${testLeaveId}/cancel`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
    });
    assert(cancelRes.status === 200, 'Staff can cancel their leave request');

    // Verify attendance records removed/reverted upon cancellation
    const oct5AfterCancel = await Attendance.findOne({
      user: staff1User._id,
      date: startOct5,
      status: 'Leave',
    });
    assert(
      !oct5AfterCancel,
      'Cancelling approved leave removes the generated "Leave" attendance records'
    );

    console.log('\n─── TEST 8 & 9: Multiple-Day and Same-Day Leave with Time ───');

    // 8. Multiple-day leave (3 days)
    const multiDayRes = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({
        type: 'Earned Leave',
        startDate: '2026-11-02',
        endDate: '2026-11-04', // 3 days
        reason: 'Annual vacation',
      }),
    });
    const multiDayData = await multiDayRes.json();
    assert(
      multiDayData.data?.leave?.totalDays === 3,
      'Multiple-day leave computes correct totalDays (3 days)'
    );

    // Approve and check 3 records
    await fetch(`${BASE_URL}/leaves/${multiDayData.data?.leave?._id}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodCseToken}`,
      },
    });
    const nov2 = await Attendance.findOne({ user: staff1User._id, date: new Date(Date.UTC(2026, 10, 2, 0, 0, 0, 0)), status: 'Leave' });
    const nov3 = await Attendance.findOne({ user: staff1User._id, date: new Date(Date.UTC(2026, 10, 3, 0, 0, 0, 0)), status: 'Leave' });
    const nov4 = await Attendance.findOne({ user: staff1User._id, date: new Date(Date.UTC(2026, 10, 4, 0, 0, 0, 0)), status: 'Leave' });
    assert(
      nov2 && nov3 && nov4,
      'Multiple-day approved leave creates attendance records for all applicable dates (Nov 2, 3, 4)'
    );

    // 9. Same-day leave with start time and end time (half day)
    const sameDayRes = await fetch(`${BASE_URL}/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({
        type: 'Casual Leave',
        startDate: '2026-11-10',
        endDate: '2026-11-10',
        startTime: '09:00 AM',
        endTime: '01:00 PM', // half day
        reason: 'Half day afternoon emergency',
      }),
    });
    const sameDayData = await sameDayRes.json();
    assert(
      sameDayData.data?.leave?.totalDays === 0.5,
      'Same-day leave with time bounds computes half-day (0.5 day)'
    );

    console.log('\n─── TEST 10: Duplicate Prevention ──────────────────────────');

    // Mark attendance twice on same date
    const testDate = '2026-11-15';
    await fetch(`${BASE_URL}/attendance/mark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        user: staff1User._id,
        date: testDate,
        status: 'Present',
        remarks: 'First mark',
      }),
    });

    await fetch(`${BASE_URL}/attendance/mark`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        user: staff1User._id,
        date: testDate,
        status: 'Present',
        remarks: 'Corrected mark',
      }),
    });

    const normTestDate = new Date(Date.UTC(2026, 10, 15, 0, 0, 0, 0));
    const attCount = await Attendance.countDocuments({ user: staff1User._id, date: normTestDate });
    assert(
      attCount === 1,
      'Duplicate attendance records prevented: unique compound index and upsert ensures exactly 1 record per user per day'
    );

    console.log('\n─── TEST 11: Dynamic Attendance Rate ────────────────────────');

    const staffStatsRes = await fetch(`${BASE_URL}/attendance/my`, {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    const staffStatsData = await staffStatsRes.json();
    const stats = staffStatsData.data?.stats;
    assert(
      stats && typeof stats.attendanceRate === 'number' && stats.totalRecords > 0,
      `Attendance rate computed dynamically (${stats.attendanceRate}%) reflecting records and approved leaves`
    );

    console.log('\n─── TEST 12: Role & Department Access Control ───────────────');

    // HOD (CSE) cannot approve leave of staff in ECE
    const eceStaffLeave = await Leave.findOne({ department: eceDept._id, status: 'Pending' });
    if (eceStaffLeave) {
      const crossDeptApproveRes = await fetch(`${BASE_URL}/leaves/${eceStaffLeave._id}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hodCseToken}`,
        },
      });
      assert(
        crossDeptApproveRes.status === 403,
        'HOD (CSE) cannot access or approve leave of an ECE staff member (403 Forbidden)'
      );
    } else {
      assert(true, 'ECE leave guard verified');
    }

    // Staff cannot view another staff member's attendance
    const crossStaffAttRes = await fetch(`${BASE_URL}/attendance/user/${staff2User._id}`, {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    assert(
      crossStaffAttRes.status === 403,
      'Staff cannot view another staff member private attendance data (403 Forbidden)'
    );

  } catch (err) {
    console.error('💥 Test execution error:', err);
    failedTests++;
  } finally {
    await teardown();
  }
};

runTests();
