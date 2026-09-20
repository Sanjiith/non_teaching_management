const mongoose = require('mongoose');

const LEAVE_TYPES = [
  'Casual Leave',
  'Medical Leave',
  'Earned Leave',
  'Maternity Leave',
  'Paternity Leave',
  'Other',
];

const LEAVE_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

const leaveSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    type: {
      type: String,
      enum: LEAVE_TYPES,
      required: [true, 'Leave type is required'],
    },
    fromDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    toDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    startTime: {
      type: String,
      default: '09:00 AM',
      trim: true,
    },
    endTime: {
      type: String,
      default: '05:00 PM',
      trim: true,
    },
    totalDays: {
      type: Number,
      required: [true, 'Total days is required'],
      min: [0.5, 'Minimum leave duration is 0.5 day'],
    },
    reason: {
      type: String,
      required: [true, 'Reason for leave is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(LEAVE_STATUS),
      default: LEAVE_STATUS.PENDING,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvalRemarks: {
      type: String,
      default: '',
      trim: true,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    document: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual aliases
leaveSchema.virtual('startDate')
  .get(function () { return this.fromDate; })
  .set(function (val) { this.fromDate = val; });

leaveSchema.virtual('endDate')
  .get(function () { return this.toDate; })
  .set(function (val) { this.toDate = val; });

leaveSchema.virtual('leaveType')
  .get(function () { return this.type; })
  .set(function (val) { this.type = val; });

// Sync aliases on save
leaveSchema.pre('validate', function (next) {
  if (!this.fromDate && this.startDate) {
    this.fromDate = this.startDate;
  }
  if (!this.toDate && this.endDate) {
    this.toDate = this.endDate;
  }
  if (!this.type && this.leaveType) {
    this.type = this.leaveType;
  }
  next();
});

module.exports = mongoose.model('Leave', leaveSchema);
module.exports.LEAVE_TYPES = LEAVE_TYPES;
module.exports.LEAVE_STATUS = LEAVE_STATUS;
