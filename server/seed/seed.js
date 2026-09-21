/**
 * Seed Script — BIT Non-Teaching Staff Portal (Day 7)
 * Creates: 1 Admin, 5 HODs, 5 Departments, 50 Non-Teaching Staff (10 per dept)
 * Also creates 5 standard shifts.
 *
 * Run with: npm run seed
 * WARNING: This will wipe all existing users, departments, attendance, leaves, shifts, schedules.
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User       = require('../models/User.model');
const Department = require('../models/Department.model');
const Attendance = require('../models/Attendance.model');
const Leave      = require('../models/Leave.model');
const Shift      = require('../models/Shift.model');
const Schedule   = require('../models/Schedule.model');
const Payroll    = require('../models/Payroll.model');
const Notification = require('../models/Notification.model');

const MONGODB_URI = process.env.MONGODB_URI;

// ── Departments ─────────────────────────────────────────────────────────────
const DEPARTMENTS = [
  { name: 'Computer Science & Engineering', code: 'CSE' },
  { name: 'Electronics & Communication Engineering', code: 'ECE' },
  { name: 'Mechanical Engineering', code: 'ME' },
  { name: 'Civil Engineering', code: 'CE' },
  { name: 'Information Technology', code: 'IT' },
];

// ── HODs (one per department) ────────────────────────────────────────────────
const HOD_DATA = [
  {
    employeeId: 'BIT-HOD-001', name: 'Dr. Arun Kumar',
    email: 'arun.kumar@bitsathy.ac.in', dept: 'CSE',
    designation: 'Head of Department - CSE', phone: '9876543201',
    basicSalary: 78000, joiningDate: new Date('2014-07-01'),
  },
  {
    employeeId: 'BIT-HOD-002', name: 'Dr. Priya Sharma',
    email: 'priya.sharma@bitsathy.ac.in', dept: 'ECE',
    designation: 'Head of Department - ECE', phone: '9876543202',
    basicSalary: 75000, joiningDate: new Date('2015-06-01'),
  },
  {
    employeeId: 'BIT-HOD-003', name: 'Dr. Suresh Nair',
    email: 'suresh.nair@bitsathy.ac.in', dept: 'ME',
    designation: 'Head of Department - ME', phone: '9876543203',
    basicSalary: 76000, joiningDate: new Date('2013-08-01'),
  },
  {
    employeeId: 'BIT-HOD-004', name: 'Dr. Kavitha Reddy',
    email: 'kavitha.reddy@bitsathy.ac.in', dept: 'CE',
    designation: 'Head of Department - CE', phone: '9876543204',
    basicSalary: 74000, joiningDate: new Date('2016-05-01'),
  },
  {
    employeeId: 'BIT-HOD-005', name: 'Dr. Ramesh Babu',
    email: 'ramesh.babu@bitsathy.ac.in', dept: 'IT',
    designation: 'Head of Department - IT', phone: '9876543205',
    basicSalary: 77000, joiningDate: new Date('2012-09-01'),
  },
];

// ── Non-Teaching Staff (10 per department) ───────────────────────────────────
const STAFF_BY_DEPT = {
  CSE: [
    { name: 'Rajesh Kumar',       designation: 'Lab Technician',          basicSalary: 28000, phone: '9800000001' },
    { name: 'Meena Devi',         designation: 'Office Assistant',         basicSalary: 22000, phone: '9800000002' },
    { name: 'Anand Krishnan',     designation: 'System Administrator',     basicSalary: 32000, phone: '9800000003' },
    { name: 'Saranya Rajan',      designation: 'Lab Assistant',            basicSalary: 24000, phone: '9800000004' },
    { name: 'Vijay Mohan',        designation: 'Network Technician',       basicSalary: 30000, phone: '9800000005' },
    { name: 'Lakshmi Priya',      designation: 'Data Entry Operator',      basicSalary: 20000, phone: '9800000006' },
    { name: 'Dinesh Raj',         designation: 'Hardware Technician',      basicSalary: 27000, phone: '9800000007' },
    { name: 'Pooja Venkatesh',    designation: 'Administrative Clerk',     basicSalary: 21000, phone: '9800000008' },
    { name: 'Karthik Selvan',     designation: 'IT Support Technician',    basicSalary: 29000, phone: '9800000009' },
    { name: 'Radha Krishnamurthy',designation: 'Library Assistant',        basicSalary: 23000, phone: '9800000010' },
  ],
  ECE: [
    { name: 'Suresh Babu',        designation: 'Lab Assistant',            basicSalary: 24000, phone: '9800000011' },
    { name: 'Nithya Chandran',    designation: 'Electronics Technician',   basicSalary: 26000, phone: '9800000012' },
    { name: 'Manoj Kumar',        designation: 'Lab Technician',           basicSalary: 28000, phone: '9800000013' },
    { name: 'Anusha Ravi',        designation: 'Office Assistant',         basicSalary: 22000, phone: '9800000014' },
    { name: 'Balaji Sundaram',    designation: 'Technical Assistant',      basicSalary: 25000, phone: '9800000015' },
    { name: 'Chitra Natarajan',   designation: 'Administrative Clerk',     basicSalary: 21000, phone: '9800000016' },
    { name: 'Prakash Murugan',    designation: 'Instrument Technician',    basicSalary: 27000, phone: '9800000017' },
    { name: 'Deepa Srinivasan',   designation: 'Data Entry Operator',      basicSalary: 20000, phone: '9800000018' },
    { name: 'Ganesh Raman',       designation: 'Workshop Technician',      basicSalary: 26000, phone: '9800000019' },
    { name: 'Hema Malini',        designation: 'Office Supervisor',        basicSalary: 23000, phone: '9800000020' },
  ],
  ME: [
    { name: 'Arjun Pillai',       designation: 'Workshop Supervisor',      basicSalary: 35000, phone: '9800000021' },
    { name: 'Bhavani Shankar',    designation: 'Lab Technician',           basicSalary: 28000, phone: '9800000022' },
    { name: 'Chandrasekhar V',    designation: 'Lathe Operator',           basicSalary: 26000, phone: '9800000023' },
    { name: 'Devika Nair',        designation: 'Office Assistant',         basicSalary: 22000, phone: '9800000024' },
    { name: 'Ezhilan Muthusamy',  designation: 'Welding Technician',       basicSalary: 27000, phone: '9800000025' },
    { name: 'Fathima Begum',      designation: 'Administrative Clerk',     basicSalary: 21000, phone: '9800000026' },
    { name: 'Govindan Pillai',    designation: 'Maintenance Technician',   basicSalary: 29000, phone: '9800000027' },
    { name: 'Haripriya Menon',    designation: 'Data Entry Operator',      basicSalary: 20000, phone: '9800000028' },
    { name: 'Ismail Khan',        designation: 'Fitting Technician',       basicSalary: 25000, phone: '9800000029' },
    { name: 'Janani Sundaresan',  designation: 'Office Supervisor',        basicSalary: 23000, phone: '9800000030' },
  ],
  CE: [
    { name: 'Karthikeyan Raja',   designation: 'Survey Assistant',         basicSalary: 24000, phone: '9800000031' },
    { name: 'Lalitha Devi',       designation: 'Office Assistant',         basicSalary: 22000, phone: '9800000032' },
    { name: 'Muruganantham P',    designation: 'Lab Technician',           basicSalary: 28000, phone: '9800000033' },
    { name: 'Nirmala Rani',       designation: 'Administrative Clerk',     basicSalary: 21000, phone: '9800000034' },
    { name: 'Ojas Verma',         designation: 'Civil Survey Technician',  basicSalary: 26000, phone: '9800000035' },
    { name: 'Padmavathi T',       designation: 'Drafting Technician',      basicSalary: 25000, phone: '9800000036' },
    { name: 'Qureshi Mohammed',   designation: 'Material Testing Tech',    basicSalary: 27000, phone: '9800000037' },
    { name: 'Renuka Devi',        designation: 'Data Entry Operator',      basicSalary: 20000, phone: '9800000038' },
    { name: 'Selvam Arumugam',    designation: 'Workshop Assistant',       basicSalary: 23000, phone: '9800000039' },
    { name: 'Thenmozhi Rajan',    designation: 'Office Supervisor',        basicSalary: 24000, phone: '9800000040' },
  ],
  IT: [
    { name: 'Uma Shankar',        designation: 'System Administrator',     basicSalary: 32000, phone: '9800000041' },
    { name: 'Vasantha Kumar',     designation: 'Network Technician',       basicSalary: 30000, phone: '9800000042' },
    { name: 'Wafaa Hussain',      designation: 'Lab Technician',           basicSalary: 28000, phone: '9800000043' },
    { name: 'Xavier Raj',         designation: 'IT Support Technician',    basicSalary: 29000, phone: '9800000044' },
    { name: 'Yamuna Devi',        designation: 'Office Assistant',         basicSalary: 22000, phone: '9800000045' },
    { name: 'Zarina Begum',       designation: 'Administrative Clerk',     basicSalary: 21000, phone: '9800000046' },
    { name: 'Ashok Pandiyan',     designation: 'Database Administrator',   basicSalary: 35000, phone: '9800000047' },
    { name: 'Bharathi Dasan',     designation: 'Web Server Technician',    basicSalary: 27000, phone: '9800000048' },
    { name: 'Chitradevi Ramesh',  designation: 'Data Entry Operator',      basicSalary: 20000, phone: '9800000049' },
    { name: 'Durai Murugan',      designation: 'Hardware Technician',      basicSalary: 26000, phone: '9800000050' },
  ],
};

const DEFAULT_BALANCES = {
  casualLeave:  { total: 12, used: 0, reserved: 0 },
  medicalLeave: { total: 12, used: 0, reserved: 0 },
  earnedLeave:  { total: 30, used: 0, reserved: 0 },
};

const toEmail = (name, dept) => {
  const clean = name.toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.');
  return `${clean}.${dept.toLowerCase()}@bitsathy.ac.in`;
};

const seed = async () => {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // ── Clear existing data ────────────────────────────────────────────────
    console.log('\n🗑️  Clearing existing data...');
    await Promise.all([
      User.deleteMany({}),
      Department.deleteMany({}),
      Attendance.deleteMany({}),
      Leave.deleteMany({}),
      Shift.deleteMany({}),
      Schedule.deleteMany({}),
      Payroll.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    // Re-sync indexes to avoid stale unique constraints
    try {
      await Attendance.syncIndexes();
      await Schedule.syncIndexes();
      await User.syncIndexes();
    } catch (e) { /* ignore */ }
    console.log('   ✓ All collections cleared');

    // ── Create Departments ─────────────────────────────────────────────────
    console.log('\n📁 Creating 5 departments...');
    const createdDepts = await Department.insertMany(DEPARTMENTS);
    const deptMap = {}; // code → ObjectId
    createdDepts.forEach((d) => { deptMap[d.code] = d._id; });
    console.log(`   ✓ ${createdDepts.length} departments created`);

    // ── Create Admin ───────────────────────────────────────────────────────
    console.log('\n👤 Creating Admin...');
    const adminUser = await User.create({
      employeeId:   'BIT-ADM-001',
      staffId:      'BIT-ADM-001',
      name:         'System Administrator',
      email:        'admin@bitsathy.ac.in',
      password:     'Admin@123',
      role:         'Admin',
      department:   null,
      designation:  'System Administrator',
      phone:        '9876543200',
      basicSalary:  0, // Admin salary not applicable for payroll
      joiningDate:  new Date('2020-01-01'),
      leaveBalances: DEFAULT_BALANCES,
      isActive:     true,
    });
    console.log(`   ✓ Admin: ${adminUser.employeeId} / Admin@123`);

    // ── Create HODs ────────────────────────────────────────────────────────
    console.log('\n👥 Creating 5 HODs...');
    const hodUsers = [];
    for (const hod of HOD_DATA) {
      const created = await User.create({
        employeeId:   hod.employeeId,
        staffId:      hod.employeeId,
        name:         hod.name,
        email:        hod.email,
        password:     'Hod@123',
        role:         'HOD',
        department:   deptMap[hod.dept],
        designation:  hod.designation,
        phone:        hod.phone,
        basicSalary:  hod.basicSalary,
        joiningDate:  hod.joiningDate,
        leaveBalances: DEFAULT_BALANCES,
        isActive:     true,
      });
      await Department.findByIdAndUpdate(deptMap[hod.dept], { hod: created._id });
      hodUsers.push(created);
      console.log(`   ✓ HOD (${hod.dept}): ${created.employeeId} / Hod@123`);
    }

    // ── Create Staff ───────────────────────────────────────────────────────
    console.log('\n👥 Creating 50 Non-Teaching Staff (10 per dept)...');
    const allStaff = [];
    let staffCounter = 1;

    for (const deptCode of Object.keys(STAFF_BY_DEPT)) {
      const deptStaffList = STAFF_BY_DEPT[deptCode];
      for (const s of deptStaffList) {
        const empId = `BIT-NTS-${String(staffCounter).padStart(3, '0')}`;
        const email = toEmail(s.name, deptCode);
        const created = await User.create({
          employeeId:   empId,
          staffId:      empId,
          name:         s.name,
          email,
          password:     'Staff@123',
          role:         'Staff',
          department:   deptMap[deptCode],
          designation:  s.designation,
          phone:        s.phone,
          basicSalary:  Math.min(s.basicSalary, 40000), // Enforce ₹40,000 cap
          joiningDate:  new Date(`202${Math.floor(Math.random() * 4)}-0${Math.floor(Math.random() * 9) + 1}-01`),
          leaveBalances: DEFAULT_BALANCES,
          isActive:     true,
        });
        allStaff.push({ user: created, dept: deptCode });
        staffCounter++;
      }
      console.log(`   ✓ ${deptStaffList.length} staff created for ${deptCode}`);
    }

    // ── Create Shifts ──────────────────────────────────────────────────────
    console.log('\n⏰ Creating shifts...');
    const shiftsData = [
      { name: 'General Shift',  startTime: '09:00', endTime: '17:00', workingHours: 8, description: 'Standard working hours', isActive: true },
      { name: 'Morning Shift',  startTime: '08:00', endTime: '16:00', workingHours: 8, description: 'Early morning shift',    isActive: true },
      { name: 'Evening Shift',  startTime: '14:00', endTime: '22:00', workingHours: 8, description: 'Evening shift',          isActive: true },
      { name: 'Night Shift',    startTime: '22:00', endTime: '06:00', workingHours: 8, description: 'Night security shift',   isActive: true },
      { name: 'Half Day Shift', startTime: '09:00', endTime: '13:00', workingHours: 4, description: 'Half-day shift',         isActive: true },
    ];
    const createdShifts = await Shift.insertMany(shiftsData);
    console.log(`   ✓ ${createdShifts.length} shifts created`);

    // ── Summary ────────────────────────────────────────────────────────────
    console.log('\n════════════════════════════════════════════════════════');
    console.log('✅  Seed completed successfully!');
    console.log('');
    console.log('📊  Summary:');
    console.log(`   Departments  : ${createdDepts.length}`);
    console.log(`   Admin        : 1`);
    console.log(`   HODs         : ${hodUsers.length}`);
    console.log(`   Staff        : ${allStaff.length}`);
    console.log(`   Shifts       : ${createdShifts.length}`);
    console.log('');
    console.log('🔑  Login Credentials:');
    console.log('   Admin  : BIT-ADM-001        / Admin@123');
    console.log('   HOD    : BIT-HOD-001 (CSE)  / Hod@123');
    console.log('   HOD    : BIT-HOD-002 (ECE)  / Hod@123');
    console.log('   HOD    : BIT-HOD-003 (ME)   / Hod@123');
    console.log('   HOD    : BIT-HOD-004 (CE)   / Hod@123');
    console.log('   HOD    : BIT-HOD-005 (IT)   / Hod@123');
    console.log('   Staff  : BIT-NTS-001 to BIT-NTS-050 / Staff@123');
    console.log('════════════════════════════════════════════════════════');
    console.log('');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seed failed:', error.message);
    if (error.stack) console.error(error.stack);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seed();
