require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const superAdminRoutes = require('./routes/superAdmin');
const tenantRoutes = require('./routes/tenant');
const cleanerRoutes = require('./routes/cleaner');
const customerRoutes = require('./routes/customer');
const notificationRoutes = require('./routes/notifications');
const flutterwaveRoutes = require('./routes/flutterwave');
const flutterwaveController = require('./controllers/flutterwaveController');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));

app.post('/api/payments/flutterwave/webhook', express.raw({
  type: 'application/json',
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  },
}), (req, res, next) => {
  try {
    req.body = req.rawBody ? JSON.parse(req.rawBody) : {};
  } catch {
    req.body = {};
  }
  next();
}, flutterwaveController.handleWebhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/tenant', tenantRoutes);
app.use('/api/cleaner', cleanerRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/payments/flutterwave', flutterwaveRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large' });
  }
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use.`);
    console.error('Another backend instance is likely still running.');
    console.error('Fix: stop the other process, or run:');
    console.error(`  netstat -ano | findstr :${PORT}`);
    console.error('  taskkill /PID <pid> /F\n');
    process.exit(1);
  }
  throw err;
});

module.exports = app;
