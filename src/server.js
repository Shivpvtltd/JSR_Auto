/**
 * YT-AutoPilot Pro - Tier 1: Render Orchestration Server
 * 
 * Responsibilities:
 * - User authentication & registration (Firebase Auth)
 * - Multi-channel Google OAuth management per user
 * - Scheduling & cron job triggering (12:05 AM daily)
 * - Retry logic & error handling coordination
 * - Firestore database operations
 * - Webhook management for GitHub Actions
 * - YouTube API upload coordination
 * - Multi-channel video generation support
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
const userRoutes = require('./routes/user');
const channelRoutes = require('./routes/channels');

// Utility imports
const { initializeFirebase } = require('./utils/firebase');
const { triggerGitHubWorkflow } = require('./utils/github');
const { checkSystemHealth } = require('./utils/health');

// Scheduler imports
const { mainTrigger } = require('./scheduler/mainTrigger');
const { backupTrigger } = require('./scheduler/backupTrigger');
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
app.use('/api/user', userRoutes);
app.use('/api/channels', channelRoutes);

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
// SCHEDULER SYSTEM (IST Timezone)
// ============================================

// 1. Main Generation Trigger: 12:05 AM IST
//    Triggers GitHub Actions for video generation for all active channels

cron.schedule('5 0 * * *', async () => {
  logger.info('🕐 MAIN TRIGGER: 12:05 AM IST - Starting viral shorts generation for all channels');
  try {
    const { generateForAllChannels } = require('./scheduler/mainTrigger');
    await generateForAllChannels();
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

// 3. Publish Shorts: 5:30 PM IST
//    Changes shorts visibility to PUBLIC
cron.schedule('30 17 * * *', async () => {
  logger.info('📱 PUBLISH SHORTS: 5:30 PM IST - Making shorts public');
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
    const { refreshAllTokens } = require('./utils/youtube');
    await refreshAllTokens();
  } catch (error) {
    logger.error('❌ Token refresh error:', error);
  }
});

// Error handler
app.use((err, req, res, next) => {
  // Handle OAuth invalid_grant gracefully (browser retry of callback URL)
  if (err.name === 'TokenError' && err.code === 'invalid_grant') {
    logger.warn('⚠️ OAuth invalid_grant - browser retry detected, ignoring');
    if (req.path && req.path.includes('/auth/youtube/callback')) {
      return res.redirect('/auth/error');
    }
    return res.status(400).json({ error: 'OAuth session expired. Please try connecting again.' });
  }

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
  logger.info(`   - Main generation: 12:05 AM IST (All Channels)`);
  logger.info(`   - Backup check: 4:00 AM IST`);
  logger.info(`   - Publish shorts: 5:30 PM IST`);
  logger.info(`🔍 Health check: /health`);
  logger.info(`👤 User API: /api/user`);
  logger.info(`📺 Channel API: /api/channels`);
});

module.exports = app;
