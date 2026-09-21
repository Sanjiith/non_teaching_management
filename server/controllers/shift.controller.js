const Shift = require('../models/Shift.model');
const Schedule = require('../models/Schedule.model');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// @desc    Create a new shift
// @route   POST /api/shifts
// @access  Admin
exports.createShift = async (req, res) => {
  try {
    const { name, startTime, endTime, workingHours, department, description, isActive } = req.body;

    // Calculate working hours if not provided
    let calculatedHours = workingHours;
    if (calculatedHours === undefined || calculatedHours === null) {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      let diff = (endH * 60 + endM) - (startH * 60 + startM);
      if (diff < 0) diff += 24 * 60; // handles overnight shift
      calculatedHours = parseFloat((diff / 60).toFixed(1));
    }

    const shift = await Shift.create({
      name,
      startTime,
      endTime,
      workingHours: calculatedHours,
      department: department || null,
      description: description || '',
      isActive: isActive !== undefined ? isActive : true,
    });

    return sendSuccess(res, 201, 'Shift created successfully', shift);
  } catch (error) {
    console.error('createShift error:', error);
    return sendError(res, 500, error.message);
  }
};

// @desc    Get all shifts
// @route   GET /api/shifts
// @access  Authenticated (Admin, HOD, Staff)
exports.getAllShifts = async (req, res) => {
  try {
    const { department, isActive } = req.query;
    const filter = {};

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Role-based filtering
    if (req.user.role === 'Admin') {
      if (department) {
        filter.$or = [{ department }, { department: null }];
      }
    } else if (req.user.role === 'HOD') {
      const hodDeptId = req.user.department?._id || req.user.department;
      filter.$or = [{ department: hodDeptId }, { department: null }];
    } else {
      // Staff
      const staffDeptId = req.user.department?._id || req.user.department;
      filter.isActive = true;
      if (staffDeptId) {
        filter.$or = [{ department: staffDeptId }, { department: null }];
      }
    }

    const shifts = await Shift.find(filter).populate('department', 'name code').sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'Shifts retrieved successfully', shifts);
  } catch (error) {
    console.error('getAllShifts error:', error);
    return sendError(res, 500, error.message);
  }
};

// @desc    Get shift by ID
// @route   GET /api/shifts/:id
// @access  Authenticated
exports.getShiftById = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id).populate('department', 'name code');
    if (!shift) {
      return sendError(res, 404, 'Shift not found');
    }
    return sendSuccess(res, 200, 'Shift retrieved successfully', shift);
  } catch (error) {
    console.error('getShiftById error:', error);
    return sendError(res, 500, error.message);
  }
};

// @desc    Update a shift
// @route   PUT /api/shifts/:id
// @access  Admin
exports.updateShift = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return sendError(res, 404, 'Shift not found');
    }

    const { name, startTime, endTime, workingHours, department, description, isActive } = req.body;

    if (name !== undefined) shift.name = name;
    if (startTime !== undefined) shift.startTime = startTime;
    if (endTime !== undefined) shift.endTime = endTime;
    if (description !== undefined) shift.description = description;
    if (isActive !== undefined) shift.isActive = isActive;
    if (department !== undefined) shift.department = department || null;

    if (workingHours !== undefined) {
      shift.workingHours = workingHours;
    } else if (startTime || endTime) {
      const [startH, startM] = (shift.startTime).split(':').map(Number);
      const [endH, endM] = (shift.endTime).split(':').map(Number);
      let diff = (endH * 60 + endM) - (startH * 60 + startM);
      if (diff < 0) diff += 24 * 60;
      shift.workingHours = parseFloat((diff / 60).toFixed(1));
    }

    await shift.save();
    return sendSuccess(res, 200, 'Shift updated successfully', shift);
  } catch (error) {
    console.error('updateShift error:', error);
    return sendError(res, 500, error.message);
  }
};

// @desc    Delete or deactivate a shift
// @route   DELETE /api/shifts/:id
// @access  Admin
exports.deleteShift = async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      return sendError(res, 404, 'Shift not found');
    }

    // Check if shift is referenced in any schedules
    const scheduleCount = await Schedule.countDocuments({ shift: shift._id });
    if (scheduleCount > 0) {
      // Soft deactivate to avoid breaking schedule history
      shift.isActive = false;
      await shift.save();
      return sendSuccess(res, 200, 'Shift is associated with schedules, deactivated instead of deleted', shift);
    }

    await Shift.findByIdAndDelete(req.params.id);
    return sendSuccess(res, 200, 'Shift deleted successfully');
  } catch (error) {
    console.error('deleteShift error:', error);
    return sendError(res, 500, error.message);
  }
};
