const User = require('../models/User.model');
const Department = require('../models/Department.model');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { normalizeRole } = require('../middleware/role.middleware');

/**
 * @desc    Get all users (filtered by role and department access)
 * @route   GET /api/users
 * @access  Private (Admin, HOD)
 */
const getAllUsers = async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    const { department, role, search, isActive } = req.query;

    const filter = {};

    // HOD is strictly restricted to their department data
    if (userRole === 'HOD') {
      const hodDeptId = req.user.department?._id || req.user.department;
      if (!hodDeptId) {
        return sendError(res, 400, 'HOD has no department assigned.');
      }
      filter.department = hodDeptId;
    } else if (userRole === 'Admin') {
      if (department) {
        filter.department = department;
      }
    } else {
      // Staff cannot view all users
      return sendError(res, 403, 'Access denied. Staff cannot view user directory.');
    }

    if (role) {
      filter.role = role;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { name: regex },
        { employeeId: regex },
        { staffId: regex },
        { email: regex },
      ];
    }

    const users = await User.find(filter)
      .populate('department', 'name code')
      .sort({ createdAt: -1 });

    return sendSuccess(res, 200, 'Users fetched successfully', {
      count: users.length,
      users,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get user by ID
 * @route   GET /api/users/:id
 * @access  Private (Admin: all, HOD: department staff only, Staff: self only)
 */
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('department', 'name code');

    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    const requesterRole = normalizeRole(req.user.role);

    // Staff can only access their own profile
    if (requesterRole === 'Staff') {
      if (req.user._id.toString() !== user._id.toString()) {
        return sendError(
          res,
          403,
          "Access denied. Staff cannot access another staff member's private data."
        );
      }
    }

    // HOD can only access users within their own department
    if (requesterRole === 'HOD') {
      const hodDeptId = req.user.department?._id?.toString() || req.user.department?.toString();
      const userDeptId = user.department?._id?.toString() || user.department?.toString();

      if (!hodDeptId || hodDeptId !== userDeptId) {
        return sendError(
          res,
          403,
          'Access denied. HOD cannot access user data from another department.'
        );
      }
    }

    return sendSuccess(res, 200, 'User fetched successfully', { user });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Create new user
 * @route   POST /api/users
 * @access  Private (Admin only)
 */
const createUser = async (req, res) => {
  try {
    const {
      employeeId,
      staffId,
      name,
      email,
      password,
      role,
      department,
      designation,
      phone,
      basicSalary,
      joiningDate,
      dateOfJoining,
      isActive,
    } = req.body;

    const id = (employeeId || staffId || '').trim().toUpperCase();

    // Check duplicate employeeId
    const existingId = await User.findOne({
      $or: [{ employeeId: id }, { staffId: id }],
    });
    if (existingId) {
      return sendError(res, 400, `Employee/Staff ID '${id}' is already registered.`);
    }

    // Check duplicate email
    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return sendError(res, 400, `Email '${email}' is already registered.`);
    }

    // If department supplied, verify it exists
    if (department) {
      const deptExists = await Department.findById(department);
      if (!deptExists) {
        return sendError(res, 400, 'Department not found.');
      }
    }

    const newUser = await User.create({
      employeeId: id,
      staffId: id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role || 'Staff',
      department: department || null,
      designation: designation || '',
      phone: phone || '',
      basicSalary: basicSalary !== undefined ? Number(basicSalary) : 0,
      joiningDate: joiningDate || dateOfJoining || new Date(),
      isActive: isActive !== undefined ? isActive : true,
    });

    const populatedUser = await User.findById(newUser._id).populate('department', 'name code');

    return sendSuccess(res, 201, 'User created successfully', { user: populatedUser });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private (Admin: all, HOD: department staff limited, Staff: self profile limited)
 */
const updateUser = async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return sendError(res, 404, 'User not found.');
    }

    const requesterRole = normalizeRole(req.user.role);

    // Staff permissions: only their own profile, can only update phone, profileImage, password
    if (requesterRole === 'Staff') {
      if (req.user._id.toString() !== targetUser._id.toString()) {
        return sendError(
          res,
          403,
          "Access denied. Staff cannot access another staff member's private data."
        );
      }

      const allowedUpdates = ['phone', 'profileImage', 'password'];
      for (const field of Object.keys(req.body)) {
        if (!allowedUpdates.includes(field)) {
          return sendError(
            res,
            403,
            `Access denied. Staff cannot update field '${field}'.`
          );
        }
      }

      if (req.body.phone !== undefined) targetUser.phone = req.body.phone;
      if (req.body.profileImage !== undefined) targetUser.profileImage = req.body.profileImage;
      if (req.body.password) targetUser.password = req.body.password;

      await targetUser.save();
      const updatedUser = await User.findById(targetUser._id).populate('department', 'name code');
      return sendSuccess(res, 200, 'Profile updated successfully', { user: updatedUser });
    }

    // HOD permissions: only staff in their own department
    if (requesterRole === 'HOD') {
      const hodDeptId = req.user.department?._id?.toString() || req.user.department?.toString();
      const targetDeptId = targetUser.department?._id?.toString() || targetUser.department?.toString();

      if (!hodDeptId || hodDeptId !== targetDeptId) {
        return sendError(
          res,
          403,
          'Access denied. HOD cannot access or modify users in another department.'
        );
      }

      // HOD cannot change sensitive fields (role, department, salary)
      const restrictedFields = ['role', 'department', 'basicSalary', 'employeeId', 'staffId'];
      for (const field of Object.keys(req.body)) {
        if (restrictedFields.includes(field)) {
          return sendError(
            res,
            403,
            `Access denied. HOD cannot update field '${field}'. Contact Admin.`
          );
        }
      }

      if (req.body.name) targetUser.name = req.body.name;
      if (req.body.designation !== undefined) targetUser.designation = req.body.designation;
      if (req.body.phone !== undefined) targetUser.phone = req.body.phone;
      if (req.body.isActive !== undefined) targetUser.isActive = req.body.isActive;

      await targetUser.save();
      const updatedUser = await User.findById(targetUser._id).populate('department', 'name code');
      return sendSuccess(res, 200, 'User updated successfully', { user: updatedUser });
    }

    // Admin permissions: full access
    const {
      name,
      email,
      password,
      role,
      department,
      designation,
      phone,
      basicSalary,
      joiningDate,
      dateOfJoining,
      isActive,
      profileImage,
    } = req.body;

    if (name) targetUser.name = name;
    if (email) targetUser.email = email.toLowerCase().trim();
    if (password) targetUser.password = password;
    if (role) targetUser.role = role;
    if (department !== undefined) targetUser.department = department;
    if (designation !== undefined) targetUser.designation = designation;
    if (phone !== undefined) targetUser.phone = phone;
    if (basicSalary !== undefined) targetUser.basicSalary = Number(basicSalary);
    if (joiningDate || dateOfJoining) targetUser.joiningDate = joiningDate || dateOfJoining;
    if (isActive !== undefined) targetUser.isActive = isActive;
    if (profileImage !== undefined) targetUser.profileImage = profileImage;

    await targetUser.save();
    const updatedUser = await User.findById(targetUser._id).populate('department', 'name code');
    return sendSuccess(res, 200, 'User updated successfully', { user: updatedUser });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Delete or deactivate user
 * @route   DELETE /api/users/:id
 * @access  Private (Admin only)
 */
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    // Prevent deleting oneself
    if (req.user._id.toString() === user._id.toString()) {
      return sendError(res, 400, 'Cannot delete your own admin account.');
    }

    await User.findByIdAndDelete(req.params.id);
    return sendSuccess(res, 200, 'User deleted successfully.');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
