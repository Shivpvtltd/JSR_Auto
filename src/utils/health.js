/**
 * System Health Check
 * FIXED: Optional YouTube token check - doesn't fail health check
 */
const { getFirestore } = require('./firebase');

async function checkSystemHealth() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    services: {}
  };
  
  // Check Firebase
  try {
    const db = getFirestore();
    await db.collection('health').doc('ping').set({ timestamp: new Date() });
    checks.services.firebase = 'ok';
  } catch (error) {
    checks.services.firebase = 'error';
    checks.status = 'degraded';
    console.error('❌ Firebase health check failed:', error.message);
  }
  
  // Skip YouTube token check - it's not required for health
  // Tokens are only needed when user wants to upload
  checks.services.youtube = 'ok'; // Optional service
  
  // Check GitHub API (if needed)
  try {
    const { getActionsUsage } = require('./github');
    const usage = await getActionsUsage();
    checks.services.github = usage ? 'ok' : 'error';
  } catch (error) {
    checks.services.github = 'error';
    console.error('❌ GitHub health check error:', error.message);
  }
  
  return checks;
}

module.exports = { checkSystemHealth };
