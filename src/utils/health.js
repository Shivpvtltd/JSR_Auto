/**
 * Health Check Utility
 */

const { logger } = require('../server');
const { getFirestore } = require('./firebase');

const checkSystemHealth = async () => {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    services: {}
  };
  
  // Check Firebase
  try {
    const db = getFirestore();
    await db.collection('health').doc('ping').set({
      timestamp: new Date().toISOString()
    });
    checks.services.firebase = { status: 'healthy' };
  } catch (error) {
    checks.services.firebase = { status: 'unhealthy', error: error.message };
    checks.status = 'degraded';
  }
  
  // Check YouTube API (token validity)
  try {
    const { getLatestYouTubeTokens } = require('./firestore');
    const tokens = await getLatestYouTubeTokens();
    checks.services.youtube = {
      status: tokens ? 'healthy' : 'not_configured',
      authenticated: !!tokens
    };
  } catch (error) {
    checks.services.youtube = { status: 'unhealthy', error: error.message };
  }
  
  // Check GitHub API
  try {
    const { listWorkflowRuns } = require('./github');
    await listWorkflowRuns(null, 1);
    checks.services.github = { status: 'healthy' };
  } catch (error) {
    checks.services.github = { status: 'unhealthy', error: error.message };
    checks.status = 'degraded';
  }
  
  // Check Cloudinary
  try {
    const { cloudinary } = require('./cloudinary');
    await cloudinary.api.ping();
    checks.services.cloudinary = { status: 'healthy' };
  } catch (error) {
    checks.services.cloudinary = { status: 'unhealthy', error: error.message };
    checks.status = 'degraded';
  }
  
  // Memory usage
  const memUsage = process.memoryUsage();
  checks.memory = {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
    rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB'
  };
  
  // Uptime
  checks.uptime = Math.round(process.uptime()) + ' seconds';
  
  return checks;
};

module.exports = {
  checkSystemHealth
};
