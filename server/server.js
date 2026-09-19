require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB then start server
const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║   BIT Non-Teaching Staff Portal — Backend    ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Server running on port    : ${PORT}              ║`);
    console.log(`║  Environment               : ${process.env.NODE_ENV}         ║`);
    console.log(`║  Client URL                : ${process.env.CLIENT_URL} ║`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
  });
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err.message);
  process.exit(1);
});
