/**
 * YT-AutoPilot Pro - Tier 1: Render Orchestration Server
 * 
 * Responsibilities:
 * - User authentication & Google OAuth management
 * - Scheduling & cron job triggering (12:05 AM daily)
 * - Retry logic & error handling coordination
 * - Firestore database operations
 * - Webhook management for GitHub Actions
 * - YouTube API upload coordination (UNLISTED → PUBLIC flow)
 * - Visibility management (5:00 PM long, 5:30 PM shorts)
 * - Backup system monitoring (4:00 AM trigger check)
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

// Route imports
const authRoutes = require('./routes/auth');
const webhookRoutes = require('./routes/webhooks');
const statusRoutes = require('./routes/status');
const uploadRoutes = require('./routes/upload');

// Utility imports
const { initializeFirebase } = require('./utils/firebase');
const { triggerGitHubWorkflow } = require('./utils/github');
const { checkSystemHealth } = require('./utils/health');

// Scheduler imports
const { mainTrigger } = require('./scheduler/mainTrigger');
const { backupTrigger } = require('./scheduler/backupTrigger');
const { publishLongVideos } = require('./scheduler/publishLong');
const { publishShorts } = require('./scheduler/publishShorts');

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
  secret: process.env.SESSION_SECRET || 'yt-autopilot-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize Firebase
initializeFirebase();

// API Routes (before static files)
app.use('/auth', authRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/status', statusRoutes);
app.use('/upload', uploadRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = await checkSystemHealth();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// SPA catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ============================================
// NEW SCHEDULER SYSTEM (IST Timezone)
// ============================================

// 1. Main Generation Trigger: 12:05 AM IST
//    Triggers GitHub Actions for video generation
cron.schedule('5 0 * * *', async () => {
  logger.info('🕐 MAIN TRIGGER: 12:05 AM IST - Starting video generation');
  try {
    await mainTrigger();
  } catch (error) {
    logger.error('❌ Main trigger error:', error);
  }
}, {
  scheduled: true,
  timezone: 'Asia/Kolkata'
});

// 2. Backup Check: 4:00 AM IST
//    Checks if main generation failed, triggers backup if needed
cron.schedule('0 4 * * *', async () => {
  logger.info('🔍 BACKUP TRIGGER: 4:00 AM IST - Checking backup status');
  try {
    await backupTrigger();
  } catch (error) {
    logger.error('❌ Backup trigger error:', error);
  }
}, {
  scheduled: true,
  timezone: 'Asia/Kolkata'
});

// 3. Publish Long Videos: 5:00 PM IST
//    Changes visibility from UNLISTED to PUBLIC
cron.schedule('0 17 * * *', async () => {
  logger.info('📹 PUBLISH LONG: 5:00 PM IST - Making long videos public');
  try {
    await publishLongVideos();
  } catch (error) {
    logger.error('❌ Publish long videos error:', error);
  }
}, {
  scheduled: true,
  timezone: 'Asia/Kolkata'
});

// 4. Publish Shorts: 5:30 PM IST
//    Changes shorts visibility to PUBLIC + adds long video links
cron.schedule('30 17 * * *', async () => {
  logger.info('📱 PUBLISH SHORTS: 5:30 PM IST - Making shorts public with links');
  try {
    await publishShorts();
  } catch (error) {
    logger.error('❌ Publish shorts error:', error);
  }
}, {
  scheduled: true,
  timezone: 'Asia/Kolkata'
});

// Token refresh cron (every 6 hours)
cron.schedule('0 */6 * * *', async () => {
  logger.info('🔄 Refreshing YouTube tokens');
  try {
    const { refreshYouTubeToken } = require('./utils/youtube');
    await refreshYouTubeToken();
  } catch (error) {
    logger.error('❌ Token refresh error:', error);
  }
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 JSR_Auto Server running on port ${PORT}`);
  logger.info(`📅 Schedulers active:`);
  logger.info(`   - Main generation: 12:05 AM IST`);
  logger.info(`   - Backup check: 4:00 AM IST`);
  logger.info(`   - Publish long: 5:00 PM IST`);
  logger.info(`   - Publish shorts: 5:30 PM IST`);
  logger.info(`🔍 Health check: /health`);
});

module.exports = app;
