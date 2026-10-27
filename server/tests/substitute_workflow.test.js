/**
 * Automated test suite for Substitute Request Workflow & 2-Staff Department Leave Policy
 * Run with: node server/tests/substitute_workflow.test.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const User = require('../models/User.model');
const Leave = require('../models/Leave.model');
const Attendance = require('../models/Attendance.model');
const Department = require('../models/Department.model');
const Notification = require('../models/Notification.model');

const {
  checkDepartmentLeaveLimit,
  applyLeave,
  approveLeave,
  rejectLeave,
  getMySubstituteRequests,
  respondToSubstituteRequest,
  reassignSubstitute,
} = require('../controllers/leave.controller');

const { checkIn, getTodayAttendance } = require('../controllers/attendance.controller');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Mock express req/res
function mockReqRes(body = {}, params = {}, query = {}, user = null) {
  let statusCode = 200;
  let responseData = null;

  const req = {
    body,
    params,
    query,
    user,
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function runTests() {
  console.log('========================================================');
  console.log('TEST SUITE: Substitute Request Workflow & Department Limits');
  console.log('========================================================\n');

  await connectDB();

  // Find departments and non-teaching staff
  const departments = await Department.find();
  assert(departments.length >= 2, 'Found at least 2 departments in database');

  const dept1 = departments[0];
  const dept2 = departments[1];

  const dept1Staff = await User.find({
    department: dept1._id,
    role: { $in: ['Staff', 'Non-Teaching Staff'] },
    isActive: true,
  });
  assert(dept1Staff.length >= 3, `Dept 1 (${dept1.name}) has at least 3 staff members (found ${dept1Staff.length})`);

  const dept2Staff = await User.find({
    department: dept2._id,
    role: { $in: ['Staff', 'Non-Teaching Staff'] },
    isActive: true,
  });
  assert(dept2Staff.length >= 2, `Dept 2 (${dept2.name}) has at least 2 staff members (found ${dept2Staff.length})`);

  const hod1 = await User.findOne({ department: dept1._id, role: 'HOD' });
  assert(!!hod1, `Found HOD for Dept 1 (${dept1.name})`);

  const staffA = dept1Staff[0];
  const staffB = dept1Staff[1];
  const staffC = dept1Staff[2];
  const staffD_CrossDept = dept2Staff[0];
  const staffE_CrossDept = dept2Staff[1];

  // Test dates far in future to avoid polluting active data
  const testDateStr = '2027-04-12';
  const testDate = new Date(`${testDateStr}T00:00:00.000Z`);

  // Multi-day test dates
  const multiStartStr = '2027-05-10';
  const multiEndStr = '2027-05-12';
  const multiMidStr = '2027-05-11';

  try {
    // Clean up any test records
    await Leave.deleteMany({
      fromDate: { $in: [testDate, new Date(`${multiStartStr}T00:00:00.000Z`)] },
    });
    await Attendance.deleteMany({
      date: { $in: [testDate, new Date(`${multiStartStr}T00:00:00.000Z`), new Date(`${multiMidStr}T00:00:00.000Z`), new Date(`${multiEndStr}T00:00:00.000Z`)] },
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: Department limit calculation (0, 1, 2 approved leaves)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 1: Department Limit Calculation ---');
    let limitCheck = await checkDepartmentLeaveLimit(dept1._id, testDate, testDate);
    assert(limitCheck.requiresSubstitute === false, 'Initially 0 approved leaves: substitute NOT required');
    assert(limitCheck.maxApprovedOnAnyDate === 0, 'Max approved count is 0');

    // Create and approve Staff A's leave
    const leaveA = await Leave.create({
      user: staffA._id,
      department: dept1._id,
      type: 'Casual Leave',
      fromDate: testDate,
      toDate: testDate,
      totalDays: 1,
      reason: 'Personal reason staff A',
      status: 'Approved',
      approvedBy: hod1._id,
      approvedAt: new Date(),
    });

    limitCheck = await checkDepartmentLeaveLimit(dept1._id, testDate, testDate);
    assert(limitCheck.requiresSubstitute === false, '1 approved leave in dept: substitute NOT required (limit is 2)');
    assert(limitCheck.maxApprovedOnAnyDate === 1, 'Max approved count is 1');

    // Create and approve Staff B's leave
    const leaveB = await Leave.create({
      user: staffB._id,
      department: dept1._id,
      type: 'Casual Leave',
      fromDate: testDate,
      toDate: testDate,
      totalDays: 1,
      reason: 'Personal reason staff B',
      status: 'Approved',
      approvedBy: hod1._id,
      approvedAt: new Date(),
    });

    limitCheck = await checkDepartmentLeaveLimit(dept1._id, testDate, testDate);
    assert(limitCheck.requiresSubstitute === true, '2 approved leaves in dept: substitute IS required for 3rd staff member');
    assert(limitCheck.maxApprovedOnAnyDate === 2, 'Max approved count is 2');
    assert(limitCheck.datesExceedingLimit.includes(testDateStr), `Dates exceeding limit includes ${testDateStr}`);

    // Cross-department check: dept2 should NOT be affected
    const dept2LimitCheck = await checkDepartmentLeaveLimit(dept2._id, testDate, testDate);
    assert(dept2LimitCheck.requiresSubstitute === false, 'Dept 2 has 0 approved leaves: substitute NOT required for Dept 2');

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: Third staff member application (Staff C)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 2: 3rd Staff Member Application ---');

    // 2.1 Staff C applies WITHOUT substitute -> Must be rejected with 400
    {
      const { req, res, getStatus, getData } = mockReqRes(
        {
          type: 'Casual Leave',
          startDate: testDateStr,
          endDate: testDateStr,
          reason: 'Family function staff C',
        },
        {},
        {},
        staffC
      );

      await applyLeave(req, res);
      assert(getStatus() === 400, 'Apply without substitute returned HTTP 400');
      assert(
        getData().message.includes('substitute is required'),
        `Error mentions substitute is required: "${getData().message}"`
      );
    }

    // 2.2 Staff C tries to select themselves as substitute -> Must be rejected
    {
      const { req, res, getStatus, getData } = mockReqRes(
        {
          type: 'Casual Leave',
          startDate: testDateStr,
          endDate: testDateStr,
          reason: 'Family function staff C',
          substitute: staffC._id,
        },
        {},
        {},
        staffC
      );

      await applyLeave(req, res);
      assert(getStatus() === 400, 'Selecting self as substitute returned HTTP 400');
      assert(
        getData().message.includes('cannot select yourself'),
        `Error mentions self-selection: "${getData().message}"`
      );
    }

    // 2.3 Staff C tries to select Staff A (who is already on approved leave) -> Must be rejected
    {
      const { req, res, getStatus, getData } = mockReqRes(
        {
          type: 'Casual Leave',
          startDate: testDateStr,
          endDate: testDateStr,
          reason: 'Family function staff C',
          substitute: staffA._id,
        },
        {},
        {},
        staffC
      );

      await applyLeave(req, res);
      assert(getStatus() === 400, 'Selecting staff already on approved leave returned HTTP 400');
      assert(
        getData().message.includes('on approved leave'),
        `Error mentions substitute on leave: "${getData().message}"`
      );
    }

    // 2.4 Staff C selects cross-department substitute (Staff D from Dept 2) -> Must succeed!
    let staffCLeaveId = null;
    {
      const { req, res, getStatus, getData } = mockReqRes(
        {
          type: 'Casual Leave',
          startDate: testDateStr,
          endDate: testDateStr,
          reason: 'Family function staff C',
          substitute: staffD_CrossDept._id,
        },
        {},
        {},
        staffC
      );

      await applyLeave(req, res);
      assert(getStatus() === 201, 'Apply with valid cross-department substitute returned HTTP 201');
      assert(getData().data?.leave?.requiresSubstitute === true, 'Leave requiresSubstitute flag is true');
      assert(getData().data?.leave?.substituteStatus === 'Pending', 'substituteStatus is Pending');
      assert(
        getData().data?.leave?.substitute?._id?.toString() === staffD_CrossDept._id.toString(),
        'Selected substitute is Staff D'
      );
      staffCLeaveId = getData().data?.leave?._id;

      // Verify notification sent to substitute
      const subNotif = await Notification.findOne({
        user: staffD_CrossDept._id,
        title: 'Substitute Request Received',
      });
      assert(!!subNotif, 'Notification created for selected substitute');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: HOD approval and rejection restrictions while substitute is pending
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 3: HOD Restrictions While Substitute is Pending ---');

    // 3.1 HOD attempts to approve Staff C's leave -> Must be blocked
    {
      const { req, res, getStatus, getData } = mockReqRes(
        {},
        { id: staffCLeaveId },
        {},
        hod1
      );

      await approveLeave(req, res);
      assert(getStatus() === 400, 'HOD approve while substituteStatus is Pending returned HTTP 400');
      assert(
        getData().message.includes('substitute has not accepted'),
        `Error explains substitute has not accepted: "${getData().message}"`
      );
    }

    // 3.2 HOD attempts to reject Staff C's leave -> Must be blocked (per Requirement 6)
    {
      const { req, res, getStatus, getData } = mockReqRes(
        { remarks: 'Workload high' },
        { id: staffCLeaveId },
        {},
        hod1
      );

      await rejectLeave(req, res);
      assert(getStatus() === 400, 'HOD reject while substituteStatus is Pending returned HTTP 400');
      assert(
        getData().message.includes('substitute must accept'),
        `Error explains substitute must accept before HOD review: "${getData().message}"`
      );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 4: Substitute rejection & reselection workflow
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 4: Substitute Rejection & Reselection ---');

    // 4.1 Staff D checks substitute requests -> Finds Staff C's request
    {
      const { req, res, getStatus, getData } = mockReqRes(
        {},
        {},
        {},
        staffD_CrossDept
      );

      await getMySubstituteRequests(req, res);
      assert(getStatus() === 200, 'Staff D fetches substitute requests (HTTP 200)');
      assert(
        getData().data.requests.some((r) => r._id.toString() === staffCLeaveId.toString()),
        "Staff D sees Staff C's substitute request"
      );
    }

    // 4.2 Staff D declines the request
    {
      const { req, res, getStatus, getData } = mockReqRes(
        { action: 'reject', remarks: 'Busy with lab accreditation' },
        { id: staffCLeaveId },
        {},
        staffD_CrossDept
      );

      await respondToSubstituteRequest(req, res);
      assert(getStatus() === 200, 'Staff D declines request (HTTP 200)');
      assert(getData().data.leave.substituteStatus === 'Rejected', 'substituteStatus updated to Rejected');

      // Verify notification sent to Staff C
      const applicantNotif = await Notification.findOne({
        user: staffC._id,
        title: 'Substitute Request Declined',
      });
      assert(!!applicantNotif, 'Notification sent to applicant about substitute decline');
    }

    // 4.3 While Rejected, HOD still cannot approve
    {
      const { req, res, getStatus, getData } = mockReqRes(
        {},
        { id: staffCLeaveId },
        {},
        hod1
      );

      await approveLeave(req, res);
      assert(getStatus() === 400, 'HOD approve while substituteStatus is Rejected returned HTTP 400');
    }

    // 4.4 Staff C reassigns a new substitute (Staff E from Dept 2)
    {
      const { req, res, getStatus, getData } = mockReqRes(
        { substitute: staffE_CrossDept._id },
        { id: staffCLeaveId },
        {},
        staffC
      );

      await reassignSubstitute(req, res);
      assert(getStatus() === 200, 'Reassign substitute returned HTTP 200');
      assert(getData().data.leave.substituteStatus === 'Pending', 'substituteStatus reset to Pending');
      assert(
        getData().data.leave.substitute._id.toString() === staffE_CrossDept._id.toString(),
        'New substitute is Staff E'
      );

      // Verify notification sent to Staff E
      const newSubNotif = await Notification.findOne({
        user: staffE_CrossDept._id,
        title: 'Substitute Request Received',
      });
      assert(!!newSubNotif, 'Notification created for reassigned substitute (Staff E)');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 5: Substitute acceptance & subsequent HOD approval
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 5: Substitute Acceptance & HOD Approval ---');

    // 5.1 Staff E accepts the substitute request
    {
      const { req, res, getStatus, getData } = mockReqRes(
        { action: 'accept', remarks: 'Glad to help cover shift' },
        { id: staffCLeaveId },
        {},
        staffE_CrossDept
      );

      await respondToSubstituteRequest(req, res);
      assert(getStatus() === 200, 'Staff E accepts request (HTTP 200)');
      assert(getData().data.leave.substituteStatus === 'Accepted', 'substituteStatus is now Accepted');

      // Verify notification sent to applicant
      const acceptNotif = await Notification.findOne({
        user: staffC._id,
        title: 'Substitute Request Accepted',
      });
      assert(!!acceptNotif, 'Notification sent to applicant confirming substitute acceptance');
    }

    // 5.2 HOD can now successfully approve the leave!
    {
      const { req, res, getStatus, getData } = mockReqRes(
        { remarks: 'Approved with substitute coverage' },
        { id: staffCLeaveId },
        {},
        hod1
      );

      await approveLeave(req, res);
      assert(getStatus() === 200, 'HOD approves leave with accepted substitute (HTTP 200)');
      assert(getData().data.leave.status === 'Approved', 'Leave status is Approved');

      // Check attendance record created
      const attRecord = await Attendance.findOne({ user: staffC._id, date: testDate });
      assert(!!attRecord, 'Attendance record created for approved leave date');
      assert(attRecord.status === 'Leave', 'Attendance status is Leave (not Absent)');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 6: Attendance check-in integration
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 6: Approved Leave Attendance Check-in Integration ---');
    {
      const todayUTC = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), 0, 0, 0, 0));
      const todayLeave = await Leave.create({
        user: staffC._id,
        department: dept1._id,
        type: 'Casual Leave',
        fromDate: todayUTC,
        toDate: todayUTC,
        startTime: '08:00 AM',
        endTime: '05:00 PM',
        totalDays: 1,
        reason: 'Urgent family task with substitute',
        requiresSubstitute: true,
        substitute: staffE_CrossDept._id,
        substituteStatus: 'Accepted',
        status: 'Approved',
        approvedBy: hod1._id,
        approvedAt: new Date(),
      });

      // Verify checkIn controller blocks check-in when user is on approved leave
      const { req, res, getStatus, getData } = mockReqRes({}, {}, {}, staffC);

      await checkIn(req, res);
      assert(getStatus() === 400, 'Check-in blocked for staff member on approved leave (HTTP 400)');
      assert(
        getData().message === 'You are on approved leave today. Check-in is unavailable.',
        `Exact check-in blocked message received: "${getData().message}"`
      );

      // Verify getTodayAttendance reports canCheckIn: false, isOnApprovedLeave: true
      const todayQuery = mockReqRes({}, {}, {}, staffC);
      await getTodayAttendance(todayQuery.req, todayQuery.res);
      assert(todayQuery.getStatus() === 200, 'getTodayAttendance returned HTTP 200');
      assert(todayQuery.getData().data.canCheckIn === false, 'canCheckIn is false');
      assert(todayQuery.getData().data.isOnApprovedLeave === true, 'isOnApprovedLeave is true');
      assert(todayQuery.getData().data.status === 'Leave', 'Status is Leave');

      // Clean up today's leave
      await Leave.deleteOne({ _id: todayLeave._id });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 7: Multi-Day overlapping leave with partial limit violation
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- Scenario 7: Multi-Day Overlapping Leave Handling ---');
    {
      const midDate = new Date(`${multiMidStr}T00:00:00.000Z`);

      // Staff A and Staff B have approved leave ONLY on the middle day (2027-05-11)
      await Leave.create({
        user: staffA._id,
        department: dept1._id,
        type: 'Medical Leave',
        fromDate: midDate,
        toDate: midDate,
        totalDays: 1,
        reason: 'Staff A medical checkup',
        status: 'Approved',
        approvedBy: hod1._id,
        approvedAt: new Date(),
      });

      await Leave.create({
        user: staffB._id,
        department: dept1._id,
        type: 'Casual Leave',
        fromDate: midDate,
        toDate: midDate,
        totalDays: 1,
        reason: 'Staff B personal',
        status: 'Approved',
        approvedBy: hod1._id,
        approvedAt: new Date(),
      });

      // Staff C applies for 3 days (2027-05-10 to 2027-05-12)
      // Only 2027-05-11 has 2 approved leaves, but whole multi-day application requires substitute!
      const multiCheck = await checkDepartmentLeaveLimit(
        dept1._id,
        multiStartStr,
        multiEndStr,
        staffC._id
      );

      assert(multiCheck.requiresSubstitute === true, 'Multi-day leave spanning limit-exceeding date requires substitute');
      assert(multiCheck.datesExceedingLimit.length === 1, 'Exactly 1 date in the 3-day range exceeded limit');
      assert(multiCheck.datesExceedingLimit[0] === multiMidStr, `Exceeded date is ${multiMidStr}`);

      // Attempting to apply for multi-day without substitute must fail
      const applyMulti = mockReqRes(
        {
          type: 'Earned Leave',
          startDate: multiStartStr,
          endDate: multiEndStr,
          reason: 'Out of station trip',
        },
        {},
        {},
        staffC
      );

      await applyLeave(applyMulti.req, applyMulti.res);
      assert(applyMulti.getStatus() === 400, 'Multi-day apply without substitute rejected (HTTP 400)');
      assert(
        applyMulti.getData().message.includes(multiMidStr),
        `Error specifically identifies the affected date ${multiMidStr}`
      );
    }

    console.log('\n========================================================');
    console.log(`✅ ALL TESTS PASSED: ${passedTests} / ${totalTests} assertions`);
    console.log('========================================================\n');
  } finally {
    // Clean up all created test documents
    console.log('Cleaning up test documents...');
    await Leave.deleteMany({
      fromDate: { $in: [testDate, new Date(`${multiStartStr}T00:00:00.000Z`), new Date(`${multiMidStr}T00:00:00.000Z`)] },
    });
    await Attendance.deleteMany({
      date: { $in: [testDate, new Date(`${multiStartStr}T00:00:00.000Z`), new Date(`${multiMidStr}T00:00:00.000Z`), new Date(`${multiEndStr}T00:00:00.000Z`)] },
    });
    await Notification.deleteMany({
      title: { $in: ['Substitute Request Received', 'Substitute Request Accepted', 'Substitute Request Declined', 'Substitute Reassigned'] },
    });
    console.log('Cleanup complete.');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});
