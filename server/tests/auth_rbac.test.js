/**
 * Day 2 Test Suite — Authentication and Role-Based Access Control (RBAC)
 * Verifies all Day 2 requirements against the running backend server.
 */

require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User.model');
const Department = require('../models/Department.model');

const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

let server;
let adminToken, hodCseToken, hodEceToken, staff1Token, staff2Token;
let cseDept, eceDept;
let adminUser, hodCseUser, hodEceUser, staff1User, staff2User, staff3User;

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
  console.log('🔄 Connecting to MongoDB and starting test server...');
  await mongoose.connect(process.env.MONGODB_URI);

  // Fetch reference data from database
  cseDept = await Department.findOne({ code: 'CSE' });
  eceDept = await Department.findOne({ code: 'ECE' });

  adminUser = await User.findOne({ employeeId: 'BIT-ADM-001' });
  hodCseUser = await User.findOne({ employeeId: 'BIT-HOD-001' });
  hodEceUser = await User.findOne({ employeeId: 'BIT-HOD-002' });
  staff1User = await User.findOne({ employeeId: 'BIT-NTS-001' });
  staff2User = await User.findOne({ employeeId: 'BIT-NTS-002' });
  staff3User = await User.findOne({ employeeId: 'BIT-NTS-003' });

  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`🚀 Test server listening on port ${TEST_PORT}\n`);
      resolve();
    });
  });
};

