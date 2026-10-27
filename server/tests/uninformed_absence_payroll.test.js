/**
 * uninformed_absence_payroll.test.js
 *
 * Comprehensive Test Suite for Uninformed Absence Handling & Payroll Integration
 *
 * Requirements covered:
 * 1. Check-in deadline is 11:00 AM (configured local time Asia/Kolkata).
 * 2. Check-in before 11:00 AM records Present (absenceType: None).
 * 3. Check-in after 11:00 AM is rejected, marks Absent, and classifies as 'Uninformed Absence'.
 * 4. Approved leave records 'Leave' status instead of marking Absent, and check-in is unavailable.
 * 5. Staff with no approved leave and no check-in after deadline is marked Absent (Uninformed Absence).
 * 6. Weekly offs (Sunday) and holidays under existing policy are never marked Absent or deducted.
 * 7. Absence is recorded only once per staff per date (idempotent, no duplicates).
 * 8. Automatic payroll deduction integration: ₹30,000 monthly salary / 25 working days = ₹1,200/day deduction.
 * 9. Payroll recalculation idempotency: recalculating does NOT duplicate deductions.
 * 10. Autonomous absence processor service works reliably.
 * 11. Consistent status & deductions across Staff, HOD, and Admin APIs.
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Department = require('../models/Department.model');
const Leave = require('../models/Leave.model');
const Attendance = require('../models/Attendance.model');
const Payroll = require('../models/Payroll.model');
const {
  getAttendanceConfig,
  updateAttendanceConfig,
  isWithinCheckInWindow,
  isBeforeCheckInWindow,
  hasCheckInWindowClosed,
  getZonedTimeParts,
} = require('../config/attendance.config');
const {
  checkIn,
  getTodayAttendance,
  getDailyStaffAttendance,
  markAbsenteesForDate,
  processAbsenteesEndpoint,
} = require('../controllers/attendance.controller');
const { computePayroll, calculateWorkingDays } = require('../services/payroll.service');
const { generatePayroll, previewPayroll } = require('../controllers/payroll.controller');
const { runAbsenceCheck } = require('../services/absenceProcessor.service');

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

// Test Runner Helper
let passed = 0;
let failed = 0;
const assert = (condition, message) => {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
};

const setSimulatedClosedWindow = () => {
  const parts = getZonedTimeParts(new Date());
  // If midnight (minutes < 5), use yesterday 23:58-23:59 or 00:00-00:01
  const endMinutes = Math.max(1, parts.minutesSinceMidnight - 1);
  const startMinutes = Math.max(0, endMinutes - 1);
  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return updateAttendanceConfig({
    checkInStartTime: fmt(startMinutes),
    checkInEndTime: fmt(endMinutes),
  });
};

const setSimulatedOpenWindow = () => {
  return updateAttendanceConfig({
    checkInStartTime: '00:00',
    checkInEndTime: '23:59',
  });
};

const runTests = async () => {
  console.log('========================================================================');
  console.log('UNINFORMED ABSENCE & PAYROLL INTEGRATION TEST SUITE');
  console.log('========================================================================');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB database.');

  let originalConfig = null;
  let testDept = null;
  let testStaff1 = null;
  let testStaff2 = null;
  let testStaff3 = null;
  let testHOD = null;
  let testAdmin = null;

  try {
    originalConfig = getAttendanceConfig();

    // ─────────────────────────────────────────────────────────────────────────
    // 0. Setup Test Data
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- SETUP: Preparing Test Users & Department ---');

    testDept = await Department.findOne({ code: 'UAT-ABS' });
    if (!testDept) {
      testDept = await Department.create({
        name: 'Uninformed Absence Testing',
        code: 'UAT-ABS',
        description: 'Test Department for Absence & Payroll',
      });
    }

    // Clean up past test attendance/payroll/leaves for test users
    const cleanupUser = async (email, employeeId, name, role, salary) => {
      let u = await User.findOne({ email });
      if (!u) {
        u = await User.create({
          name,
          email,
          password: 'Password@123',
          role,
          employeeId,
          staffId: employeeId,
          department: testDept._id,
          designation: 'Laboratory Technician',
          basicSalary: salary,
          isActive: true,
          leaveBalances: {
            casualLeave: { total: 12, balance: 12 },
            earnedLeave: { total: 12, balance: 12 },
            sickLeave: { total: 10, balance: 10 },
          },
        });
      } else {
        u.basicSalary = salary;
        u.department = testDept._id;
        u.role = role;
        await u.save();
      }
      return u;
    };

    testStaff1 = await cleanupUser('uat_staff1@bit.edu', 'UAT-STF-01', 'UAT Staff 1 (₹30,000)', 'Staff', 30000);
    testStaff2 = await cleanupUser('uat_staff2@bit.edu', 'UAT-STF-02', 'UAT Staff 2 (₹30,000)', 'Staff', 30000);
    testStaff3 = await cleanupUser('uat_staff3@bit.edu', 'UAT-STF-03', 'UAT Staff 3 (₹50,000 Capped)', 'Staff', 50000);
    testHOD = await cleanupUser('uat_hod@bit.edu', 'UAT-HOD-01', 'UAT HOD Absence', 'HOD', 60000);
    testAdmin = await cleanupUser('uat_admin@bit.edu', 'UAT-ADM-01', 'UAT Admin Absence', 'Admin', 80000);

    const testUserIds = [testStaff1._id, testStaff2._id, testStaff3._id];
    await Attendance.deleteMany({ user: { $in: testUserIds } });
    await Leave.deleteMany({ user: { $in: testUserIds } });
    await Payroll.deleteMany({ user: { $in: testUserIds } });

    console.log('Test users created with clean attendance and payroll history.');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Configured Daily Check-In Deadline is 11:00 AM
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 1: Check-in Deadline Configuration (11:00 AM) ---');
    const cfg = getAttendanceConfig();
    assert(cfg.checkInEndTime === '11:00', `Default check-in end time is 11:00 (actual: ${cfg.checkInEndTime})`);
    assert(cfg.checkInStartTime === '08:00', `Default check-in start time is 08:00 (actual: ${cfg.checkInStartTime})`);
    assert(cfg.timeZone === 'Asia/Kolkata', `Default time zone is Asia/Kolkata (actual: ${cfg.timeZone})`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Check-In Before 11:00 AM (Within Window) Succeeds (Status: Present, absenceType: None)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 2: Successful Check-In Before 11:00 AM ---');
    setSimulatedOpenWindow();

    const checkInReq1 = mockReqRes(testStaff1);
    await checkIn(checkInReq1.req, checkInReq1.res);
    const checkInRes1 = checkInReq1.getResult();

    assert(checkInRes1.status === 200, `Check-in within window returns 200 OK (actual: ${checkInRes1.status})`);
    assert(checkInRes1.data.success === true, 'Response reports success: true');
    assert(checkInRes1.data.data.status === 'Present', `Attendance status is Present (actual: ${checkInRes1.data.data.status})`);
    assert(checkInRes1.data.data.attendance.absenceType === 'None', `Absence type is None (actual: ${checkInRes1.data.data.attendance.absenceType})`);
    assert(Boolean(checkInRes1.data.data.checkInTime), 'Recorded check-in timestamp exists');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Duplicate Check-In on the Same Date is Prevented
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 3: Single Check-In Per Staff Member Per Day (Duplicate Rejection) ---');
    const dupReq = mockReqRes(testStaff1);
    await checkIn(dupReq.req, dupReq.res);
    const dupRes = dupReq.getResult();

    assert(dupRes.status === 400, `Duplicate check-in rejected with 400 Bad Request (actual: ${dupRes.status})`);
    assert(dupRes.data.message.includes('Duplicate check-ins are not permitted'), 'Helpful error prevents duplicate check-in');

    const totalStaff1RecordsToday = await Attendance.countDocuments({
      user: testStaff1._id,
      date: checkInRes1.data.data.date,
    });
    assert(totalStaff1RecordsToday === 1, `Exactly 1 attendance record exists in DB for staff 1 today (actual: ${totalStaff1RecordsToday})`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Check-In After 11:00 AM Deadline is Rejected & Marked as Uninformed Absence
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 4: Check-In After 11:00 AM Deadline & Uninformed Absence Classification ---');
    // Set window to closed
    setSimulatedClosedWindow();
    assert(hasCheckInWindowClosed(new Date()) === true, 'hasCheckInWindowClosed returns true for closed window');

    const checkInReq2 = mockReqRes(testStaff2);
    await checkIn(checkInReq2.req, checkInReq2.res);
    const checkInRes2 = checkInReq2.getResult();

    assert(checkInRes2.status === 400, `Check-in after deadline rejected with 400 (actual: ${checkInRes2.status})`);
    assert(
      checkInRes2.data.message.includes('Uninformed Absence') || checkInRes2.data.message.includes('marked Absent'),
      `Message states marked Absent / Uninformed Absence (actual: "${checkInRes2.data.message}")`
    );

    // Verify DB record created for Staff 2
    const todayUTC = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    const staff2Record = await Attendance.findOne({ user: testStaff2._id, date: todayUTC });

    assert(Boolean(staff2Record), 'Attendance record created in DB for Staff 2');
    assert(staff2Record?.status === 'Absent', `Status is Absent (actual: ${staff2Record?.status})`);
    assert(
      staff2Record?.absenceType === 'Uninformed Absence',
      `Classified as Uninformed Absence (actual: ${staff2Record?.absenceType})`
    );
    assert(
      staff2Record?.remarks.includes('Uninformed Absence'),
      `Remarks specify check-in deadline passed (actual: "${staff2Record?.remarks}")`
    );

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Approved Leave Protection (Leave Status Recorded, No Absence Deduction)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 5: Approved Leave Protection ---');
    // Staff 3 applies for and has approved leave for today
    const approvedLeave = await Leave.create({
      user: testStaff3._id,
      department: testDept._id,
      type: 'Casual Leave',
      reason: 'Family Emergency',
      fromDate: todayUTC,
      toDate: todayUTC,
      totalDays: 1,
      status: 'Approved',
      approvedBy: testAdmin._id,
      approvalDate: new Date(),
    });

    // Attempt check-in while on approved leave
    setSimulatedOpenWindow();
    const checkInReq3 = mockReqRes(testStaff3);
    await checkIn(checkInReq3.req, checkInReq3.res);
    const checkInRes3 = checkInReq3.getResult();

    assert(checkInRes3.status === 400, `Check-in rejected on approved leave with 400 (actual: ${checkInRes3.status})`);
    assert(
      checkInRes3.data.message.includes('approved leave'),
      `Message informs user is on approved leave (actual: "${checkInRes3.data.message}")`
    );

    // Run absence marking for today with window closed
    setSimulatedClosedWindow();
    await markAbsenteesForDate(todayUTC);

    const staff3Record = await Attendance.findOne({ user: testStaff3._id, date: todayUTC });
    assert(Boolean(staff3Record), 'Attendance record exists for Staff 3 on approved leave');
    assert(staff3Record?.status === 'Leave', `Status is Leave instead of Absent (actual: ${staff3Record?.status})`);
    assert(staff3Record?.absenceType === 'None', `AbsenceType is None for approved leave (actual: ${staff3Record?.absenceType})`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: Weekly Off (Sundays) and Holidays under Policy are Not Marked Absent
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 6: Weekly Offs (Sundays) and Holidays Policy ---');
    // October 18, 2026 was a Sunday (2026-10-18)
    const testSunday = new Date(Date.UTC(2026, 9, 18, 0, 0, 0, 0)); // Day 0 = Sunday
    assert(testSunday.getUTCDay() === 0, 'Confirmed test date is Sunday (dayOfWeek === 0)');

    await markAbsenteesForDate(testSunday);

    const staff1Sunday = await Attendance.findOne({ user: testStaff1._id, date: testSunday });
    assert(
      staff1Sunday?.status === 'Weekly Off',
      `Sunday attendance status is Weekly Off, NOT Absent (actual: ${staff1Sunday?.status})`
    );
    assert(staff1Sunday?.absenceType === 'None', `Sunday absenceType is None (actual: ${staff1Sunday?.absenceType})`);

    // Pre-existing holiday record protection
    const testHolidayDate = new Date(Date.UTC(2026, 9, 2, 0, 0, 0, 0)); // Oct 2 Gandhi Jayanti
    await Attendance.findOneAndUpdate(
      { user: testStaff1._id, date: testHolidayDate },
      { user: testStaff1._id, date: testHolidayDate, status: 'Holiday', remarks: 'Gandhi Jayanti', absenceType: 'None' },
      { upsert: true, new: true }
    );

    await markAbsenteesForDate(testHolidayDate);
    const staff1Holiday = await Attendance.findOne({ user: testStaff1._id, date: testHolidayDate });
    assert(staff1Holiday?.status === 'Holiday', `Holiday status preserved, NOT overwritten with Absent (actual: ${staff1Holiday?.status})`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: Idempotency: Repeated Absence Processing Never Creates Duplicates
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 7: Idempotent Absence Processing (No Duplicates) ---');
    const pastWorkingDate = new Date(Date.UTC(2026, 9, 14, 0, 0, 0, 0)); // Oct 14 Wednesday
    await Attendance.deleteMany({ user: testStaff1._id, date: pastWorkingDate });

    // Run absence processing 3 times in a row
    const run1 = await markAbsenteesForDate(pastWorkingDate);
    const run2 = await markAbsenteesForDate(pastWorkingDate);
    const run3 = await markAbsenteesForDate(pastWorkingDate);

    const recordsOnDate = await Attendance.find({ user: testStaff1._id, date: pastWorkingDate });
    assert(recordsOnDate.length === 1, `Exactly 1 record exists after 3 consecutive runs (actual: ${recordsOnDate.length})`);
    assert(recordsOnDate[0].status === 'Absent', `Status is Absent (actual: ${recordsOnDate[0].status})`);
    assert(recordsOnDate[0].absenceType === 'Uninformed Absence', `absenceType is Uninformed Absence (actual: ${recordsOnDate[0].absenceType})`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 8: Payroll Deduction Calculation Integration
    // Monthly Salary: ₹30,000 | Working Days: 25 | Daily Deduction: ₹1,200
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 8: Automatic Salary Deduction for Uninformed Absence ---');
    // Setup attendance for a full test month: October 2026
    const startOct = new Date(Date.UTC(2026, 9, 1, 0, 0, 0, 0));
    const endOct = new Date(Date.UTC(2026, 9, 31, 23, 59, 59, 999));
    await Attendance.deleteMany({ user: testStaff1._id, date: { $gte: startOct, $lte: endOct } });

    // October 2026 has 31 days.
    // Sundays in Oct 2026: 4th, 11th, 18th, 25th (4 Sundays).
    // 2 public holidays: Oct 2 and Oct 20.
    // 31 total days - 4 Sundays - 2 Holidays = 25 working days.
    const holidaysOct = [
      new Date(Date.UTC(2026, 9, 2, 0, 0, 0, 0)),
      new Date(Date.UTC(2026, 9, 20, 0, 0, 0, 0)),
    ];

    const workingDaysCount = calculateWorkingDays(2026, 10, holidaysOct, [0]);
    assert(workingDaysCount === 25, `Working days for Oct 2026 (with 4 Sundays & 2 Holidays) is 25 (actual: ${workingDaysCount})`);

    // Create 1 Uninformed Absence on Oct 14, and Present for remaining 24 working days
    const mockRecords = [];
    for (let day = 1; day <= 31; day++) {
      const d = new Date(Date.UTC(2026, 9, day, 0, 0, 0, 0));
      const dayOfWeek = d.getUTCDay();

      if (dayOfWeek === 0) {
        mockRecords.push({ user: testStaff1._id, date: d, status: 'Weekly Off', absenceType: 'None' });
      } else if (holidaysOct.some((h) => h.getTime() === d.getTime())) {
        mockRecords.push({ user: testStaff1._id, date: d, status: 'Holiday', absenceType: 'None' });
      } else if (day === 14) {
        // 1 Uninformed Absence
        mockRecords.push({
          user: testStaff1._id,
          date: d,
          status: 'Absent',
          absenceType: 'Uninformed Absence',
          remarks: 'Uninformed Absence: Check-in deadline (11:00 AM) passed without check-in or approved leave',
        });
      } else {
        mockRecords.push({ user: testStaff1._id, date: d, status: 'Present', absenceType: 'None' });
      }
    }

    await Attendance.insertMany(mockRecords);

    // Compute payroll using pure calculation service
    const attInDb = await Attendance.find({ user: testStaff1._id, date: { $gte: startOct, $lte: endOct } });
    const breakdown1 = computePayroll({
      user: testStaff1,
      month: 10,
      year: 2026,
      attendanceRecords: attInDb,
      priorYtdLeaves: 0,
      holidays: holidaysOct,
    });

    assert(breakdown1.basicSalary === 30000, `Basic salary is ₹30,000 (actual: ${breakdown1.basicSalary})`);
    assert(breakdown1.totalWorkingDays === 25, `Total working days is 25 (actual: ${breakdown1.totalWorkingDays})`);
    assert(breakdown1.dailySalary === 1200, `Daily salary is ₹1,200 (actual: ${breakdown1.dailySalary})`);
    assert(breakdown1.absentDays === 1, `Absent days count is 1 (actual: ${breakdown1.absentDays})`);
    assert(breakdown1.uninformedAbsentDays === 1, `Uninformed absent days is 1 (actual: ${breakdown1.uninformedAbsentDays})`);
    assert(breakdown1.absenceDeduction === 1200, `Absence deduction is ₹1,200 for 1 absence day (actual: ${breakdown1.absenceDeduction})`);
    assert(breakdown1.netSalary === 28800, `Net salary is ₹28,800 (actual: ${breakdown1.netSalary})`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 9: Two Uninformed Absences → ₹2,400 Deduction
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 9: Multiple Uninformed Absences (2 Days = ₹2,400 Deduction) ---');
    // Add another Uninformed Absence on Oct 15
    await Attendance.findOneAndUpdate(
      { user: testStaff1._id, date: new Date(Date.UTC(2026, 9, 15, 0, 0, 0, 0)) },
      {
        user: testStaff1._id,
        date: new Date(Date.UTC(2026, 9, 15, 0, 0, 0, 0)),
        status: 'Absent',
        absenceType: 'Uninformed Absence',
        remarks: 'Uninformed Absence: Check-in deadline (11:00 AM) passed without check-in or approved leave',
      }
    );

    const attInDb2 = await Attendance.find({ user: testStaff1._id, date: { $gte: startOct, $lte: endOct } });
    const breakdown2 = computePayroll({
      user: testStaff1,
      month: 10,
      year: 2026,
      attendanceRecords: attInDb2,
      priorYtdLeaves: 0,
      holidays: holidaysOct,
    });

    assert(breakdown2.absentDays === 2, `Absent days count is 2 (actual: ${breakdown2.absentDays})`);
    assert(breakdown2.uninformedAbsentDays === 2, `Uninformed absent days is 2 (actual: ${breakdown2.uninformedAbsentDays})`);
    assert(breakdown2.absenceDeduction === 2400, `Absence deduction is ₹2,400 for 2 absence days (actual: ${breakdown2.absenceDeduction})`);
    assert(breakdown2.netSalary === 27600, `Net salary is ₹27,600 (actual: ${breakdown2.netSalary})`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 10: Salary Cap Policy (₹50,000 basic capped at ₹40,000)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 10: Salary Cap at ₹40,000 for High Basic Salary ---');
    const breakdownStaff3 = computePayroll({
      user: testStaff3, // Basic ₹50,000
      month: 10,
      year: 2026,
      attendanceRecords: attInDb2, // 2 absent days
      priorYtdLeaves: 0,
      holidays: holidaysOct,
    });

    assert(breakdownStaff3.basicSalary === 50000, `Basic salary is ₹50,000 (actual: ${breakdownStaff3.basicSalary})`);
    assert(breakdownStaff3.applicableSalary === 40000, `Applicable salary capped at ₹40,000 (actual: ${breakdownStaff3.applicableSalary})`);
    // Daily salary = 40000 / 25 = 1600
    assert(breakdownStaff3.dailySalary === 1600, `Daily salary is ₹1,600 (actual: ${breakdownStaff3.dailySalary})`);
    assert(breakdownStaff3.absenceDeduction === 3200, `Deduction for 2 days is ₹3,200 (actual: ${breakdownStaff3.absenceDeduction})`);
    assert(breakdownStaff3.netSalary === 36800, `Net salary is ₹36,800 (actual: ${breakdownStaff3.netSalary})`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 11: Payroll Recalculation Idempotency (Never Duplicates Deductions)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 11: Payroll Recalculation Idempotency ---');
    // Generate payroll first time for Staff 1
    const genReq1 = mockReqRes(testAdmin, {}, { userId: testStaff1._id, month: 10, year: 2026 });
    await generatePayroll(genReq1.req, genReq1.res);
    const genRes1 = genReq1.getResult();

    assert(genRes1.status === 201, `Payroll generated with 201 Created (actual: ${genRes1.status})`);

    const payroll1 = await Payroll.findOne({ user: testStaff1._id, month: 10, year: 2026 });
    assert(Boolean(payroll1), 'Payroll record saved in DB');
    const firstNetSalary = payroll1.netSalary;
    const firstDeduction = payroll1.absenceDeduction;

    // Recalculate payroll second time for the exact same staff and period
    const genReq2 = mockReqRes(testAdmin, {}, { userId: testStaff1._id, month: 10, year: 2026 });
    await generatePayroll(genReq2.req, genReq2.res);

    const payroll2 = await Payroll.findOne({ user: testStaff1._id, month: 10, year: 2026 });
    assert(payroll2.absenceDeduction === firstDeduction, `Absence deduction unchanged upon recalculation: ₹${payroll2.absenceDeduction} === ₹${firstDeduction}`);
    assert(payroll2.netSalary === firstNetSalary, `Net salary unchanged upon recalculation: ₹${payroll2.netSalary} === ₹${firstNetSalary}`);

    const totalPayrollsForMonth = await Payroll.countDocuments({ user: testStaff1._id, month: 10, year: 2026 });
    assert(totalPayrollsForMonth === 1, `Still exactly 1 payroll record exists (no duplicate DB documents created)`);

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 12: Autonomous Absence Processor Service
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 12: Autonomous Background Absence Processor ---');
    // Trigger runAbsenceCheck with force=true
    const checkResult = await runAbsenceCheck(true);
    assert(checkResult.success === true, 'runAbsenceCheck executed successfully');

    // Test Admin Process Absentees Endpoint
    const epReq = mockReqRes(testAdmin, {}, { date: pastWorkingDate });
    await processAbsenteesEndpoint(epReq.req, epReq.res);
    const epRes = epReq.getResult();
    assert(epRes.status === 200, `Admin process-absentees endpoint returns 200 (actual: ${epRes.status})`);
    assert(epRes.data.success === true, 'Admin endpoint response reports success: true');

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 13: Staff, HOD, and Admin API Views Show Consistent Status & Deductions
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- TEST 13: Multi-Role View Consistency (Staff, HOD, Admin) ---');
    // Ensure window closed is simulated for today's queries
    setSimulatedClosedWindow();

    // 13.1 Staff view: getTodayAttendance returns absenceType and dailyDeduction
    const todayReq = mockReqRes(testStaff2); // Staff 2 was marked absent today
    await getTodayAttendance(todayReq.req, todayReq.res);
    const todayRes = todayReq.getResult();

    assert(todayRes.status === 200, 'getTodayAttendance returns 200 OK');
    assert(todayRes.data.data.status === 'Absent', `Staff today status is Absent (actual: ${todayRes.data.data.status})`);
    assert(
      todayRes.data.data.absenceType === 'Uninformed Absence',
      `Staff today absenceType is Uninformed Absence (actual: ${todayRes.data.data.absenceType})`
    );
    assert(todayRes.data.data.dailyDeduction === 1200, `Staff today daily deduction is ₹1,200 (actual: ₹${todayRes.data.data.dailyDeduction})`);

    // 13.2 HOD view: getDailyStaffAttendance shows absenceType and dailyDeduction for department staff
    const hodReq = mockReqRes(testHOD, { date: todayUTC.toISOString() });
    await getDailyStaffAttendance(hodReq.req, hodReq.res);
    const hodRes = hodReq.getResult();

    assert(hodRes.status === 200, 'HOD getDailyStaffAttendance returns 200 OK');
    const staff2InHOD = hodRes.data.data.records.find((r) => r.user._id.toString() === testStaff2._id.toString());
    assert(Boolean(staff2InHOD), 'Staff 2 appears in HOD daily attendance list');
    assert(staff2InHOD?.status === 'Absent', `Staff 2 status in HOD view is Absent (actual: ${staff2InHOD?.status})`);
    assert(
      staff2InHOD?.absenceType === 'Uninformed Absence',
      `Staff 2 in HOD view has absenceType: Uninformed Absence (actual: ${staff2InHOD?.absenceType})`
    );
    assert(
      staff2InHOD?.dailyDeduction === 1200,
      `Staff 2 in HOD view shows daily deduction ₹1,200 (actual: ₹${staff2InHOD?.dailyDeduction})`
    );

    // 13.3 Admin view: getDailyStaffAttendance shows all departments with absenceType and dailyDeduction
    const adminReq = mockReqRes(testAdmin, { date: todayUTC.toISOString() });
    await getDailyStaffAttendance(adminReq.req, adminReq.res);
    const adminRes = adminReq.getResult();

    assert(adminRes.status === 200, 'Admin getDailyStaffAttendance returns 200 OK');
    const staff2InAdmin = adminRes.data.data.records.find((r) => r.user._id.toString() === testStaff2._id.toString());
    assert(Boolean(staff2InAdmin), 'Staff 2 appears in Admin daily attendance list');
    assert(staff2InAdmin?.status === 'Absent', `Staff 2 status in Admin view is Absent`);
    assert(staff2InAdmin?.absenceType === 'Uninformed Absence', `Staff 2 in Admin view has absenceType: Uninformed Absence`);
    assert(staff2InAdmin?.dailyDeduction === 1200, `Staff 2 in Admin view shows daily deduction ₹1,200`);

    console.log('\n========================================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unhandled error during tests:', err);
    process.exit(1);
  } finally {
    // Clean up temporary test data so institute staff count stays pristine (50 staff)
    if (testStaff1) {
      await User.deleteMany({ email: { $in: ['uat_staff1@bit.edu', 'uat_staff2@bit.edu', 'uat_staff3@bit.edu', 'uat_hod@bit.edu', 'uat_admin@bit.edu'] } });
      await Attendance.deleteMany({ user: { $in: [testStaff1._id, testStaff2._id, testStaff3._id] } });
      await Leave.deleteMany({ user: { $in: [testStaff1._id, testStaff2._id, testStaff3._id] } });
      await Payroll.deleteMany({ user: { $in: [testStaff1._id, testStaff2._id, testStaff3._id] } });
      if (testDept) await Department.findByIdAndDelete(testDept._id);
    }

    // Restore original attendance config
    if (originalConfig) {
      updateAttendanceConfig(originalConfig);
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

runTests();
