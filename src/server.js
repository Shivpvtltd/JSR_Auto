/**
 * YT-AutoPilot Pro - Tier 1: Render Orchestration Server
 * 
 * Responsibilities:
 * - User authentication & Google OAuth management
 * - Scheduling & cron job triggering (12:05 AM IST daily)
 * - Retry logic & error handling coordination
 * - Firestore database operations
 * - Webhook management for GitHub Actions
 * - YouTube API upload coordination
 * - Backup system monitoring (4:00 AM IST trigger check)
 * - Video publishing scheduler (5:00 PM & 5:30 PM IST)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const winston = require('winston');
const path = require('path');
const session = require('express-session');
const passport = require('passport');

const authRoutes = require('./routes/auth');
const webhookRoutes = require('./routes/webhooks');
const statusRoutes = require('./routes/status');
const uploadRoutes = require('./routes/upload');
const publishRoutes = require('./routes/publish');

const { initializeFirebase } = require('./utils/firebase');
const { triggerGitHubWorkflow } = require('./utils/github');
const { checkSystemHealth } = require('./utils/health');
const { scheduleBackupCheck } = require('./utils/backup');
const { initializeScheduler } = require('./utils/scheduler');
const { notifyWebhook } = require('./utils/notifications');

// Initialize logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Session middleware (REQUIRED for Passport OAuth)
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Initialize Firebase
try {
  initializeFirebase();
  logger.info('Firebase initialized successfully');
} catch (error) {
  logger.error('Failed to initialize Firebase:', error);
  process.exit(1);
}

// Routes
app.use('/auth', authRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/status', statusRoutes);
app.use('/upload', uploadRoutes);
app.use('/publish', publishRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = await checkSystemHealth();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'YT-AutoPilot Pro - Tier 1 Orchestration Server',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/auth',
      webhooks: '/webhooks',
      status: '/status',
      upload: '/upload',
      publish: '/publish'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ============================================
// CRON SCHEDULES (IST - Asia/Kolkata)
// ============================================

// Main workflow trigger: 12:05 AM IST (5 0 * * *)
const mainCron = process.env.MAIN_CRON || '5 0 * * *';
cron.schedule(mainCron, async () => {
  logger.info('CRON: Main workflow trigger at 12:05 AM IST');
  try {
    await triggerGitHubWorkflow('01-script-generation.yml', {
      trigger_type: 'scheduled',
      timestamp: new Date().toISOString()
    });
    await notifyWebhook('workflow_triggered', {
      workflow: '01-script-generation.yml',
      trigger: 'cron',
      time: '12:05 AM IST'
    });
  } catch (error) {
    logger.error('CRON: Failed to trigger main workflow:', error);
    await notifyWebhook('workflow_trigger_failed', {
      workflow: '01-script-generation.yml',
      error: error.message
    });
  }
}, {
  timezone: 'Asia/Kolkata'
});

// Backup check: 4:00 AM IST (0 4 * * *)
const backupCron = process.env.BACKUP_CRON || '0 4 * * *';
cron.schedule(backupCron, async () => {
  logger.info('CRON: Backup check at 4:00 AM IST');
  try {
    await scheduleBackupCheck();
  } catch (error) {
    logger.error('CRON: Backup check failed:', error);
  }
}, {
  timezone: 'Asia/Kolkata'
});

// Initialize publish scheduler (5:00 PM & 5:30 PM IST)
initializeScheduler();

// Log all cron schedules
logger.info('============================================');
logger.info('Cron Schedules (IST - Asia/Kolkata):');
logger.info(`  Main workflow: ${mainCron} (12:05 AM)`);
logger.info(`  Backup check: ${backupCron} (4:00 AM)`);
logger.info(`  Long video publish: 5:00 PM`);
logger.info(`  Shorts publish: 5:30 PM`);
logger.info('============================================');

// Start server
app.listen(PORT, () => {
  logger.info(`============================================`);
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Base URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
  logger.info(`Timezone: Asia/Kolkata`);
  logger.info(`============================================`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = { app, logger };
