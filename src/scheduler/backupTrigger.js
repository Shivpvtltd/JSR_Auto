/**
 * Backup Trigger Scheduler - 4:00 AM IST
 * Checks if main generation succeeded, triggers backup if needed
 */
const { triggerGitHubWorkflow } = require('../utils/github');
const { getWorkflowStatus, updateWorkflowStatus, getCurrentEpisode } = require('../utils/firestore');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

async function backupTrigger() {
  /**
   * Backup check at 4:00 AM IST
   * 1. Check if video was uploaded yesterday (12:05 AM run)
   * 2. If not, trigger backup workflow
   * 3. Update status
   */
  
  logger.info('🔍 Starting backup check');
  
  try {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Check if video was uploaded yesterday
    const workflowStatus = await getWorkflowStatus(yesterdayStr);
    
    if (workflowStatus && workflowStatus.status === 'uploaded') {
      logger.info('✅ Video was successfully uploaded yesterday, no backup needed');
      return {
        success: true,
        backupNeeded: false,
        message: 'Video already uploaded'
      };
    }
    
    // Check if main trigger succeeded
    if (workflowStatus && workflowStatus.status === 'triggered') {
      // Main was triggered but no upload yet - might still be processing
      logger.info('⏳ Main workflow triggered but no upload yet - may still be processing');
      
      // Check if it's been more than 4 hours (should have completed)
      const triggeredAt = new Date(workflowStatus.triggeredAt);
      const now = new Date();
      const hoursSinceTrigger = (now - triggeredAt) / (1000 * 60 * 60);
      
      if (hoursSinceTrigger < 4) {
        logger.info(`⏳ Only ${hoursSinceTrigger.toFixed(1)} hours since trigger - waiting`);
        return {
          success: true,
          backupNeeded: false,
          message: 'Workflow still processing'
        };
      }
    }
    
    // Backup needed
    logger.info('⚠️ Backup needed - triggering backup workflow');
    
    // Get current episode
    const currentEpisode = await getCurrentEpisode();
    
    // Trigger backup workflow
    const result = await triggerGitHubWorkflow({
      category: currentEpisode.mainCategory,
      subCategory: currentEpisode.subCategory,
      episode: currentEpisode.episode,
      episodeData: currentEpisode,
      isRetry: true,
      attempt: 1
    });
    
    if (result.success) {
      await updateWorkflowStatus({
        runId: result.runId,
        status: 'backup_triggered',
        triggeredAt: new Date().toISOString(),
        category: currentEpisode.mainCategory,
        subCategory: currentEpisode.subCategory,
        episode: currentEpisode.episode,
        triggerType: 'backup',
        originalTriggerDate: yesterdayStr
      });
      
      logger.info(`✅ Backup trigger successful: ${result.runId}`);
      
      return {
        success: true,
        backupNeeded: true,
        runId: result.runId
      };
    } else {
      throw new Error(`Backup trigger failed: ${result.error}`);
    }
    
  } catch (error) {
    logger.error('❌ Backup trigger failed:', error);
    throw error;
  }
}

module.exports = { backupTrigger };
