/**
 * Seed Script — BIT Non-Teaching Staff Portal
 * Creates initial Admin, Departments, HOD, Staff users, Leave balances,
 * Sample Leave Applications, and Initial Attendance records.
 *
 * Run with: npm run seed
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User.model');
const Department = require('../models/Department.model');
const Attendance = require('../models/Attendance.model');
const Leave = require('../models/Leave.model');
const Shift = require('../models/Shift.model');
const Schedule = require('../models/Schedule.model');

const MONGODB_URI = process.env.MONGODB_URI;

const departments = [
  { name: 'Computer Science & Engineering', code: 'CSE' },
  { name: 'Electronics & Communication Engineering', code: 'ECE' },
  { name: 'Mechanical Engineering', code: 'ME' },
  { name: 'Civil Engineering', code: 'CE' },
  { name: 'Information Technology', code: 'IT' },
  { name: 'Administration', code: 'ADMIN' },
];

const normalizeDate = (d) => {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
};

const seed = async () => {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🗑️  Clearing existing seed data...');
    await User.deleteMany({});
    await Department.deleteMany({});
    await Attendance.deleteMany({});
    await Leave.deleteMany({});
    await Shift.deleteMany({});
    await Schedule.deleteMany({});

    // Drop legacy indexes
    try {
      await Attendance.collection.dropIndexes();
      await Attendance.syncIndexes();
      await Schedule.collection.dropIndexes();
      await Schedule.syncIndexes();
    } catch (e) {
      // Ignore if collections are new
    }

    // Create departments
    console.log('📁 Creating departments...');
    const createdDepts = await Department.insertMany(departments);
    const deptMap = {};
    createdDepts.forEach((d) => { deptMap[d.code] = d._id; });
    console.log(`   ✓ ${createdDepts.length} departments created`);

    const defaultBalances = {
      casualLeave: { total: 12, used: 2, reserved: 0 },
      medicalLeave: { total: 12, used: 1, reserved: 0 },
      earnedLeave: { total: 30, used: 3, reserved: 0 },
    };

    // Create Admin user
    console.log('👤 Creating Admin user...');
    const adminUser = await User.create({
      employeeId: 'BIT-ADM-001',
      staffId: 'BIT-ADM-001',
      name: 'System Administrator',
      email: 'admin@bitsathy.ac.in',
      password: 'Admin@123',
      role: 'Admin',
      department: deptMap['ADMIN'],
      designation: 'System Administrator',
      phone: '9876543210',
      basicSalary: 65000,
      joiningDate: new Date('2020-01-01'),
      leaveBalances: defaultBalances,
      isActive: true,
    });
    console.log(`   ✓ Admin: ${adminUser.employeeId} / Admin@123`);

    // Update Admin department HOD
    await Department.findByIdAndUpdate(deptMap['ADMIN'], { hod: adminUser._id });

    // Create HOD for CSE
    console.log('👤 Creating HOD user...');
    const hodUser = await User.create({
      employeeId: 'BIT-HOD-001',
      staffId: 'BIT-HOD-001',
      name: 'Dr. Arun Kumar',
      email: 'arun.kumar@bitsathy.ac.in',
      password: 'Hod@123',
      role: 'HOD',
      department: deptMap['CSE'],
      designation: 'Head of Department - CSE',
      phone: '9876543211',
      basicSalary: 75000,
      joiningDate: new Date('2015-06-01'),
      leaveBalances: defaultBalances,
      isActive: true,
    });
    console.log(`   ✓ HOD (CSE): ${hodUser.employeeId} / Hod@123`);

    // Update CSE dept HOD
    await Department.findByIdAndUpdate(deptMap['CSE'], { hod: hodUser._id });

    // Create HOD for ECE
    const hodEce = await User.create({
      employeeId: 'BIT-HOD-002',
      staffId: 'BIT-HOD-002',
      name: 'Dr. Priya Sharma',
      email: 'priya.sharma@bitsathy.ac.in',
      password: 'Hod@123',
      role: 'HOD',
      department: deptMap['ECE'],
      designation: 'Head of Department - ECE',
      phone: '9876543212',
      basicSalary: 72000,
      joiningDate: new Date('2017-07-01'),
      leaveBalances: defaultBalances,
      isActive: true,
    });
    await Department.findByIdAndUpdate(deptMap['ECE'], { hod: hodEce._id });
    console.log(`   ✓ HOD (ECE): ${hodEce.employeeId} / Hod@123`);

    // Create Staff users
    console.log('👤 Creating Staff users...');
    const staffData = [
      {
        employeeId: 'BIT-NTS-001',
        staffId: 'BIT-NTS-001',
        name: 'Rajesh Kumar',
        email: 'rajesh.kumar@bitsathy.ac.in',
        password: 'Staff@123',
        role: 'Staff',
        department: deptMap['CSE'],
        designation: 'Lab Technician',
        phone: '9876543213',
        basicSalary: 28000,
        joiningDate: new Date('2018-08-01'),
        leaveBalances: defaultBalances,
        isActive: true,
      },
      {
        employeeId: 'BIT-NTS-002',
        staffId: 'BIT-NTS-002',
        name: 'Meena Devi',
        email: 'meena.devi@bitsathy.ac.in',
        password: 'Staff@123',
        role: 'Staff',
        department: deptMap['CSE'],
        designation: 'Office Assistant',
        phone: '9876543214',
        basicSalary: 22000,
        joiningDate: new Date('2019-03-15'),
        leaveBalances: defaultBalances,
        isActive: true,
      },
      {
        employeeId: 'BIT-NTS-003',
        staffId: 'BIT-NTS-003',
        name: 'Suresh Babu',
        email: 'suresh.babu@bitsathy.ac.in',
        password: 'Staff@123',
        role: 'Staff',
        department: deptMap['ECE'],
        designation: 'Lab Assistant',
        phone: '9876543215',
        basicSalary: 24000,
        joiningDate: new Date('2020-06-01'),
        leaveBalances: defaultBalances,
        isActive: true,
      },
    ];

    const staffUsers = [];
    for (const s of staffData) {
      const created = await User.create(s);
      staffUsers.push(created);
      console.log(`   ✓ Staff: ${created.employeeId} / Staff@123`);
    }

    // Seed Attendance records for past 7 days
    console.log('📅 Creating initial attendance records...');
    const now = new Date();
    const attendanceRecords = [];

    for (const staff of staffUsers) {
      for (let i = 0; i < 7; i++) {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - i);
        const dayOfWeek = date.getUTCDay(); // 0 is Sunday

        let status = 'Present';
        let remarks = 'Regular attendance';

        if (dayOfWeek === 0) {
          status = 'Weekly Off';
          remarks = 'Sunday weekly off';
        } else if (i === 3 && staff.employeeId === 'BIT-NTS-001') {
          status = 'Leave';
          remarks = 'Approved Casual Leave';
        } else if (i === 5 && staff.employeeId === 'BIT-NTS-002') {
          status = 'Absent';
          remarks = 'Unexcused absence';
        }

        attendanceRecords.push({
          user: staff._id,
          date: normalizeDate(date),
          status,
          remarks,
          checkIn: status === 'Present' ? new Date(date.setUTCHours(9, 0, 0, 0)) : null,
          checkOut: status === 'Present' ? new Date(date.setUTCHours(17, 0, 0, 0)) : null,
        });
      }
    }

    await Attendance.insertMany(attendanceRecords);
    console.log(`   ✓ ${attendanceRecords.length} attendance records created`);

    // Seed Leave Applications
    console.log('📝 Creating sample leave applications...');
    const leaveTomorrow = new Date(now);
    leaveTomorrow.setUTCDate(leaveTomorrow.getUTCDate() + 1);

    const leaveNextDay = new Date(now);
    leaveNextDay.setUTCDate(leaveNextDay.getUTCDate() + 2);

    await Leave.create([
      {
        user: staffUsers[0]._id, // Rajesh Kumar (CSE)
        department: deptMap['CSE'],
        type: 'Casual Leave',
        fromDate: normalizeDate(leaveTomorrow),
        toDate: normalizeDate(leaveNextDay),
        startTime: '09:00 AM',
        endTime: '05:00 PM',
        totalDays: 2,
        reason: 'Family function in hometown',
        status: 'Pending',
      },
      {
        user: staffUsers[1]._id, // Meena Devi (CSE)
        department: deptMap['CSE'],
        type: 'Medical Leave',
        fromDate: normalizeDate(now),
        toDate: normalizeDate(now),
        startTime: '09:00 AM',
        endTime: '05:00 PM',
        totalDays: 1,
        reason: 'Doctor consultation appointment',
        status: 'Pending',
      },
      {
        user: staffUsers[2]._id, // Suresh Babu (ECE)
        department: deptMap['ECE'],
        type: 'Earned Leave',
        fromDate: normalizeDate(leaveTomorrow),
        toDate: normalizeDate(leaveTomorrow),
        startTime: '09:00 AM',
        endTime: '05:00 PM',
        totalDays: 1,
        reason: 'Personal work',
        status: 'Pending',
      },
    ]);
    console.log('   ✓ 3 sample leave applications created (Pending HOD approval)');

    // Seed Shifts
    console.log('⏰ Creating shifts...');
    const shiftsData = [
      {
        name: 'Morning Shift',
        startTime: '08:00',
        endTime: '16:00',
        workingHours: 8,
        department: null,
        description: 'Morning standard campus shift',
        isActive: true,
      },
      {
        name: 'General Shift',
        startTime: '09:00',
        endTime: '17:00',
        workingHours: 8,
        department: null,
        description: 'General administration and lab shift',
        isActive: true,
      },
      {
        name: 'Evening Shift',
        startTime: '14:00',
        endTime: '22:00',
        workingHours: 8,
        department: null,
        description: 'Evening lab and campus maintenance shift',
        isActive: true,
      },
      {
        name: 'Night Shift',
        startTime: '22:00',
        endTime: '06:00',
        workingHours: 8,
        department: null,
        description: 'Night security and equipment surveillance shift',
        isActive: true,
      },
      {
        name: 'CSE Lab Shift',
        startTime: '08:30',
        endTime: '16:30',
        workingHours: 8,
        department: deptMap['CSE'],
        description: 'Departmental lab maintenance and setup',
        isActive: true,
      },
    ];

    const createdShifts = await Shift.insertMany(shiftsData);
    console.log(`   ✓ ${createdShifts.length} shifts created`);

    const morningShift = createdShifts.find((s) => s.name === 'Morning Shift');
    const generalShift = createdShifts.find((s) => s.name === 'General Shift');
    const eveningShift = createdShifts.find((s) => s.name === 'Evening Shift');

    // Seed Schedules
    console.log('📅 Creating sample shift schedules...');
    const today = normalizeDate(now);
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 2);

    const schedulesData = [
      // Rajesh Kumar (CSE)
      {
        staff: staffUsers[0]._id,
        department: deptMap['CSE'],
        shift: generalShift._id,
        date: yesterday,
        startTime: generalShift.startTime,
        endTime: generalShift.endTime,
        status: 'Completed',
        remarks: 'Completed regular shift',
      },
      {
        staff: staffUsers[0]._id,
        department: deptMap['CSE'],
        shift: generalShift._id,
        date: today,
        startTime: generalShift.startTime,
        endTime: generalShift.endTime,
        status: 'Scheduled',
        remarks: 'Main lab duty',
      },
      {
        staff: staffUsers[0]._id,
        department: deptMap['CSE'],
        shift: morningShift._id,
        date: tomorrow,
        startTime: morningShift.startTime,
        endTime: morningShift.endTime,
        status: 'Scheduled',
        remarks: 'Morning server check',
      },
      // Meena Devi (CSE)
      {
        staff: staffUsers[1]._id,
        department: deptMap['CSE'],
        shift: morningShift._id,
        date: today,
        startTime: morningShift.startTime,
        endTime: morningShift.endTime,
        status: 'Scheduled',
        remarks: 'Department office duty',
      },
      {
        staff: staffUsers[1]._id,
        department: deptMap['CSE'],
        shift: eveningShift._id,
        date: tomorrow,
        startTime: eveningShift.startTime,
        endTime: eveningShift.endTime,
        status: 'Scheduled',
        remarks: 'Evening record update',
      },
      // Suresh Babu (ECE)
      {
        staff: staffUsers[2]._id,
        department: deptMap['ECE'],
        shift: generalShift._id,
        date: today,
        startTime: generalShift.startTime,
        endTime: generalShift.endTime,
        status: 'Scheduled',
        remarks: 'ECE hardware lab',
      },
      {
        staff: staffUsers[2]._id,
        department: deptMap['ECE'],
        shift: generalShift._id,
        date: tomorrow,
        startTime: generalShift.startTime,
        endTime: generalShift.endTime,
        status: 'Scheduled',
        remarks: 'ECE lab assistance',
      },
    ];

    await Schedule.insertMany(schedulesData);
    console.log(`   ✓ ${schedulesData.length} shift schedules created`);

    console.log('');
    console.log('════════════════════════════════════════════');
    console.log('✅ Seed completed successfully with Day 4 data!');
    console.log('');
    console.log('Login Credentials:');
    console.log('  Admin  : BIT-ADM-001 / Admin@123');
    console.log('  HOD    : BIT-HOD-001 / Hod@123 (CSE)');
    console.log('  Staff  : BIT-NTS-001 / Staff@123 (Rajesh Kumar)');
    console.log('════════════════════════════════════════════');
    console.log('');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seed();
