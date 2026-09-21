/**
 * Day 4 Test Suite — Shift Scheduling & Conflict Detection
 * Verifies all Day 4 shift and schedule requirements:
 * 1. Admin creates shifts
 * 2. Admin edits shifts
 * 3. Admin deletes/deactivates shifts
 * 4. Shift validation (timings, working hours)
 * 5. Role access controls (Staff cannot manage shifts/schedules)
 * 6. Shift schedule assignment
 * 7. Duplicate schedule prevention (409 Conflict)
 * 8. Approved Leave conflict detection (status: 'On Leave')
 * 9. Non-Teaching Staff schedule isolation (/api/schedules/my)
 * 10. HOD department schedule isolation (/api/schedules/department)
 * 11. Admin global schedule visibility (/api/schedules)
 * 12. Schedule update and deletion
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User.model');
const Department = require('../models/Department.model');
const Shift = require('../models/Shift.model');
const Schedule = require('../models/Schedule.model');
const Leave = require('../models/Leave.model');

const TEST_PORT = 5057;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let server;
let adminToken, hodCseToken, hodEceToken, staff1Token, staff2Token, staffEceToken;
let cseDept, eceDept;
let staff1User, staff2User, staffEceUser;

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
  console.log('🔄 Connecting to MongoDB and starting Day 4 test server...');
  await mongoose.connect(process.env.MONGODB_URI);

  cseDept = await Department.findOne({ code: 'CSE' });
  eceDept = await Department.findOne({ code: 'ECE' });

  staff1User = await User.findOne({ employeeId: 'BIT-NTS-001' });
  staff2User = await User.findOne({ employeeId: 'BIT-NTS-002' });
  staffEceUser = await User.findOne({ employeeId: 'BIT-NTS-003' });

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

  const staffEceRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ employeeId: 'BIT-NTS-003', password: 'Staff@123' }),
  });
  staffEceToken = (await staffEceRes.json()).data?.token;
};

const runTests = async () => {
  try {
    await setup();

    console.log('📋 RUNNING DAY 4 SHIFT SCHEDULING TESTS\n');

    let createdShiftId;

    // Test 1: Admin can create a new shift
    console.log('--- Shift Management by Admin ---');
    const createShiftRes = await fetch(`${BASE_URL}/shifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Weekend Special Shift',
        startTime: '10:00',
        endTime: '18:00',
        description: 'Special shift for weekend lab support',
      }),
    });
    const createShiftJson = await createShiftRes.json();
    assert(
      createShiftRes.status === 201 && createShiftJson.data?.workingHours === 8,
      'Admin can create a new shift with auto-calculated working hours (8 hrs)'
    );
    createdShiftId = createShiftJson.data?._id;

    // Test 2: Shift creation rejects invalid time format
    const invalidTimeRes = await fetch(`${BASE_URL}/shifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Bad Time Shift',
        startTime: '9:00', // Missing leading zero
        endTime: '25:00', // Invalid hour
      }),
    });
    assert(invalidTimeRes.status === 400, 'Shift creation rejects invalid time format (400)');

    // Test 3: Non-Admin (Staff) cannot create shifts
    const staffCreateShiftRes = await fetch(`${BASE_URL}/shifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({
        name: 'Staff Unauthorized Shift',
        startTime: '08:00',
        endTime: '16:00',
      }),
    });
    assert(staffCreateShiftRes.status === 403, 'Staff cannot create shifts (403 Forbidden)');

    // Test 4: Admin can edit a shift
    const editShiftRes = await fetch(`${BASE_URL}/shifts/${createdShiftId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Weekend Support Shift (Updated)',
        endTime: '19:00',
      }),
    });
    const editShiftJson = await editShiftRes.json();
    assert(
      editShiftRes.status === 200 &&
        editShiftJson.data?.name === 'Weekend Support Shift (Updated)' &&
        editShiftJson.data?.workingHours === 9,
      'Admin can edit shift and working hours dynamically update to 9 hrs'
    );

    // Test 5: Get shifts list
    const getShiftsRes = await fetch(`${BASE_URL}/shifts`, {
      headers: { Authorization: `Bearer ${hodCseToken}` },
    });
    const getShiftsJson = await getShiftsRes.json();
    assert(
      getShiftsRes.status === 200 && Array.isArray(getShiftsJson.data) && getShiftsJson.data.length >= 5,
      'Authenticated users can retrieve list of applicable shifts'
    );

    console.log('\n--- Shift Schedule Assignment & Validation ---');
    // Test 6: HOD can assign shift to department staff
    const futureDate1 = new Date();
    futureDate1.setUTCDate(futureDate1.getUTCDate() + 10);
    const futureDate1Str = futureDate1.toISOString().split('T')[0];

    const assignRes = await fetch(`${BASE_URL}/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodCseToken}`,
      },
      body: JSON.stringify({
        staff: staff1User._id,
        shift: createdShiftId,
        date: futureDate1Str,
        remarks: 'Assigned by CSE HOD for weekend lab support',
      }),
    });
    const assignJson = await assignRes.json();
    assert(
      assignRes.status === 201 &&
        assignJson.data?.schedule?.status === 'Scheduled' &&
        assignJson.data?.hasConflict === false,
      'HOD can assign shift schedule to staff in their department'
    );
    const assignedScheduleId = assignJson.data?.schedule?._id;

    // Test 7: Duplicate schedule prevention (same staff, same date)
    const duplicateRes = await fetch(`${BASE_URL}/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodCseToken}`,
      },
      body: JSON.stringify({
        staff: staff1User._id,
        shift: createdShiftId,
        date: futureDate1Str,
      }),
    });
    assert(
      duplicateRes.status === 409,
      'Duplicate schedule assignment on same date for same staff is rejected (409 Conflict)'
    );

    // Test 8: HOD cannot assign shift to staff outside their department
    const foreignAssignRes = await fetch(`${BASE_URL}/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodCseToken}`, // CSE HOD trying to assign to ECE staff
      },
      body: JSON.stringify({
        staff: staffEceUser._id,
        shift: createdShiftId,
        date: futureDate1Str,
      }),
    });
    assert(
      foreignAssignRes.status === 403,
      'HOD cannot assign shift to staff outside their department (403 Forbidden)'
    );

    console.log('\n--- Approved Leave Conflict Detection ---');
    // Test 9: Detect conflict when staff has approved leave on that date
    const leaveDate = new Date();
    leaveDate.setUTCDate(leaveDate.getUTCDate() + 15);
    leaveDate.setUTCHours(0, 0, 0, 0);
    const leaveDateStr = leaveDate.toISOString().split('T')[0];

    // Clean up any existing schedule or leave on this date from previous test runs
    await Schedule.deleteMany({ staff: staff2User._id, date: leaveDate });
    await Leave.deleteMany({ user: staff2User._id, fromDate: leaveDate });

    // Create an approved leave for Staff 2
    const approvedLeave = await Leave.create({
      user: staff2User._id,
      department: cseDept._id,
      type: 'Casual Leave',
      fromDate: leaveDate,
      toDate: leaveDate,
      startTime: '09:00 AM',
      endTime: '05:00 PM',
      totalDays: 1,
      reason: 'Personal function',
      status: 'Approved',
      approvedBy: adminToken ? staff1User._id : null,
      approvedAt: new Date(),
    });

    const leaveConflictAssignRes = await fetch(`${BASE_URL}/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        staff: staff2User._id,
        shift: createdShiftId,
        date: leaveDateStr,
        remarks: 'Scheduled during approved leave',
      }),
    });
    const leaveConflictJson = await leaveConflictAssignRes.json();
    assert(
      leaveConflictAssignRes.status === 201 &&
        leaveConflictJson.data?.hasConflict === true &&
        leaveConflictJson.data?.schedule?.status === 'On Leave' &&
        leaveConflictJson.data?.schedule?.remarks.includes('Conflict: Staff has approved leave'),
      'Approved leave conflict detected: Schedule created with status "On Leave" and conflict remark'
    );

    console.log('\n--- Schedule Isolation & Privacy ---');
    // Test 10: Non-teaching staff can ONLY see their own schedules
    const staffScheduleRes = await fetch(`${BASE_URL}/schedules/my`, {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    const staffScheduleJson = await staffScheduleRes.json();
    const otherStaffInResults = staffScheduleJson.data?.some(
      (s) => s.staff && s.staff.toString() !== staff1User._id.toString()
    );
    assert(
      staffScheduleRes.status === 200 &&
        Array.isArray(staffScheduleJson.data) &&
        staffScheduleJson.data.length > 0 &&
        !otherStaffInResults,
      'Staff receives ONLY their own assigned schedule from /api/schedules/my'
    );

    // Test 11: Non-teaching staff CANNOT access global /api/schedules
    const staffGlobalRes = await fetch(`${BASE_URL}/schedules`, {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    assert(staffGlobalRes.status === 403, 'Staff is denied access to global schedules (403 Forbidden)');

    // Test 12: Non-teaching staff CANNOT access department schedules /api/schedules/department
    const staffDeptRes = await fetch(`${BASE_URL}/schedules/department`, {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    assert(staffDeptRes.status === 403, 'Staff is denied access to department schedules (403 Forbidden)');

    // Test 13: HOD receives only their department schedules
    const hodDeptScheduleRes = await fetch(`${BASE_URL}/schedules/department`, {
      headers: { Authorization: `Bearer ${hodCseToken}` },
    });
    const hodDeptScheduleJson = await hodDeptScheduleRes.json();
    const hasEceInCseHod = hodDeptScheduleJson.data?.some(
      (s) => s.department?._id?.toString() === eceDept._id.toString()
    );
    assert(
      hodDeptScheduleRes.status === 200 &&
        Array.isArray(hodDeptScheduleJson.data) &&
        hodDeptScheduleJson.data.length > 0 &&
        !hasEceInCseHod,
      'HOD schedule view contains ONLY staff from their own department (CSE)'
    );

    // Test 14: Admin has global access to all schedules across all departments
    const adminGlobalRes = await fetch(`${BASE_URL}/schedules`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminGlobalJson = await adminGlobalRes.json();
    const deptsInAdmin = new Set(adminGlobalJson.data?.map((s) => s.department?.code));
    assert(
      adminGlobalRes.status === 200 &&
        deptsInAdmin.has('CSE') &&
        deptsInAdmin.has('ECE'),
      'Admin global view contains schedules from multiple departments (CSE & ECE)'
    );

    console.log('\n--- Schedule Update & Deletion ---');
    // Test 15: HOD/Admin can update schedule
    const updateSchedRes = await fetch(`${BASE_URL}/schedules/${assignedScheduleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hodCseToken}`,
      },
      body: JSON.stringify({
        status: 'Completed',
        remarks: 'Updated to completed by HOD',
      }),
    });
    const updateSchedJson = await updateSchedRes.json();
    assert(
      updateSchedRes.status === 200 && updateSchedJson.data?.status === 'Completed',
      'HOD can update schedule status to "Completed"'
    );

    // Test 16: HOD/Admin can delete schedule
    const deleteSchedRes = await fetch(`${BASE_URL}/schedules/${assignedScheduleId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${hodCseToken}` },
    });
    assert(deleteSchedRes.status === 200, 'HOD can delete schedule');

    // Test 17: Shift deletion deactivates shift when associated with schedules
    const deleteShiftRes = await fetch(`${BASE_URL}/shifts/${createdShiftId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deleteShiftJson = await deleteShiftRes.json();
    assert(
      deleteShiftRes.status === 200,
      'Admin can delete or deactivate shift'
    );

    // Summary
    console.log('\n════════════════════════════════════════════');
    console.log(`TOTAL TESTS: ${passedTests + failedTests}`);
    console.log(`PASSED: ${passedTests}`);
    console.log(`FAILED: ${failedTests}`);
    console.log('════════════════════════════════════════════\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test suite failed with error:', error);
    process.exit(1);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
  }
};

runTests();
