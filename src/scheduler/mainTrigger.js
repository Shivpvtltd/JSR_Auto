/**
 * Main Trigger Scheduler - 12:05 AM IST
 * Triggers GitHub Actions workflow for video generation
 */
const { triggerGitHubWorkflow } = require('../utils/github');
const { getCurrentEpisode, updateWorkflowStatus } = require('../utils/firestore');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

async function mainTrigger() {
  /**
   * Main generation trigger at 12:05 AM IST
   * 1. Get current episode from Firestore
   * 2. Trigger GitHub Actions workflow
   * 3. Update workflow status in Firestore
   */
  
  logger.info('🎬 Starting main generation trigger');
  
  try {
    // Get current episode info
    const currentEpisode = await getCurrentEpisode();
    
    logger.info(`📋 Current episode: ${currentEpisode.subCategory} - Ep ${currentEpisode.episode}`);
    
    // Trigger GitHub Actions workflow
    const result = await triggerGitHubWorkflow({
      category: currentEpisode.mainCategory,
      subCategory: currentEpisode.subCategory,
      episode: currentEpisode.episode,
      episodeData: currentEpisode,
      isRetry: false,
      attempt: 1
    });
    
    if (result.success) {
      // Update workflow status in Firestore
      await updateWorkflowStatus({
        runId: result.runId,
        status: 'triggered',
        triggeredAt: new Date().toISOString(),
        category: currentEpisode.mainCategory,
        subCategory: currentEpisode.subCategory,
        episode: currentEpisode.episode,
        triggerType: 'main',
        scheduledFor: new Date().toISOString()
      });
      
      logger.info(`✅ Main trigger successful: ${result.runId}`);
      
      // Schedule visibility change for 5:00 PM
      const publishTime = new Date();
      publishTime.setHours(17, 0, 0, 0); // 5:00 PM today
      
      logger.info(`📅 Video scheduled for public visibility at 5:00 PM IST`);
      
      return {
        success: true,
        runId: result.runId,
        scheduledPublishTime: publishTime.toISOString()
      };
    } else {
      throw new Error(`Trigger failed: ${result.error}`);
    }
    
  } catch (error) {
    logger.error('❌ Main trigger failed:', error);
    
    // Store failure for backup check
    await updateWorkflowStatus({
      status: 'failed',
      failedAt: new Date().toISOString(),
      error: error.message,
      triggerType: 'main'
    });
    
    throw error;
  }
}

module.exports = { mainTrigger };
