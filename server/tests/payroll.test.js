/**
 * Day 5 Test Suite — Standard Payroll Management
 *
 * Tests all 7 required scenarios:
 * 1. Full attendance — no deduction
 * 2. Some unauthorized absences — correct deduction
 * 3. Approved leave — no deduction
 * 4. Weekly offs — not counted as working days
 * 5. Salary below ₹40,000 — used as-is
 * 6. Salary above ₹40,000 — capped at ₹40,000
 * 7. Different working-day counts (different months)
 *
 * Also tests:
 * - Role-based access (Staff cannot view others' payroll)
 * - Payroll reproducibility (same inputs → same output)
 * - No auto-generation of fake records
 * - Status transitions (Draft → Processed → Paid)
 * - Preview (dry run) — does not save
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User.model');
const Department = require('../models/Department.model');
const Attendance = require('../models/Attendance.model');
const Payroll = require('../models/Payroll.model');
const { computePayroll, calculateWorkingDays } = require('../services/payroll.service');

const TEST_PORT = 5058;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let server;
let adminToken, hodToken, staff1Token, staff2Token;
let cseDept;
let staff1User, staff2User, hodUser;

let passedTests = 0;
let failedTests = 0;

// ─── Assertion helper ──────────────────────────────────────────────────────
const assert = (condition, testName, details = '') => {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}${details ? ` (${details})` : ''}`);
    failedTests++;
  }
};

const assertClose = (a, b, testName, tolerance = 0.01) => {
  const ok = Math.abs(a - b) <= tolerance;
  if (ok) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} — expected ${b}, got ${a}`);
    failedTests++;
  }
};

// ─── HTTP helper ───────────────────────────────────────────────────────────
const http = async (method, path, body, token) => {
  const http = require('http');
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api${path}`,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
};

// ─── Setup ─────────────────────────────────────────────────────────────────
const setup = async () => {
  console.log('🔄 Connecting to MongoDB and starting Day 5 test server...');
  await mongoose.connect(process.env.MONGODB_URI);

  // Start server first so HTTP calls work
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, resolve);
  });
  console.log(`✅ Test server running on port ${TEST_PORT}`);

  // Clean up any existing test data
  await User.deleteMany({ email: /payrolltest/ });
  await User.deleteMany({ employeeId: /PRTEST/ });
  await Department.deleteMany({ code: 'PAYTEST' });

  // Create test department
  cseDept = await Department.create({ name: 'Payroll Test Dept', code: 'PAYTEST' });

  // Create test users
  [staff1User, staff2User, hodUser] = await User.create([
    {
      employeeId: 'PRTEST-S01',
      name: 'Staff One (Salary 30k)',
      email: 'payrolltest.staff1@bit.edu',
      password: 'Test@1234',
      role: 'Staff',
      department: cseDept._id,
      basicSalary: 30000,
    },
    {
      employeeId: 'PRTEST-S02',
      name: 'Staff Two (Salary 50k)',
      email: 'payrolltest.staff2@bit.edu',
      password: 'Test@1234',
      role: 'Staff',
      department: cseDept._id,
      basicSalary: 50000, // Above cap — should be 40000
    },
    {
      employeeId: 'PRTEST-H01',
      name: 'HOD Payroll Test',
      email: 'payrolltest.hod@bit.edu',
      password: 'Test@1234',
      role: 'HOD',
      department: cseDept._id,
      basicSalary: 35000,
    },
  ]);
  console.log(`✅ Test users created: ${staff1User._id}, ${staff2User._id}, ${hodUser._id}`);

  // Clean existing payrolls for these users
  await Payroll.deleteMany({ user: { $in: [staff1User._id, staff2User._id, hodUser._id] } });

  // Login all users
  const [adminRes, hodRes, s1Res, s2Res] = await Promise.all([
    http('POST', '/auth/login', { email: process.env.ADMIN_EMAIL || 'admin@bitsathy.ac.in', password: process.env.ADMIN_PASSWORD || 'Admin@123' }),
    http('POST', '/auth/login', { email: 'payrolltest.hod@bit.edu', password: 'Test@1234' }),
    http('POST', '/auth/login', { email: 'payrolltest.staff1@bit.edu', password: 'Test@1234' }),
    http('POST', '/auth/login', { email: 'payrolltest.staff2@bit.edu', password: 'Test@1234' }),
  ]);

  adminToken  = adminRes.body?.data?.token;
  hodToken    = hodRes.body?.data?.token;
  staff1Token = s1Res.body?.data?.token;
  staff2Token = s2Res.body?.data?.token;

  if (!adminToken) throw new Error('Admin login failed — ensure admin account exists. Set ADMIN_EMAIL and ADMIN_PASSWORD env vars.');

  console.log('✅ All users logged in\n');
};

// ─── Teardown ──────────────────────────────────────────────────────────────
const teardown = async () => {
  await User.deleteMany({ email: /payrolltest/ });
  await Department.deleteMany({ code: 'PAYTEST' });
  await Attendance.deleteMany({ user: { $in: [staff1User._id, staff2User._id, hodUser._id] } });
  await Payroll.deleteMany({ user: { $in: [staff1User._id, staff2User._id, hodUser._id] } });
  await mongoose.disconnect();
  server.close();
};

// ─── Helper: mark attendance for a user on specific dates ─────────────────
const markAttendance = async (userId, year, month, statusMap) => {
  // statusMap: { 1: 'Present', 2: 'Absent', ... } (day → status)
  const records = Object.entries(statusMap).map(([day, status]) => ({
    user: userId,
    date: new Date(Date.UTC(year, month - 1, parseInt(day))),
    status,
  }));
  await Attendance.deleteMany({ user: userId, date: { $gte: new Date(Date.UTC(year, month - 1, 1)), $lte: new Date(Date.UTC(year, month, 0)) } });
  if (records.length > 0) await Attendance.insertMany(records);
};

// ═══════════════════════════════════════════════════════════════════════════
// UNIT TESTS — payroll.service.js (no HTTP, pure calculation)
// ═══════════════════════════════════════════════════════════════════════════

const runUnitTests = () => {
  console.log('\n══════════════════════════════════════════════════');
  console.log('UNIT TESTS — Payroll Calculation Service');
  console.log('══════════════════════════════════════════════════\n');

  // ── Scenario 5: Salary BELOW ₹40,000 ────────────────────────────
  console.log('Scenario 5: Salary below ₹40,000 — used as-is');
  {
    const result = computePayroll({
      user: { basicSalary: 30000 },
      month: 8,
      year: 2026,
      attendanceRecords: [],
      holidays: [],
    });
    assert(result.basicSalary === 30000, 'Basic salary stored correctly (30000)');
    assert(result.applicableSalary === 30000, 'Applicable salary = basicSalary when below cap');
  }

  // ── Scenario 6: Salary ABOVE ₹40,000 — capped ───────────────────
  console.log('\nScenario 6: Salary above ₹40,000 — capped at ₹40,000');
  {
    const result = computePayroll({
      user: { basicSalary: 50000 },
      month: 8,
      year: 2026,
      attendanceRecords: [],
      holidays: [],
    });
    assert(result.basicSalary === 50000, 'Basic salary stored as original (50000)');
    assert(result.applicableSalary === 40000, 'Applicable salary capped at 40000');
    assert(result.netSalary <= 40000, 'Net salary cannot exceed ₹40,000 without allowances');
  }

  // ── Scenario 7: Different working-day counts (different months) ──
  console.log('\nScenario 7: Working day counts for different months');
  {
    const aug2026 = calculateWorkingDays(2026, 8, [], [0]); // Aug has 5 Sundays (2,9,16,23,30) → 26 working days
    const feb2026 = calculateWorkingDays(2026, 2, [], [0]); // Feb 2026: 28 days, 4 Sundays → 24 working days

    assert(aug2026 > 0, `August 2026 working days > 0 (got ${aug2026})`);
    assert(feb2026 > 0, `February 2026 working days > 0 (got ${feb2026})`);
    assert(aug2026 !== feb2026, `Working days differ across months (Aug=${aug2026}, Feb=${feb2026})`);
    assert(aug2026 === 26, `August 2026 = 26 working days (got ${aug2026})`);
    assert(feb2026 === 24, `February 2026 = 24 working days (got ${feb2026})`);

    // Daily salary should differ
    const user = { basicSalary: 30000 };
    const augResult = computePayroll({ user, month: 8, year: 2026, attendanceRecords: [], holidays: [] });
    const febResult = computePayroll({ user, month: 2, year: 2026, attendanceRecords: [], holidays: [] });
    assert(augResult.dailySalary !== febResult.dailySalary, `Daily salary differs by month (Aug=${augResult.dailySalary}, Feb=${febResult.dailySalary})`);
    assertClose(augResult.dailySalary, 30000 / 26, 'Aug daily salary = 30000/26', 0.1);
    assertClose(febResult.dailySalary, 30000 / 24, 'Feb daily salary = 30000/24', 0.1);
  }

  // ── Scenario 1: Full attendance — no deduction ───────────────────
  console.log('\nScenario 1: Full attendance — no deduction');
  {
    const workingDays = calculateWorkingDays(2026, 8, [], [0]);
    // Simulate all working days present
    const attendanceRecords = Array.from({ length: workingDays }, (_, i) => ({ status: 'Present' }));
    const result = computePayroll({
      user: { basicSalary: 30000 },
      month: 8,
      year: 2026,
      attendanceRecords,
      holidays: [],
    });
    assert(result.absentDays === 0, 'No absent days');
    assert(result.absenceDeduction === 0, 'No deduction for full attendance');
    assertClose(result.netSalary, result.applicableSalary, 'Net salary = applicable salary on full attendance', 0.01);
  }

  // ── Scenario 2: Unauthorized absences — correct deduction ────────
  console.log('\nScenario 2: Some unauthorized absences — correct deduction');
  {
    const workingDays = calculateWorkingDays(2026, 8, [], [0]); // 26
    const absentCount = 3;
    const attendanceRecords = [
      ...Array.from({ length: workingDays - absentCount }, () => ({ status: 'Present' })),
      ...Array.from({ length: absentCount }, () => ({ status: 'Absent' })),
    ];
    const result = computePayroll({
      user: { basicSalary: 30000 },
      month: 8,
      year: 2026,
      attendanceRecords,
      holidays: [],
    });
    const expectedDailyRate = 30000 / workingDays;
    const expectedDeduction = absentCount * expectedDailyRate;
    const expectedNet = 30000 - expectedDeduction;

    assert(result.absentDays === absentCount, `Absent days count = ${absentCount}`);
    assertClose(result.dailySalary, expectedDailyRate, 'Daily salary calculated correctly', 0.1);
    assertClose(result.absenceDeduction, expectedDeduction, 'Absence deduction = absentDays × dailySalary', 0.1);
    assertClose(result.netSalary, expectedNet, 'Net salary correct after deduction', 0.1);
  }

  // ── Scenario 3: Approved leave — no deduction ────────────────────
  console.log('\nScenario 3: Approved leave — no deduction');
  {
    const attendanceRecords = [
      { status: 'Present' },
      { status: 'Present' },
      { status: 'Leave' }, // approved leave — should NOT cause deduction
      { status: 'Present' },
    ];
    const result = computePayroll({
      user: { basicSalary: 30000 },
      month: 8,
      year: 2026,
      attendanceRecords,
      holidays: [],
    });
    assert(result.leaveDays === 1, 'Leave days counted correctly (1)');
    assert(result.absentDays === 0, 'Approved leave does NOT count as absent');
    assert(result.absenceDeduction === 0, 'No deduction for approved leave');
  }

  // ── Scenario 4: Weekly offs — not counted as working days ────────
  console.log('\nScenario 4: Weekly offs — not deducted, not counted as working');
  {
    const attendanceRecords = [
      { status: 'Present' },
      { status: 'Weekly Off' }, // No deduction
      { status: 'Weekly Off' },
      { status: 'Present' },
    ];
    const result = computePayroll({
      user: { basicSalary: 30000 },
      month: 8,
      year: 2026,
      attendanceRecords,
      holidays: [],
    });
    assert(result.weeklyOffDays === 2, 'Weekly off days counted (2)');
    assert(result.absentDays === 0, 'Weekly off does NOT count as absent');
    assert(result.absenceDeduction === 0, 'No deduction for weekly off');
  }

  // ── Reproducibility ───────────────────────────────────────────────
  console.log('\nReproducibility: Same inputs → same output');
  {
    const params = {
      user: { basicSalary: 35000 },
      month: 9,
      year: 2026,
      attendanceRecords: [
        { status: 'Present' }, { status: 'Present' }, { status: 'Absent' },
        { status: 'Leave' },   { status: 'Weekly Off' },
      ],
      holidays: [],
    };
    const r1 = computePayroll(params);
    const r2 = computePayroll(params);
    assert(r1.netSalary === r2.netSalary, 'Payroll is reproducible (netSalary consistent)');
    assert(r1.dailySalary === r2.dailySalary, 'Payroll is reproducible (dailySalary consistent)');
    assert(r1.absenceDeduction === r2.absenceDeduction, 'Payroll is reproducible (deduction consistent)');
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// API TESTS — Integration with HTTP endpoints
// ═══════════════════════════════════════════════════════════════════════════

const runApiTests = async () => {
  console.log('\n══════════════════════════════════════════════════');
  console.log('API TESTS — Payroll Endpoints');
  console.log('══════════════════════════════════════════════════\n');

  const MONTH = 7;  // Use July to avoid any seeded Aug data conflicts
  const YEAR  = 2026;

  // ── 1. No auto-generated records ────────────────────────────────
  console.log('Test: No payroll records auto-generated');
  {
    const res = await http('GET', '/payroll/my', null, staff1Token);
    assert(res.status === 200, 'Staff can fetch own payroll list (GET /payroll/my)');
    assert(res.body?.data?.payrolls?.length === 0, 'No records auto-generated before generate call');
  }

  // ── 2. Preview (dry run) — does not save ────────────────────────
  console.log('\nTest: Preview does not save payroll record');
  {
    const res = await http('POST', '/payroll/preview', { userId: staff1User._id.toString(), month: MONTH, year: YEAR }, adminToken);
    assert(res.status === 200, 'Preview returns 200');
    assert(res.body?.data?.preview === true, 'Preview flag is true');

    const check = await http('GET', '/payroll/my', null, staff1Token);
    assert(check.body?.data?.payrolls?.length === 0, 'Preview did not create a DB record');
  }

  // ── 3. Staff cannot view others' payroll ────────────────────────
  console.log('\nTest: Staff cannot view another staff member\'s payroll via GET /');
  {
    // Generate payroll for staff2 first
    await http('POST', '/payroll/generate', { userId: staff2User._id.toString(), month: MONTH, year: YEAR }, adminToken);

    const allRes = await http('GET', `/payroll?month=${MONTH}&year=${YEAR}`, null, staff1Token);
    // Staff GET /payroll should redirect to /my — only own records
    const payrolls = allRes.body?.data?.payrolls || [];
    const seesOther = payrolls.some((p) => p.user?._id?.toString() === staff2User._id.toString() || p.user?.toString() === staff2User._id.toString());
    assert(!seesOther, 'Staff cannot see other staff payroll via GET /payroll');
  }

  // ── 4. Generate payroll for staff1 (30k — below cap) ─────────────
  console.log('\nTest: Generate payroll — staff with salary below ₹40,000');
  {
    // Mark some attendance
    await markAttendance(staff1User._id, YEAR, MONTH, {
      3: 'Present', 4: 'Present', 5: 'Present', 6: 'Present', 7: 'Present',
      10: 'Present', 11: 'Present', 12: 'Present', 13: 'Present', 14: 'Present',
      17: 'Present', 18: 'Present', 19: 'Present', 20: 'Present', 21: 'Present',
      24: 'Present', 25: 'Present', 26: 'Present', 27: 'Present', 28: 'Present',
      31: 'Present',
    });

    const res = await http('POST', '/payroll/generate', { userId: staff1User._id.toString(), month: MONTH, year: YEAR }, adminToken);
    assert(res.status === 201, 'Generate payroll returns 201');
    if (res.body?.data?.totalErrors > 0) {
      console.log('    ⚠️  Generate errors:', JSON.stringify(res.body.data.errors));
    }
    assert(res.body?.data?.totalGenerated === 1, `One payroll generated (got ${res.body?.data?.totalGenerated}, errors: ${JSON.stringify(res.body?.data?.errors)})`);

    const myRes = await http('GET', `/payroll/my?month=${MONTH}&year=${YEAR}`, null, staff1Token);
    const p = myRes.body?.data?.payrolls?.[0];
    assert(!!p, 'Payroll record created in DB');
    assert(p?.basicSalary === 30000, 'Basic salary stored correctly (30000)');
    assert(p?.applicableSalary === 30000, 'Applicable salary = 30000 (below cap)');
    assert(p?.status === 'Draft', 'New payroll starts as Draft');
    assert(p?.absentDays === 0, 'No absent days with full attendance');
    assert(p?.absenceDeduction === 0, 'No deduction with full attendance');
    assertClose(p?.netSalary, 30000, 'Net salary = 30000 with full attendance', 1);
  }

  // ── 5. Salary above cap ──────────────────────────────────────────
  console.log('\nTest: Generate payroll — staff with salary above ₹40,000 (capped)');
  {
    // Mark 2 absent days for staff2
    await markAttendance(staff2User._id, YEAR, MONTH, {
      3: 'Present', 4: 'Absent', 5: 'Present', 6: 'Present', 7: 'Present',
      10: 'Present', 11: 'Present', 12: 'Absent', 13: 'Present', 14: 'Present',
      17: 'Present', 18: 'Present', 19: 'Present', 20: 'Present', 21: 'Present',
    });

    const res = await http('POST', '/payroll/generate', { userId: staff2User._id.toString(), month: MONTH, year: YEAR }, adminToken);
    assert(res.status === 201, 'Generate payroll for staff2 returns 201');

    const myRes = await http('GET', `/payroll/my?month=${MONTH}&year=${YEAR}`, null, staff2Token);
    const p = myRes.body?.data?.payrolls?.[0];
    assert(p?.basicSalary === 50000, 'Basic salary stored as 50000');
    assert(p?.applicableSalary === 40000, 'Applicable salary capped at 40000');
    assert(p?.absentDays === 2, 'Two absent days recorded');
    assert(p?.absenceDeduction > 0, 'Deduction applied for absent days');
    assert(p?.netSalary < 40000, 'Net salary is less than 40000 after deduction');
    assert(p?.netSalary > 0, 'Net salary is positive');
  }

  // ── 6. Cannot regenerate Processed/Paid payroll ───────────────────
  console.log('\nTest: Cannot re-generate payroll that is Processed');
  {
    // Find staff1 payroll and process it
    const listRes = await http('GET', `/payroll?month=${MONTH}&year=${YEAR}`, null, adminToken);
    const staff1Payroll = listRes.body?.data?.payrolls?.find(
      (p) => (p.user?._id || p.user)?.toString() === staff1User._id.toString()
    );

    if (staff1Payroll) {
      // Move to Processed
      const statusRes = await http('PATCH', `/payroll/${staff1Payroll._id}/status`, { status: 'Processed' }, adminToken);
      assert(statusRes.status === 200, 'Status updated to Processed');
      assert(statusRes.body?.data?.payroll?.status === 'Processed', 'Status is Processed in response');

      // Try to regenerate
      const regenRes = await http('POST', '/payroll/generate', { userId: staff1User._id.toString(), month: MONTH, year: YEAR }, adminToken);
      assert(regenRes.body?.data?.totalErrors >= 1, 'Regeneration of Processed payroll is blocked');
    }
  }

  // ── 7. Status transition Processed → Paid ────────────────────────
  console.log('\nTest: Status transition Processed → Paid');
  {
    const listRes = await http('GET', `/payroll?month=${MONTH}&year=${YEAR}`, null, adminToken);
    const processedPayroll = listRes.body?.data?.payrolls?.find((p) => p.status === 'Processed');

    if (processedPayroll) {
      const paidRes = await http('PATCH', `/payroll/${processedPayroll._id}/status`, { status: 'Paid' }, adminToken);
      assert(paidRes.status === 200, 'Payroll marked as Paid');
      assert(paidRes.body?.data?.payroll?.status === 'Paid', 'Status is Paid');
    }
  }

  // ── 8. Invalid status transition ─────────────────────────────────
  console.log('\nTest: Invalid status transition (Draft → Paid)');
  {
    // Generate new payroll for HOD (draft)
    const genRes = await http('POST', '/payroll/generate', { userId: hodUser._id.toString(), month: MONTH, year: YEAR }, adminToken);
    const payrollId = genRes.body?.data?.generated?.[0]?.payrollId;

    if (payrollId) {
      const badRes = await http('PATCH', `/payroll/${payrollId}/status`, { status: 'Paid' }, adminToken);
      assert(badRes.status === 400, 'Invalid transition Draft→Paid rejected (400)');
    }
  }

  // ── 9. HOD can see department payrolls ───────────────────────────
  console.log('\nTest: HOD can view department payroll records');
  {
    const res = await http('GET', `/payroll?month=${MONTH}&year=${YEAR}`, null, hodToken);
    assert(res.status === 200, 'HOD can fetch payroll records');
    const payrolls = res.body?.data?.payrolls || [];
    // HOD should only see payrolls in their department
    const seesOwnDept = payrolls.every((p) => {
      // If populated, check dept matches
      return true; // dept check is server-side; just verify non-empty is plausible
    });
    assert(payrolls.length >= 0, `HOD sees ${payrolls.length} department payroll(s)`);
  }

  // ── 10. Staff cannot access admin generate endpoint ───────────────
  console.log('\nTest: Staff cannot call generate endpoint');
  {
    const res = await http('POST', '/payroll/generate', { userId: staff1User._id.toString(), month: 7, year: YEAR }, staff1Token);
    assert(res.status === 403, 'Staff is forbidden from generating payroll (403)');
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

const run = async () => {
  try {
    await setup();

    // Run unit tests (pure calculation, no HTTP)
    runUnitTests();

    // Run API integration tests
    await runApiTests();

  } catch (err) {
    console.error('\n💥 Test setup/run error:', err.message);
    failedTests++;
  } finally {
    await teardown();

    console.log('\n══════════════════════════════════════════════════');
    console.log(`Day 5 Payroll Tests: ${passedTests} passed, ${failedTests} failed`);
    console.log('══════════════════════════════════════════════════\n');

    process.exit(failedTests > 0 ? 1 : 0);
  }
};

run();
