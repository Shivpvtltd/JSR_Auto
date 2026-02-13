/**
 * Backup System Utility
 */

const { logger } = require('../server');
const { triggerGitHubWorkflow } = require('./github');
const { getRecentEpisodes, updateEpisodeStatus } = require('./firestore');

// Schedule backup check (runs at 4:00 AM IST)
const scheduleBackupCheck = async () => {
  logger.info('Running backup check...');
  
  try {
    // Get today's episode
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const episodes = await getRecentEpisodes(1);
    const todayEpisode = episodes.find(ep => {
      const epDate = new Date(ep.createdAt);
      return epDate >= today;
    });
    
    // Check if main workflow completed
    if (!todayEpisode) {
      logger.warn('No episode found for today. Triggering backup workflow...');
      await triggerBackupWorkflow();
      return;
    }
    
    if (todayEpisode.status === 'failed') {
      logger.warn('Today\'s episode failed. Triggering backup workflow...');
      await triggerBackupWorkflow(todayEpisode.runId);
      return;
    }
    
    if (['completed', 'uploaded', 'long_published', 'shorts_published'].includes(todayEpisode.status)) {
      logger.info('Today\'s episode is on track. No backup needed.');
      return;
    }
    
    // Check if workflow is stuck (no update in last 2 hours)
    const lastUpdate = new Date(todayEpisode.updatedAt);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    if (lastUpdate < twoHoursAgo) {
      logger.warn('Today\'s episode appears stuck. Triggering backup workflow...');
      await triggerBackupWorkflow(todayEpisode.runId);
      return;
    }
    
    logger.info('Backup check complete. Episode in progress.');
    
  } catch (error) {
    logger.error('Backup check error:', error);
  }
};

// Trigger backup workflow
const triggerBackupWorkflow = async (failedRunId = null) => {
  try {
    await triggerGitHubWorkflow('backup.yml', {
      trigger_type: 'backup',
      failed_run_id: failedRunId,
      reason: failedRunId ? 'workflow_failed' : 'no_episode_found',
      timestamp: new Date().toISOString()
    });
    
    logger.info('Backup workflow triggered', { failedRunId });
    
    // Notify
    const { notifyWebhook } = require('./notifications');
    await notifyWebhook('backup_triggered', {
      failedRunId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to trigger backup workflow:', error);
  }
};

module.exports = {
  scheduleBackupCheck,
  triggerBackupWorkflow
};
