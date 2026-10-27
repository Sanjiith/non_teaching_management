/**
 * reset_leave_data.js
 *
 * Dedicated script to reset all leave-related data in the database to zero:
 * 1. Clears all leave applications (Leave collection).
 * 2. Clears attendance records directly linked to approved leaves (Attendance collection: status 'Leave' / 'On-Leave').
 * 3. Resets leave balances for all users (User collection: used=0, reserved=0, balance=total).
 * 4. Resets leave days in Payroll (if any).
 * 5. Clears leave-related notifications.
 * 6. Preserves staff accounts, Admin/HOD accounts, departments, shift schedules, salary details, and non-leave attendance.
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const User = require('../models/User.model');
const Department = require('../models/Department.model');
const Leave = require('../models/Leave.model');
const Attendance = require('../models/Attendance.model');
const Payroll = require('../models/Payroll.model');
const Notification = require('../models/Notification.model');

const MONGODB_URI = process.env.MONGODB_URI;

const resetLeaveData = async () => {
  console.log('========================================================================');
  console.log('RESETTING ALL LEAVE-RELATED DATA TO ZERO');
  console.log('========================================================================');

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB database.');

  try {
    // 1. Clear Leave Applications
    const deletedLeaves = await Leave.deleteMany({});
    console.log(`✓ Cleared Leave applications: ${deletedLeaves.deletedCount} documents deleted`);

    // 2. Clear Leave Attendance records
    const deletedLeaveAtt = await Attendance.deleteMany({
      status: { $in: ['Leave', 'On-Leave'] },
    });
    console.log(`✓ Cleared Leave Attendance records: ${deletedLeaveAtt.deletedCount} documents deleted`);

    // 3. Reset User Leave Balances
    const userUpdateResult = await User.updateMany(
      {},
      {
        $set: {
          'leaveBalances.casualLeave.total': 12,
          'leaveBalances.casualLeave.used': 0,
          'leaveBalances.casualLeave.reserved': 0,
          'leaveBalances.casualLeave.balance': 12,
          'leaveBalances.medicalLeave.total': 12,
          'leaveBalances.medicalLeave.used': 0,
          'leaveBalances.medicalLeave.reserved': 0,
          'leaveBalances.medicalLeave.balance': 12,
          'leaveBalances.earnedLeave.total': 12,
          'leaveBalances.earnedLeave.used': 0,
          'leaveBalances.earnedLeave.reserved': 0,
          'leaveBalances.earnedLeave.balance': 12,
        },
      }
    );
    console.log(`✓ Reset User leave balances: ${userUpdateResult.modifiedCount} staff/user records updated`);

    // 4. Reset Payroll Leave counts (if any)
    const payrollUpdateResult = await Payroll.updateMany(
      { $or: [{ leaveDays: { $gt: 0 } }, { excessLeaveDays: { $gt: 0 } }] },
      { $set: { leaveDays: 0, excessLeaveDays: 0 } }
    );
    console.log(`✓ Reset Payroll leave days: ${payrollUpdateResult.modifiedCount} payroll records updated`);

    // 5. Clear Leave/Substitute Notifications
    const deletedNotifications = await Notification.deleteMany({
      $or: [
        { type: { $in: ['leave', 'substitute', 'substitute_request'] } },
        { title: { $regex: /leave|substitute/i } },
      ],
    });
    console.log(`✓ Cleared Leave notifications: ${deletedNotifications.deletedCount} documents deleted`);

    // 6. Verify Preservation of Unrelated Records
    const totalUsers = await User.countDocuments();
    const totalDepts = await Department.countDocuments();
    const preservedAttendance = await Attendance.countDocuments();
    const totalPayrolls = await Payroll.countDocuments();

    console.log('\n--- VERIFICATION OF PRESERVED DATA ---');
    console.log(`  Staff & Admin Accounts preserved : ${totalUsers}`);
    console.log(`  Departments preserved            : ${totalDepts}`);
    console.log(`  Attendance records preserved     : ${preservedAttendance}`);
    console.log(`  Payroll history records preserved: ${totalPayrolls}`);

    console.log('\n✓ Leave data reset complete.');
  } catch (err) {
    console.error('Error during leave data reset:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
};

resetLeaveData();
