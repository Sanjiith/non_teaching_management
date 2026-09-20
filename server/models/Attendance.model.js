const mongoose = require('mongoose');

const ATTENDANCE_STATUS = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LEAVE: 'Leave',
  HOLIDAY: 'Holiday',
  WEEKLY_OFF: 'Weekly Off',
};

const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    date: {
      type: Date,
      required: [true, 'Attendance date is required'],
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Leave', 'Holiday', 'Weekly Off', 'On-Leave'],
      required: [true, 'Attendance status is required'],
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      default: null,
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

// Normalize date to start of day UTC and normalize status 'On-Leave' -> 'Leave'
attendanceSchema.pre('validate', function (next) {
  if (this.date) {
    const d = new Date(this.date);
    d.setUTCHours(0, 0, 0, 0);
    this.date = d;
  }
  if (this.status === 'On-Leave') {
    this.status = 'Leave';
  }
  next();
});

// Compound unique index to prevent duplicate attendance records per user per day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
module.exports.ATTENDANCE_STATUS = ATTENDANCE_STATUS;
