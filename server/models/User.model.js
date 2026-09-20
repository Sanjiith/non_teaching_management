const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = {
  ADMIN: 'Admin',
  HOD: 'HOD',
  STAFF: 'Staff',
  NON_TEACHING_STAFF: 'Non-Teaching Staff',
};

const userSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID / Staff ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    staffId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: [true, 'Role is required'],
      default: ROLES.STAFF,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    designation: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    basicSalary: {
      type: Number,
      default: 0,
      min: [0, 'Basic salary cannot be negative'],
    },
    leaveBalances: {
      casualLeave: {
        total: { type: Number, default: 12, min: 0 },
        used: { type: Number, default: 0, min: 0 },
        reserved: { type: Number, default: 0, min: 0 },
      },
      medicalLeave: {
        total: { type: Number, default: 12, min: 0 },
        used: { type: Number, default: 0, min: 0 },
        reserved: { type: Number, default: 0, min: 0 },
      },
      earnedLeave: {
        total: { type: Number, default: 30, min: 0 },
        used: { type: Number, default: 0, min: 0 },
        reserved: { type: Number, default: 0, min: 0 },
      },
    },
    profileImage: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for dateOfJoining
userSchema.virtual('dateOfJoining')
  .get(function () {
    return this.joiningDate;
  })
  .set(function (val) {
    this.joiningDate = val;
  });

// Pre-save hook: sync employeeId & staffId, and hash password
userSchema.pre('save', async function (next) {
  if (!this.employeeId && this.staffId) {
    this.employeeId = this.staffId;
  }
  if (!this.staffId && this.employeeId) {
    this.staffId = this.employeeId;
  }
  if (!this.joiningDate && this.dateOfJoining) {
    this.joiningDate = this.dateOfJoining;
  }

  // Normalize Non-Teaching Staff internally if needed, or keep role
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  return obj;
};

// Helper to resolve leave key on leaveBalances
userSchema.methods.getLeaveBalanceKey = function (leaveType) {
  const norm = (leaveType || '').toLowerCase().replace(/[^a-z]/g, '');
  if (norm.includes('casual')) return 'casualLeave';
  if (norm.includes('medical')) return 'medicalLeave';
  if (norm.includes('earned')) return 'earnedLeave';
  return 'casualLeave';
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;

