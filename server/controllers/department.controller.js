const Department = require('../models/Department.model');
const User = require('../models/User.model');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { normalizeRole } = require('../middleware/role.middleware');

/**
 * @desc    Get all departments
 * @route   GET /api/departments
 * @access  Private
 */
const getAllDepartments = async (req, res) => {
  try {
    const userRole = normalizeRole(req.user.role);
    const filter = {};

    // If HOD or Staff requests, optionally filter active or scoped
    if (userRole === 'Staff' || userRole === 'HOD') {
      filter.isActive = true;
    }

    const departments = await Department.find(filter)
      .populate('hod', 'name employeeId staffId email designation phone')
      .sort({ name: 1 });

    return sendSuccess(res, 200, 'Departments fetched successfully', {
      count: departments.length,
      departments,
    });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Get department by ID
 * @route   GET /api/departments/:id
 * @access  Private (Admin: all, HOD: own department only, Staff: own department only)
 */
const getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('hod', 'name employeeId staffId email designation phone');

    if (!department) {
      return sendError(res, 404, 'Department not found.');
    }

    const userRole = normalizeRole(req.user.role);
    const userDeptId = req.user.department?._id?.toString() || req.user.department?.toString();

    // HOD cannot access another department
    if (userRole === 'HOD') {
      if (!userDeptId || userDeptId !== department._id.toString()) {
        return sendError(
          res,
          403,
          'Access denied. HOD cannot access another department.'
        );
      }
    }

    // Staff cannot access another department
    if (userRole === 'Staff') {
      if (!userDeptId || userDeptId !== department._id.toString()) {
        return sendError(
          res,
          403,
          'Access denied. Staff cannot access another department.'
        );
      }
    }

    return sendSuccess(res, 200, 'Department fetched successfully', { department });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Create new department
 * @route   POST /api/departments
 * @access  Private (Admin only)
 */
const createDepartment = async (req, res) => {
  try {
    const { name, code, hod, description, isActive } = req.body;

    const existingName = await Department.findOne({ name: name.trim() });
    if (existingName) {
      return sendError(res, 400, `Department with name '${name}' already exists.`);
    }

    const existingCode = await Department.findOne({ code: code.trim().toUpperCase() });
    if (existingCode) {
      return sendError(res, 400, `Department with code '${code}' already exists.`);
    }

    if (hod) {
      const hodUser = await User.findById(hod);
      if (!hodUser) {
        return sendError(res, 400, 'Assigned HOD user not found.');
      }
    }

    const department = await Department.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      hod: hod || null,
      description: description || '',
      isActive: isActive !== undefined ? isActive : true,
    });

    const populated = await Department.findById(department._id)
      .populate('hod', 'name employeeId staffId email');

    return sendSuccess(res, 201, 'Department created successfully', { department: populated });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Update department
 * @route   PUT /api/departments/:id
 * @access  Private (Admin only)
 */
const updateDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return sendError(res, 404, 'Department not found.');
    }

    const { name, code, hod, description, isActive } = req.body;

    if (name) {
      const existingName = await Department.findOne({
        name: name.trim(),
        _id: { $ne: department._id },
      });
      if (existingName) {
        return sendError(res, 400, `Department with name '${name}' already exists.`);
      }
      department.name = name.trim();
    }

    if (code) {
      const existingCode = await Department.findOne({
        code: code.trim().toUpperCase(),
        _id: { $ne: department._id },
      });
      if (existingCode) {
        return sendError(res, 400, `Department with code '${code}' already exists.`);
      }
      department.code = code.trim().toUpperCase();
    }

    if (hod !== undefined) {
      if (hod) {
        const hodUser = await User.findById(hod);
        if (!hodUser) {
          return sendError(res, 400, 'Assigned HOD user not found.');
        }
      }
      department.hod = hod;
    }

    if (description !== undefined) department.description = description;
    if (isActive !== undefined) department.isActive = isActive;

    await department.save();

    const populated = await Department.findById(department._id)
      .populate('hod', 'name employeeId staffId email');

    return sendSuccess(res, 200, 'Department updated successfully', { department: populated });
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

/**
 * @desc    Delete department
 * @route   DELETE /api/departments/:id
 * @access  Private (Admin only)
 */
const deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return sendError(res, 404, 'Department not found.');
    }

    // Check if users exist in this department
    const usersInDept = await User.countDocuments({ department: department._id });
    if (usersInDept > 0) {
      return sendError(
        res,
        400,
        `Cannot delete department. There are ${usersInDept} staff members assigned to it.`
      );
    }

    await Department.findByIdAndDelete(req.params.id);
    return sendSuccess(res, 200, 'Department deleted successfully.');
  } catch (error) {
    return sendError(res, 500, error.message);
  }
};

module.exports = {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
