const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema(
  {
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff reference is required'],
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shift',
      required: [true, 'Shift reference is required'],
    },
    date: {
      type: Date,
      required: [true, 'Schedule date is required'],
    },
    startTime: {
      type: String, // HH:MM format
      required: true,
    },
    endTime: {
      type: String, // HH:MM format
      required: true,
    },
    status: {
      type: String,
      enum: ['Scheduled', 'Completed', 'Cancelled', 'On Leave', 'Conflict'],
      default: 'Scheduled',
    },
    remarks: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Ensure one schedule per staff per day
scheduleSchema.index({ staff: 1, date: 1 }, { unique: true });
scheduleSchema.index({ department: 1, date: 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);
