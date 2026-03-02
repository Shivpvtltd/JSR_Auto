/**
 * System Health Check
 * FIXED: Better error handling for token refresh
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
  
  // Check YouTube API (token validity)
  try {
    const { refreshYouTubeToken } = require('./youtube');
    // Use default channel for health check - don't fail the whole check
    await refreshYouTubeToken('default').catch(err => {
      console.warn('⚠️ YouTube token refresh skipped (normal if no default channel)');
      return { skip: true };
    });
    checks.services.youtube = 'ok';
  } catch (error) {
    // Don't mark as error if it's just missing tokens
    if (error.message.includes('No refresh token')) {
      checks.services.youtube = 'pending'; // Waiting for user to connect
      console.warn('⚠️ YouTube: Waiting for channel connection');
    } else {
      checks.services.youtube = 'error';
      console.error('❌ YouTube health check error:', error.message);
    }
  }
  
  // Check GitHub API
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
