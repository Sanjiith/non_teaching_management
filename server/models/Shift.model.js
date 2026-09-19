const mongoose = require('mongoose');

// Shift schema — full implementation in Day 5
const shiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: String, // HH:MM format, e.g. "08:00"
      required: true,
    },
    endTime: {
      type: String, // HH:MM format, e.g. "17:00"
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null, // null means applicable to all departments
    },
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Shift', shiftSchema);
