/**
 * System Health Check
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
  }
  
  // Check YouTube API (token validity)
  try {
    const { refreshYouTubeToken } = require('./youtube');
    await refreshYouTubeToken();
    checks.services.youtube = 'ok';
  } catch (error) {
    checks.services.youtube = 'error';
    checks.status = 'degraded';
  }
  
  // Check GitHub API
  try {
    const { getActionsUsage } = require('./github');
    const usage = await getActionsUsage();
    checks.services.github = usage ? 'ok' : 'error';
  } catch (error) {
    checks.services.github = 'error';
  }
  
  return checks;
}

module.exports = { checkSystemHealth };
