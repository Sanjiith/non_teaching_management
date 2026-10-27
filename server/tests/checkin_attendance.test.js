/**
 * checkin_attendance.test.js
 *
 * Comprehensive Test Suite for Check-In & Daily Attendance Feature:
 * 1. Configurable attendance check-in window (get and update).
 * 2. Successful staff check-in within window (records date, checkIn time, staff ID, status: Present).
 * 3. Prevention of duplicate check-ins on the same day (single check-in per staff per day).
 * 4. Check-in rejection before the start time of the window.
 * 5. Check-in rejection after the deadline & auto-marking as Absent.
 * 6. Protection of approved leaves from being marked Absent or overwritten.
 * 7. Prevention of duplicate attendance records on absence-marking.
 * 8. Staff dashboard today's attendance status & check-in time API.
 * 9. HOD dashboard daily staff attendance: displays name, employee ID, department, date, check-in time, status.
 * 10. HOD strict department isolation: HOD can view ONLY staff belonging to their assigned department.
 * 11. Admin dashboard daily staff attendance: displays all staff across every department.
 * 12. Admin filters: date filter, department filter, status filter, and text search.
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Department = require('../models/Department.model');
const Leave = require('../models/Leave.model');
const Attendance = require('../models/Attendance.model');
const {
  getAttendanceConfig,
  updateAttendanceConfig,
  isWithinCheckInWindow,
  isBeforeCheckInWindow,
  hasCheckInWindowClosed,
} = require('../config/attendance.config');
const {
  checkIn,
  getTodayAttendance,
  getDailyStaffAttendance,
  markAbsenteesForDate,
} = require('../controllers/attendance.controller');

const MONGODB_URI = process.env.MONGODB_URI;

// Helper to mock express req/res
const mockReqRes = (user, query = {}, body = {}, params = {}) => {
  const req = { user, query, body, params };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (payload) => {
      responseData = payload;
      return res;
    },
  };

  const getResult = () => ({ status: statusCode, data: responseData });
  return { req, res, getResult };
};

const runTests = async () => {
  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

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

  // Capture original config to restore later
  const originalConfig = getAttendanceConfig();

  try {
    // ── 0. Fetch Test Accounts ──────────────────────────────────────────
    const adminUser = await User.findOne({ role: 'Admin' });
    const cseHodUser = await User.findOne({ email: 'arun.kumar@bitsathy.ac.in' }).populate('department');
    const eceHodUser = await User.findOne({ email: 'priya.sharma@bitsathy.ac.in' }).populate('department');

    const cseStaff1 = await User.findOne({ email: 'rajesh.kumar.cse@bitsathy.ac.in' }).populate('department');
    const cseStaff2 = await User.findOne({ email: 'meena.devi.cse@bitsathy.ac.in' }).populate('department');
    const cseStaff3 = await User.findOne({ email: 'anand.krishnan.cse@bitsathy.ac.in' }).populate('department');
    const eceStaff1 = await User.findOne({ email: 'suresh.babu.ece@bitsathy.ac.in' }).populate('department');

    assert(adminUser && cseHodUser && eceHodUser && cseStaff1 && cseStaff2 && eceStaff1, 'Found all required test users across roles and departments');

    // Clean up any test attendance records for today before testing
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const tomorrowUTC = new Date(todayUTC);
    tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);

    await Attendance.deleteMany({ date: { $gte: todayUTC, $lt: tomorrowUTC } });
    await Leave.deleteMany({ user: { $in: [cseStaff1._id, cseStaff2._id, cseStaff3._id] } });

    console.log('\n--- 1. CONFIGURABLE ATTENDANCE WINDOW TESTS ---');
    const defaultConfig = getAttendanceConfig();
    assert(defaultConfig.checkInStartTime && defaultConfig.checkInEndTime, `Default config has start (${defaultConfig.checkInStartTime}) and end (${defaultConfig.checkInEndTime})`);

    const updated = updateAttendanceConfig({ checkInStartTime: '08:30', checkInEndTime: '10:30' });
    assert(updated.checkInStartTime === '08:30' && updated.checkInEndTime === '10:30', 'Config updated successfully to 08:30 – 10:30');

    // Invalid time format rejection
    let threw = false;
    try {
      updateAttendanceConfig({ checkInStartTime: '25:99' });
    } catch {
      threw = true;
    }
    assert(threw, 'Rejects invalid time format for checkInStartTime');

    console.log('\n--- 2. SUCCESSFUL CHECK-IN WITHIN WINDOW ---');
    // Open window covering full 24h for current time testing
    updateAttendanceConfig({ checkInStartTime: '00:00', checkInEndTime: '23:59' });

    const { req: req1, res: res1, getResult: getResult1 } = mockReqRes(cseStaff1);
    await checkIn(req1, res1);
    const r1 = getResult1();

    assert(r1.status === 200 && r1.data.success, 'Staff member checked in successfully with status 200');
    assert(r1.data.data.status === 'Present', 'Attendance status recorded as "Present"');
    assert(r1.data.data.checkInTime !== null, 'Check-in timestamp recorded');
    assert(r1.data.data.checkInTimeFormatted !== null, `Check-in formatted time returned: ${r1.data.data.checkInTimeFormatted}`);

    // Verify DB record
    const savedRecord = await Attendance.findOne({ user: cseStaff1._id, date: todayUTC }).populate('user');
    assert(savedRecord !== null, 'Attendance record stored in MongoDB');
    assert(savedRecord.status === 'Present', 'Database status is "Present"');
    assert(savedRecord.checkIn instanceof Date, 'Database checkIn is valid Date object');
    assert(savedRecord.user.employeeId === cseStaff1.employeeId, `Associated with staff employeeId ${cseStaff1.employeeId}`);

    console.log('\n--- 3. DUPLICATE CHECK-IN PREVENTION ---');
    // Attempt second check-in on the same day for same staff member
    const { req: reqDup, res: resDup, getResult: getResultDup } = mockReqRes(cseStaff1);
    await checkIn(reqDup, resDup);
    const rDup = getResultDup();

    assert(rDup.status === 400 && !rDup.data.success, 'Duplicate check-in on the same day is rejected with 400');
    assert(rDup.data.message.includes('already checked in today'), `Rejection message informs user of prior check-in: "${rDup.data.message}"`);

    // Ensure database still has only ONE record for this user today
    const attCount = await Attendance.countDocuments({ user: cseStaff1._id, date: todayUTC });
    assert(attCount === 1, `Exactly 1 attendance record in MongoDB for ${cseStaff1.employeeId} today`);

    console.log('\n--- 4. CHECK-IN BEFORE WINDOW STARTS ---');
    // Configure window to a future time today, e.g. 23:58 - 23:59
    updateAttendanceConfig({ checkInStartTime: '23:58', checkInEndTime: '23:59' });

    const { req: reqEarly, res: resEarly, getResult: getResultEarly } = mockReqRes(cseStaff2);
    await checkIn(reqEarly, resEarly);
    const rEarly = getResultEarly();

    assert(rEarly.status === 400, 'Check-in rejected before start time with status 400');
    assert(rEarly.data.message.includes('not started yet'), `Error message indicates check-in period not started: "${rEarly.data.message}"`);

    // Verify staff was NOT marked Present or Absent before deadline
    const earlyRecord = await Attendance.findOne({ user: cseStaff2._id, date: todayUTC });
    assert(earlyRecord === null, 'Staff is not marked Absent or Present before window opens');

    console.log('\n--- 5. CHECK-IN AFTER WINDOW DEADLINE (AUTO-ABSENT) ---');
    // Configure window to a past time today, e.g. 00:00 - 00:01
    updateAttendanceConfig({ checkInStartTime: '00:00', checkInEndTime: '00:01' });

    const { req: reqLate, res: resLate, getResult: getResultLate } = mockReqRes(cseStaff2);
    await checkIn(reqLate, resLate);
    const rLate = getResultLate();

    assert(rLate.status === 400, 'Check-in rejected after deadline with status 400');
    assert(rLate.data.message.includes('closed') && rLate.data.message.includes('Absent'), `Informs user that window closed and marked Absent: "${rLate.data.message}"`);

    // Verify staff is auto-marked Absent in DB
    const lateRecord = await Attendance.findOne({ user: cseStaff2._id, date: todayUTC });
    assert(lateRecord !== null && lateRecord.status === 'Absent', 'Staff member is automatically marked "Absent" in MongoDB');
    assert(lateRecord.checkIn === null, 'Absent record has null checkIn time');

    console.log('\n--- 6. APPROVED LEAVE INTEGRATION & PROTECTION ---');
    // Staff 3 applies for and gets an Approved leave for today
    const testLeave = await Leave.create({
      user: cseStaff3._id,
      department: cseStaff3.department._id,
      type: 'Casual Leave',
      fromDate: todayUTC,
      toDate: todayUTC,
      totalDays: 1,
      reason: 'Medical checkup',
      status: 'Approved',
      approvedBy: adminUser._id,
      approvedAt: new Date(),
    });

    // Check-in attempt by staff on approved leave
    updateAttendanceConfig({ checkInStartTime: '00:00', checkInEndTime: '23:59' });
    const { req: reqLeaveCheckIn, res: resLeaveCheckIn, getResult: getResultLeaveCheckIn } = mockReqRes(cseStaff3);
    await checkIn(reqLeaveCheckIn, resLeaveCheckIn);
    const rLeaveCheckIn = getResultLeaveCheckIn();

    assert(rLeaveCheckIn.status === 400, 'Staff on approved leave cannot check in (status 400)');
    assert(rLeaveCheckIn.data.message.includes('approved'), `Message states user is on approved leave: "${rLeaveCheckIn.data.message}"`);

    // Window closes: run auto-absence process
    updateAttendanceConfig({ checkInStartTime: '00:00', checkInEndTime: '00:01' });
    await markAbsenteesForDate(todayUTC);

    // Verify Staff 3 is marked 'Leave', NOT 'Absent'
    const staff3Att = await Attendance.findOne({ user: cseStaff3._id, date: todayUTC });
    assert(staff3Att !== null, 'Staff 3 has attendance record');
    assert(staff3Att.status === 'Leave', `Approved leave was protected: status is "${staff3Att.status}", not Absent`);

    // Verify Staff 1 (Present) was NOT overwritten as Absent
    const staff1Att = await Attendance.findOne({ user: cseStaff1._id, date: todayUTC });
    assert(staff1Att.status === 'Present', `Checked-in staff remained "Present" after absence-marking process`);

    // Verify no duplicates created
    const totalStaffRecords = await Attendance.find({ user: cseStaff3._id, date: todayUTC });
    assert(totalStaffRecords.length === 1, 'No duplicate attendance records created for staff on leave');

    console.log('\n--- 7. STAFF DASHBOARD (TODAY ATTENDANCE STATUS API) ---');
    updateAttendanceConfig({ checkInStartTime: '00:00', checkInEndTime: '23:59' });

    // Checked-in staff sees Present & check-in time
    const { req: reqToday1, res: resToday1, getResult: getResultToday1 } = mockReqRes(cseStaff1);
    await getTodayAttendance(reqToday1, resToday1);
    const rToday1 = getResultToday1();

    assert(rToday1.status === 200, 'getTodayAttendance returned 200');
    assert(rToday1.data.data.status === 'Present', 'Staff dashboard sees status "Present"');
    assert(rToday1.data.data.alreadyCheckedIn === true, 'Staff dashboard sees alreadyCheckedIn = true');
    assert(rToday1.data.data.checkInFormatted !== null, `Staff dashboard displays check-in time: ${rToday1.data.data.checkInFormatted}`);
    assert(rToday1.data.data.window.isOpen === true, 'Staff dashboard displays active window info');

    console.log('\n--- 8. HOD DASHBOARD: DEPARTMENT STAFF ATTENDANCE ---');
    // CSE HOD queries daily staff attendance
    const { req: reqHodCse, res: resHodCse, getResult: getResultHodCse } = mockReqRes(cseHodUser, { date: todayUTC.toISOString().split('T')[0] });
    await getDailyStaffAttendance(reqHodCse, resHodCse);
    const rHodCse = getResultHodCse();

    assert(rHodCse.status === 200, 'HOD daily-staff returned 200');
    assert(rHodCse.data.data.records.length === 10, `HOD sees all 10 CSE staff members (found ${rHodCse.data.data.records.length})`);

    // Verify all records belong to CSE department
    const nonCseStaffInHodView = rHodCse.data.data.records.filter(
      (r) => r.department?.code !== 'CSE' && r.department?._id?.toString() !== cseHodUser.department._id.toString()
    );
    assert(nonCseStaffInHodView.length === 0, 'HOD sees ONLY staff belonging to their assigned department');

    // Verify fields displayed for each staff
    const firstStaffRecord = rHodCse.data.data.records.find((r) => r.employeeId === cseStaff1.employeeId);
    assert(firstStaffRecord !== undefined, 'Found Rajesh Kumar (CSE-001) in HOD list');
    assert(firstStaffRecord.name === cseStaff1.name, `Displays staff name: ${firstStaffRecord.name}`);
    assert(firstStaffRecord.employeeId === cseStaff1.employeeId, `Displays employee ID: ${firstStaffRecord.employeeId}`);
    assert(firstStaffRecord.department.code === 'CSE', `Displays department: ${firstStaffRecord.department.code}`);
    assert(firstStaffRecord.status === 'Present', `Displays status "Present" after check-in`);
    assert(firstStaffRecord.checkInFormatted !== '—', `Displays formatted check-in time: ${firstStaffRecord.checkInFormatted}`);

    console.log('\n--- 9. HOD DEPARTMENT ISOLATION ENFORCEMENT ---');
    // ECE HOD queries daily staff attendance
    const { req: reqHodEce, res: resHodEce, getResult: getResultHodEce } = mockReqRes(eceHodUser, { date: todayUTC.toISOString().split('T')[0] });
    await getDailyStaffAttendance(reqHodEce, resHodEce);
    const rHodEce = getResultHodEce();

    assert(rHodEce.status === 200, 'ECE HOD query returned 200');
    assert(rHodEce.data.data.records.length === 10, `ECE HOD sees all 10 ECE staff members (found ${rHodEce.data.data.records.length})`);

    const cseStaffInEceView = rHodEce.data.data.records.filter(
      (r) => r.department?.code === 'CSE' || r.employeeId === cseStaff1.employeeId
    );
    assert(cseStaffInEceView.length === 0, 'ECE HOD CANNOT see CSE staff members (strict department isolation)');

    // HOD passing query parameter ?department=CSE_ID is ignored/overridden to HOD's own department
    const { req: reqHodSpoof, res: resHodSpoof, getResult: getResultHodSpoof } = mockReqRes(
      eceHodUser,
      { department: cseHodUser.department._id.toString() }
    );
    await getDailyStaffAttendance(reqHodSpoof, resHodSpoof);
    const rHodSpoof = getResultHodSpoof();

    const spoofLeak = rHodSpoof.data.data.records.filter((r) => r.department?.code === 'CSE');
    assert(spoofLeak.length === 0, 'HOD cannot override department filter to view another department');

    console.log('\n--- 10. ADMIN DASHBOARD: INSTITUTE-WIDE STAFF ATTENDANCE ---');
    // Admin queries daily staff attendance
    const { req: reqAdminAll, res: resAdminAll, getResult: getResultAdminAll } = mockReqRes(adminUser, { date: todayUTC.toISOString().split('T')[0] });
    await getDailyStaffAttendance(reqAdminAll, resAdminAll);
    const rAdminAll = getResultAdminAll();

    assert(rAdminAll.status === 200, 'Admin daily-staff query returned 200');
    assert(rAdminAll.data.data.totalStaff === 50, `Admin sees all 50 staff across every department (totalStaff: ${rAdminAll.data.data.totalStaff})`);

    // Verify departments represented
    const deptsInAdmin = new Set(rAdminAll.data.data.records.map((r) => r.department?.code));
    assert(deptsInAdmin.has('CSE') && deptsInAdmin.has('ECE') && deptsInAdmin.has('ME') && deptsInAdmin.has('CE') && deptsInAdmin.has('IT'),
      `Admin view contains staff from all 5 departments: [${Array.from(deptsInAdmin).join(', ')}]`
    );

    console.log('\n--- 11. ADMIN FILTERS (DATE, DEPARTMENT, STATUS, SEARCH) ---');
    // Admin filter by Department
    const { req: reqAdminDept, res: resAdminDept, getResult: getResultAdminDept } = mockReqRes(
      adminUser,
      { department: cseHodUser.department._id.toString() }
    );
    await getDailyStaffAttendance(reqAdminDept, resAdminDept);
    const rAdminDept = getResultAdminDept();
    assert(rAdminDept.data.data.records.length === 10, 'Admin can filter by department (returns exactly 10 CSE staff)');

    // Admin filter by Status 'Present'
    const { req: reqAdminPres, res: resAdminPres, getResult: getResultAdminPres } = mockReqRes(adminUser, { status: 'Present' });
    await getDailyStaffAttendance(reqAdminPres, resAdminPres);
    const rAdminPres = getResultAdminPres();
    assert(rAdminPres.data.data.records.every((r) => r.status === 'Present'), 'Admin can filter by status "Present"');

    // Admin filter by Search
    const { req: reqAdminSearch, res: resAdminSearch, getResult: getResultAdminSearch } = mockReqRes(adminUser, { search: 'Rajesh' });
    await getDailyStaffAttendance(reqAdminSearch, resAdminSearch);
    const rAdminSearch = getResultAdminSearch();
    assert(rAdminSearch.data.data.records.length >= 1 && rAdminSearch.data.data.records[0].name.includes('Rajesh'), 'Admin can search by name');

    // Clean up test records
    await Attendance.deleteMany({ date: { $gte: todayUTC, $lt: tomorrowUTC } });
    await Leave.deleteMany({ _id: testLeave._id });
    updateAttendanceConfig(originalConfig);

    console.log(`\n======================================================`);
    console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log(`======================================================\n`);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Unhandled test suite error:', err);
    process.exit(1);
  }
};

runTests();
