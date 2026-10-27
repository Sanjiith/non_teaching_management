require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { startAbsenceProcessingJob } = require('./services/absenceProcessor.service');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start server
const startServer = async () => {
  await connectDB();

  // Start autonomous background absence processor (checks after 11:00 AM check-in deadline)
  startAbsenceProcessingJob();

  app.listen(PORT, () => {
    console.log('BIT Non-Teaching Staff Portal — Backend');
    console.log('');
    console.log(`Server running on port    : ${PORT}`);
    console.log(`Environment               : ${process.env.NODE_ENV}`);
    console.log(`Client URL                : ${process.env.CLIENT_URL}`);
  });
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
  process.exit(1);
});
