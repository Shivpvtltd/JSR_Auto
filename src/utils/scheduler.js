/**
 * Scheduler Utility
 * Handles scheduled publishing of videos
 */

const cron = require('node-cron');
const { logger } = require('../server');
const { updateVideoVisibility } = require('./youtube');
const { updateEpisodeStatus, addScheduledPublish, markPublishCompleted } = require('./firestore');
const { notifyWebhook } = require('./notifications');

// Store scheduled jobs
const scheduledJobs = new Map();

// Initialize scheduler
const initializeScheduler = () => {
  logger.info('Initializing publish scheduler...');
  
  // Check for pending scheduled publishes on startup
  checkPendingPublishes();
  
  // Schedule daily check at 4:55 PM IST (before 5:00 PM publish)
  cron.schedule('55 16 * * *', async () => {
    logger.info('Scheduler: Checking pending publishes for today');
    await checkPendingPublishes();
  }, {
    timezone: 'Asia/Kolkata'
  });
  
  logger.info('Publish scheduler initialized');
};

// Schedule a publish job
const schedulePublishJob = async (videoId, type, runId, longVideoId = null, scheduledTime = null) => {
  // Default times (IST)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  
  let targetTime;
  
  if (scheduledTime) {
    targetTime = new Date(scheduledTime);
  } else {
    // Use default times: 5:00 PM for long, 5:30 PM for shorts
    targetTime = new Date(now);
    targetTime.setHours(type === 'long' ? 17 : 17, type === 'long' ? 0 : 30, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
  }
  
  const delayMs = targetTime.getTime() - now.getTime();
  
  // Save to Firestore
  await addScheduledPublish(videoId, type, runId, longVideoId, targetTime);
  
  // Schedule the job
  const jobId = `${type}_${videoId}`;
  
  // Clear existing job if any
  if (scheduledJobs.has(jobId)) {
    clearTimeout(scheduledJobs.get(jobId));
  }
  
  const timeoutId = setTimeout(async () => {
    await executePublish(videoId, type, runId, longVideoId);
  }, delayMs);
  
  scheduledJobs.set(jobId, timeoutId);
  
  logger.info(`Scheduled ${type} video ${videoId} for ${targetTime.toISOString()}`);
  
  return {
    videoId,
    type,
    scheduledTime: targetTime.toISOString(),
    delayMs
  };
};

// Execute publish
const executePublish = async (videoId, type, runId, longVideoId) => {
  try {
    logger.info(`Executing ${type} publish for ${videoId}`);
    
    if (type === 'long') {
      // Make long video public
      await updateVideoVisibility(videoId, 'public');
      
      if (runId) {
        await updateEpisodeStatus(runId, {
          status: 'long_published',
          longPublishedAt: new Date().toISOString()
        });
      }
      
      await notifyWebhook('long_video_published', {
        videoId,
        runId,
        publishedAt: new Date().toISOString()
      });
      
      logger.info(`Long video published: ${videoId}`);
    } else if (type === 'shorts') {
      // Update description with long video link if provided
      if (longVideoId) {
        const { linkToLongVideo } = require('./youtube');
        await linkToLongVideo(videoId, longVideoId);
      }
      
      // Make shorts public
      await updateVideoVisibility(videoId, 'public');
      
      if (runId) {
        await updateEpisodeStatus(runId, {
          status: 'shorts_published',
          shortsPublishedAt: new Date().toISOString(),
          linkedLongVideo: longVideoId
        });
      }
      
      await notifyWebhook('shorts_published', {
        videoId,
        longVideoId,
        runId,
        publishedAt: new Date().toISOString()
      });
      
      logger.info(`Shorts published: ${videoId}`);
    }
    
    // Mark as completed in Firestore
    await markPublishCompleted(videoId);
    
    // Remove from scheduled jobs
    const jobId = `${type}_${videoId}`;
    scheduledJobs.delete(jobId);
    
  } catch (error) {
    logger.error(`Failed to publish ${type} video ${videoId}:`, error);
    
    await notifyWebhook('publish_failed', {
      videoId,
      type,
      runId,
      error: error.message
    });
  }
};

// Check and reschedule pending publishes
const checkPendingPublishes = async () => {
  try {
    const { getScheduledPublishes } = require('./firestore');
    const pendingPublishes = await getScheduledPublishes();
    
    logger.info(`Found ${pendingPublishes.length} pending scheduled publishes`);
    
    for (const publish of pendingPublishes) {
      const scheduledTime = new Date(publish.scheduledTime);
      const now = new Date();
      
      if (scheduledTime <= now) {
        // Time has passed, execute immediately
        logger.info(`Executing overdue publish: ${publish.videoId}`);
        await executePublish(publish.videoId, publish.type, publish.runId, publish.longVideoId);
      } else {
        // Reschedule
        await schedulePublishJob(
          publish.videoId,
          publish.type,
          publish.runId,
          publish.longVideoId,
          scheduledTime
        );
      }
    }
  } catch (error) {
    logger.error('Error checking pending publishes:', error);
  }
};

// Cancel scheduled publish
const cancelScheduledPublish = (videoId, type) => {
  const jobId = `${type}_${videoId}`;
  
  if (scheduledJobs.has(jobId)) {
    clearTimeout(scheduledJobs.get(jobId));
    scheduledJobs.delete(jobId);
    logger.info(`Cancelled scheduled publish: ${jobId}`);
    return true;
  }
  
  return false;
};

// Get all scheduled jobs
const getScheduledJobs = () => {
  return Array.from(scheduledJobs.keys());
};

module.exports = {
  initializeScheduler,
  schedulePublishJob,
  executePublish,
  checkPendingPublishes,
  cancelScheduledPublish,
  getScheduledJobs
};