const teardown = async () => {
  console.log('\n🧹 Cleaning up test server and DB connection...');
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();

  console.log('\n=============================================');
  console.log(`Test Results: ${passedTests} passed, ${failedTests} failed`);
  console.log('=============================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
};

const runTests = async () => {
  try {
    await setup();

    console.log('─── TEST GROUP 1: Authentication & Login ───────────────────');

    // 1. Admin Login
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'BIT-ADM-001', password: 'Admin@123' }),
    });
    const adminLoginData = await adminLoginRes.json();
    adminToken = adminLoginData.data?.token;
    assert(
      adminLoginRes.status === 200 && !!adminToken && adminLoginData.data?.user?.role === 'Admin',
      'Admin login succeeds and returns JWT token'
    );

    // 2. HOD Login
    const hodLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'BIT-HOD-001', password: 'Hod@123' }),
    });
    const hodLoginData = await hodLoginRes.json();
    hodCseToken = hodLoginData.data?.token;
    assert(
      hodLoginRes.status === 200 && !!hodCseToken && hodLoginData.data?.user?.role === 'HOD',
      'HOD login succeeds and returns JWT token'
    );

    // ECE HOD Login
    const hodEceLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'BIT-HOD-002', password: 'Hod@123' }),
    });
    const hodEceLoginData = await hodEceLoginRes.json();
    hodEceToken = hodEceLoginData.data?.token;

    // 3. Staff Login
    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'BIT-NTS-001', password: 'Staff@123' }),
    });
    const staffLoginData = await staffLoginRes.json();
    staff1Token = staffLoginData.data?.token;
    assert(
      staffLoginRes.status === 200 && !!staff1Token && staffLoginData.data?.user?.role === 'Staff',
      'Staff login succeeds and returns JWT token'
    );

    // Staff 2 Login
    const staff2LoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'BIT-NTS-002', password: 'Staff@123' }),
    });
    const staff2LoginData = await staff2LoginRes.json();
    staff2Token = staff2LoginData.data?.token;

    // 4. Invalid Credentials (wrong password)
    const badPwRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'BIT-ADM-001', password: 'WrongPassword' }),
    });
    assert(badPwRes.status === 401, 'Invalid password rejected with 401');

    // 5. Invalid Credentials (non-existent user)
    const badUserRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: 'BIT-FAKE-999', password: 'Password@123' }),
    });
    assert(badUserRes.status === 401, 'Non-existent employeeId rejected with 401');

    console.log('\n─── TEST GROUP 2: Protected Routes & Session Verification ──');

    // 6. Protected Route without token
    const noTokenRes = await fetch(`${BASE_URL}/auth/me`);
    assert(noTokenRes.status === 401, 'Protected route without token rejected with 401');

    // 7. Protected Route with invalid token
    const badTokenRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: 'Bearer fake_invalid_token_12345' },
    });
    assert(badTokenRes.status === 401, 'Protected route with invalid token rejected with 401');

    // 8. Session Verification (Current User)
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    const meData = await meRes.json();
    assert(
      meRes.status === 200 && meData.data?.user?.employeeId === 'BIT-NTS-001',
      'Current-user /auth/me returns authenticated user profile'
    );

    console.log('\n─── TEST GROUP 3: Role-Based Authorization ─────────────────');

    // 9. Staff attempting unauthorized role action (User creation requires Admin)
    const staffCreateUserRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({
        employeeId: 'BIT-TEST-001',
        name: 'Hacker User',
        email: 'hacker@test.com',
        password: 'Password@123',
      }),
    });
    assert(
      staffCreateUserRes.status === 403,
      'Staff cannot create user (rejected with 403 Forbidden)'
    );

    // 10. Staff attempting to view all users
    const staffListUsersRes = await fetch(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    assert(
      staffListUsersRes.status === 403,
      'Staff cannot list users directory (rejected with 403 Forbidden)'
    );

    // 11. Staff attempting to create department
    const staffCreateDeptRes = await fetch(`${BASE_URL}/departments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ name: 'Illegal Dept', code: 'ILL' }),
    });
    assert(
      staffCreateDeptRes.status === 403,
      'Staff cannot create department (rejected with 403 Forbidden)'
    );

    console.log('\n─── TEST GROUP 4: Department Isolation (HOD Restrictions) ──');

    // 12. HOD cannot access another department's info
    const hodAccessOtherDeptRes = await fetch(`${BASE_URL}/departments/${eceDept._id}`, {
      headers: { Authorization: `Bearer ${hodCseToken}` },
    });
    assert(
      hodAccessOtherDeptRes.status === 403,
      'HOD (CSE) cannot access ECE department details (rejected with 403 Forbidden)'
    );

    // 13. HOD can access their own department
    const hodAccessOwnDeptRes = await fetch(`${BASE_URL}/departments/${cseDept._id}`, {
      headers: { Authorization: `Bearer ${hodCseToken}` },
    });
    assert(
      hodAccessOwnDeptRes.status === 200,
      'HOD (CSE) can access CSE department details (200 OK)'
    );

    // 14. HOD cannot access users in another department
    const hodAccessOtherDeptUserRes = await fetch(`${BASE_URL}/users/${staff3User._id}`, {
      headers: { Authorization: `Bearer ${hodCseToken}` },
    });
    assert(
      hodAccessOtherDeptUserRes.status === 403,
      'HOD (CSE) cannot access ECE staff member private data (rejected with 403 Forbidden)'
    );

    // 15. HOD user list is filtered to only their department
    const hodListUsersRes = await fetch(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${hodCseToken}` },
    });
    const hodListUsersData = await hodListUsersRes.json();
    const allUsersInCse = hodListUsersData.data?.users?.every(
      (u) => u.department?._id === cseDept._id.toString() || u.department === cseDept._id.toString()
    );
    assert(
      hodListUsersRes.status === 200 && allUsersInCse && hodListUsersData.data?.users?.length > 0,
      'HOD user list contains only users belonging to their own department'
    );

    console.log('\n─── TEST GROUP 5: Staff Privacy Isolation ──────────────────');

    // 16. Staff cannot access another staff member's private data
    const staffAccessOtherUserRes = await fetch(`${BASE_URL}/users/${staff2User._id}`, {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    assert(
      staffAccessOtherUserRes.status === 403,
      'Staff (Rajesh) cannot access another staff (Meena) private data (rejected with 403 Forbidden)'
    );

    // 17. Staff cannot update another staff member's private data
    const staffUpdateOtherUserRes = await fetch(`${BASE_URL}/users/${staff2User._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ phone: '9999999999' }),
    });
    assert(
      staffUpdateOtherUserRes.status === 403,
      'Staff cannot modify another staff member data (rejected with 403 Forbidden)'
    );

    // 18. Staff can access their own private data
    const staffAccessSelfRes = await fetch(`${BASE_URL}/users/${staff1User._id}`, {
      headers: { Authorization: `Bearer ${staff1Token}` },
    });
    const staffSelfData = await staffAccessSelfRes.json();
    assert(
      staffAccessSelfRes.status === 200 && staffSelfData.data?.user?.employeeId === 'BIT-NTS-001',
      'Staff can access their own profile data (200 OK)'
    );

    // 19. Staff can update their own permitted fields (e.g. phone)
    const staffUpdateSelfRes = await fetch(`${BASE_URL}/users/${staff1User._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ phone: '9876543219' }),
    });
    assert(
      staffUpdateSelfRes.status === 200,
      'Staff can update their own profile phone number (200 OK)'
    );

    // 20. Staff cannot escalate privileges by updating their own role or salary
    const staffEscalateRes = await fetch(`${BASE_URL}/users/${staff1User._id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staff1Token}`,
      },
      body: JSON.stringify({ role: 'Admin', basicSalary: 100000 }),
    });
    assert(
      staffEscalateRes.status === 403,
      'Staff cannot modify role or basicSalary on their profile (rejected with 403 Forbidden)'
    );

    console.log('\n─── TEST GROUP 6: Admin Full Access ────────────────────────');

    // 21. Admin can access any department
    const adminGetDeptRes = await fetch(`${BASE_URL}/departments/${eceDept._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminGetDeptRes.status === 200, 'Admin can access any department (200 OK)');

    // 22. Admin can access any user
    const adminGetUserRes = await fetch(`${BASE_URL}/users/${staff1User._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(adminGetUserRes.status === 200, 'Admin can access any user profile (200 OK)');

    // 23. Admin can list all users across all departments
    const adminListUsersRes = await fetch(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminListUsersData = await adminListUsersRes.json();
    assert(
      adminListUsersRes.status === 200 && adminListUsersData.data?.count >= 6,
      'Admin can list all users across departments (200 OK)'
    );

    // 24. Logout endpoint
    const logoutRes = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(logoutRes.status === 200, 'Logout endpoint functions successfully (200 OK)');

  } catch (err) {
    console.error('💥 Unhandled error in test runner:', err);
    failedTests++;
  } finally {
    await teardown();
  }
};

runTests();
