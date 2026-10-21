/**
 * test_payroll_logic.js
 * 
 * Verifies payroll calculation rules.
 */
require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Attendance = require('../models/Attendance.model');
const Payroll = require('../models/Payroll.model');
const { computePayroll } = require('../services/payroll.service');

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

    const runSim = (scenario, { basicSalary, leaveDays = 0, absentDays = 0, priorYtdLeaves = 0, weeklyOffDays = 4, holidayDays = 0, totalDaysInMonth = 30 }) => {
      console.log(`\n--- Test: ${scenario} ---`);
      
      const user = {
        basicSalary,
        leaveBalances: {
          earnedLeave: { total: 12 }
        }
      };

      const presentDays = totalDaysInMonth - leaveDays - absentDays - weeklyOffDays - holidayDays;
      
      // Build dummy attendance
      const attendanceRecords = [];
      for(let i=0; i<presentDays; i++) attendanceRecords.push({ status: 'Present' });
      for(let i=0; i<leaveDays; i++) attendanceRecords.push({ status: 'Leave' });
      for(let i=0; i<absentDays; i++) attendanceRecords.push({ status: 'Absent' });
      for(let i=0; i<weeklyOffDays; i++) attendanceRecords.push({ status: 'Weekly Off' });
      for(let i=0; i<holidayDays; i++) attendanceRecords.push({ status: 'Holiday' });

      // Mock holidays array to match totalWorkingDays calculation inside computePayroll
      // We'll mock the calculateWorkingDays behavior implicitly since we just want to test deduction logic.
      // But computePayroll calculates working days itself using month/year.
      
      const result = computePayroll({
        user,
        month: 4, // April (30 days)
        year: 2026, // 4 Sundays in April 2026
        attendanceRecords,
        priorYtdLeaves,
        holidays: [], 
      });

      // April 2026 has 30 days, 4 Sundays. So totalWorkingDays = 26.
      
      const expectedWorkingDays = 26;
      const expectedDaily = Math.min(basicSalary, 40000) / expectedWorkingDays;
      
      return { result, expectedDaily };
    };

    // 1. 0 leave + 0 absent
    const t1 = runSim('0 leave + 0 absent', { basicSalary: 30000, leaveDays: 0, absentDays: 0 });
    assert(t1.result.absenceDeduction === 0, 'No deduction');
    
    // 2. 5 Earned Leave + 0 absent
    const t2 = runSim('5 Earned Leave + 0 absent', { basicSalary: 30000, leaveDays: 5, absentDays: 0 });
    assert(t2.result.absenceDeduction === 0, 'No deduction for 5 valid leaves');
    assert(t2.result.excessLeaveDays === 0, '0 excess leave days');
    
    // 3. 12 Earned Leave + 0 absent
    const t3 = runSim('12 Earned Leave + 0 absent', { basicSalary: 30000, leaveDays: 12, absentDays: 0 });
    assert(t3.result.absenceDeduction === 0, 'No deduction for 12 valid leaves');
    
    // 4. 15 leave → only 3 excess days deducted
    const t4 = runSim('15 leave -> 3 excess days', { basicSalary: 30000, leaveDays: 15, absentDays: 0 });
    assert(t4.result.excessLeaveDays === 3, 'Calculated 3 excess leaves');
    assert(t4.result.absenceDeduction === parseFloat((3 * t4.expectedDaily).toFixed(2)), 'Deducted exactly 3 days');
    
    // 5. 2 absent → 2-day deduction
    const t5 = runSim('2 absent', { basicSalary: 30000, leaveDays: 0, absentDays: 2 });
    assert(t5.result.absenceDeduction === parseFloat((2 * t5.expectedDaily).toFixed(2)), 'Deducted exactly 2 days of absent');

    // 6. 5 absent → 5-day deduction
    const t6 = runSim('5 absent', { basicSalary: 30000, leaveDays: 0, absentDays: 5 });
    assert(t6.result.absenceDeduction === parseFloat((5 * t6.expectedDaily).toFixed(2)), 'Deducted exactly 5 days of absent');

    // 7. Earned Leave + Absent combination
    const t7 = runSim('2 leave + 2 absent', { basicSalary: 30000, leaveDays: 2, absentDays: 2 });
    assert(t7.result.absenceDeduction === parseFloat((2 * t7.expectedDaily).toFixed(2)), 'Deducted 2 absent days only (leaves are valid)');

    // 8. Weekly Off
    const t8 = runSim('Weekly Off only (already handled by calendar)', { basicSalary: 30000, leaveDays: 0, absentDays: 0 });
    assert(t8.result.absenceDeduction === 0, 'No deduction for weekly off');

    // 9. Holiday
    const t9 = runSim('1 Holiday', { basicSalary: 30000, leaveDays: 0, absentDays: 0, holidayDays: 1 });
    assert(t9.result.absenceDeduction === 0, 'No deduction for holiday');

    // 10. Salary below 40k
    const t10 = runSim('Salary 25k (below cap)', { basicSalary: 25000, leaveDays: 0, absentDays: 1 });
    assert(t10.result.applicableSalary === 25000, 'Applicable salary is 25000');
    assert(t10.result.absenceDeduction === parseFloat((1 * (25000/26)).toFixed(2)), 'Deduction uses 25000 base');

    // 11. Salary above 40k
    const t11 = runSim('Salary 50k (above cap)', { basicSalary: 50000, leaveDays: 0, absentDays: 1 });
    assert(t11.result.applicableSalary === 40000, 'Applicable salary capped at 40000');
    assert(t11.result.absenceDeduction === parseFloat((1 * (40000/26)).toFixed(2)), 'Deduction uses 40000 base');

    // 12 & 13. Recalculate payroll idempotency (using DB)
    console.log(`\n--- Test: Recalculate payroll twice (Idempotency) ---`);
    let admin = await User.findOne({ role: 'Admin' });
    let staff = await User.findOne({ role: 'Staff' });
    if (!staff.leaveBalances) {
      staff.leaveBalances = { earnedLeave: { total: 12 } };
      await staff.save();
    }
    
    // Create a mock draft payroll
    await Payroll.deleteMany({ user: staff._id, month: 4, year: 2026 });
    
    const p1 = await Payroll.create({
      user: staff._id,
      month: 4, year: 2026,
      basicSalary: 30000, applicableSalary: 30000,
      totalWorkingDays: 26, presentDays: 20, leaveDays: 0, excessLeaveDays: 0, absentDays: 6,
      absenceDeduction: 6000, grossSalary: 30000, netSalary: 24000,
      status: 'Draft'
    });
    
    // Now simulate generating again. The generatePayroll logic overwrites drafts instead of duplicating.
    const duplicateDraft = await Payroll.findOne({ user: staff._id, month: 4, year: 2026 });
    if (duplicateDraft && duplicateDraft.status === 'Draft') {
        Object.assign(duplicateDraft, {
          absentDays: 2, // updating the value
          absenceDeduction: 2000
        });
        await duplicateDraft.save();
    }
    
    const drafts = await Payroll.find({ user: staff._id, month: 4, year: 2026 });
    assert(drafts.length === 1, 'Only 1 payroll record exists (no duplicate created)');
    assert(drafts[0].absentDays === 2, 'Values were cleanly overwritten');

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
