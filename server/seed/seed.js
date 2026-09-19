/**
 * Seed Script — BIT Non-Teaching Staff Portal
 * Creates initial Admin, Departments, HOD, and Staff users
 *
 * Run with: npm run seed
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User.model');
const Department = require('../models/Department.model');

const MONGODB_URI = process.env.MONGODB_URI;

const departments = [
  { name: 'Computer Science & Engineering', code: 'CSE' },
  { name: 'Electronics & Communication Engineering', code: 'ECE' },
  { name: 'Mechanical Engineering', code: 'ME' },
  { name: 'Civil Engineering', code: 'CE' },
  { name: 'Information Technology', code: 'IT' },
  { name: 'Administration', code: 'ADMIN' },
];

const hashPassword = async (plain) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plain, salt);
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

    // Create departments
    console.log('📁 Creating departments...');
    const createdDepts = await Department.insertMany(departments);
    const deptMap = {};
    createdDepts.forEach((d) => { deptMap[d.code] = d._id; });
    console.log(`   ✓ ${createdDepts.length} departments created`);

    // Create Admin user
    console.log('👤 Creating Admin user...');
    const adminUser = await User.create({
      employeeId: 'BIT-ADM-001',
      name: 'System Administrator',
      email: 'admin@bitsathy.ac.in',
      password: 'Admin@123',
      role: 'Admin',
      department: deptMap['ADMIN'],
      designation: 'System Administrator',
      phone: '9876543210',
      joiningDate: new Date('2020-01-01'),
    });
    console.log(`   ✓ Admin: ${adminUser.employeeId} / Admin@123`);

    // Update Admin department HOD
    await Department.findByIdAndUpdate(deptMap['ADMIN'], { hod: adminUser._id });

    // Create HOD for CSE
    console.log('👤 Creating HOD user...');
    const hodUser = await User.create({
      employeeId: 'BIT-HOD-001',
      name: 'Dr. Arun Kumar',
      email: 'arun.kumar@bitsathy.ac.in',
      password: 'Hod@123',
      role: 'HOD',
      department: deptMap['CSE'],
      designation: 'Head of Department - CSE',
      phone: '9876543211',
      joiningDate: new Date('2015-06-01'),
    });
    console.log(`   ✓ HOD (CSE): ${hodUser.employeeId} / Hod@123`);

    // Update CSE dept HOD
    await Department.findByIdAndUpdate(deptMap['CSE'], { hod: hodUser._id });

    // Create HOD for ECE
    const hodEce = await User.create({
      employeeId: 'BIT-HOD-002',
      name: 'Dr. Priya Sharma',
      email: 'priya.sharma@bitsathy.ac.in',
      password: 'Hod@123',
      role: 'HOD',
      department: deptMap['ECE'],
      designation: 'Head of Department - ECE',
      phone: '9876543212',
      joiningDate: new Date('2017-07-01'),
    });
    await Department.findByIdAndUpdate(deptMap['ECE'], { hod: hodEce._id });
    console.log(`   ✓ HOD (ECE): ${hodEce.employeeId} / Hod@123`);

    // Create Staff users
    console.log('👤 Creating Staff users...');
    const staffUsers = [
      {
        employeeId: 'BIT-NTS-001',
        name: 'Rajesh Kumar',
        email: 'rajesh.kumar@bitsathy.ac.in',
        password: 'Staff@123',
        role: 'Staff',
        department: deptMap['CSE'],
        designation: 'Lab Technician',
        phone: '9876543213',
        joiningDate: new Date('2018-08-01'),
      },
      {
        employeeId: 'BIT-NTS-002',
        name: 'Meena Devi',
        email: 'meena.devi@bitsathy.ac.in',
        password: 'Staff@123',
        role: 'Staff',
        department: deptMap['CSE'],
        designation: 'Office Assistant',
        phone: '9876543214',
        joiningDate: new Date('2019-03-15'),
      },
      {
        employeeId: 'BIT-NTS-003',
        name: 'Suresh Babu',
        email: 'suresh.babu@bitsathy.ac.in',
        password: 'Staff@123',
        role: 'Staff',
        department: deptMap['ECE'],
        designation: 'Lab Assistant',
        phone: '9876543215',
        joiningDate: new Date('2020-06-01'),
      },
    ];

    for (const staff of staffUsers) {
      const created = await User.create(staff);
      console.log(`   ✓ Staff: ${created.employeeId} / Staff@123`);
    }

    console.log('');
    console.log('════════════════════════════════════════════');
    console.log('✅ Seed completed successfully!');
    console.log('');
    console.log('Login Credentials:');
    console.log('  Admin  : BIT-ADM-001 / Admin@123');
    console.log('  HOD    : BIT-HOD-001 / Hod@123');
    console.log('  Staff  : BIT-NTS-001 / Staff@123');
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
