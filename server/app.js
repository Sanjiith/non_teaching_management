const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

// ─── Register all Mongoose models ──────────────────────────────────────────
// Must be imported before any route that uses populate() on these models
require('./models/User.model');
require('./models/Department.model');
require('./models/Attendance.model');
require('./models/Leave.model');
require('./models/Shift.model');
require('./models/Schedule.model');
require('./models/Payroll.model');
require('./models/Notification.model');

// Route imports
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const departmentRoutes = require('./routes/department.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const leaveRoutes = require('./routes/leave.routes');
const shiftRoutes = require('./routes/shift.routes');
const scheduleRoutes = require('./routes/schedule.routes');

const app = express();

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logger (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'BIT Non-Teaching Staff Portal API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/schedules', scheduleRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global Error:', err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;
