/**
 * Publish Long Videos Scheduler - 5:00 PM IST
 * Changes video visibility from UNLISTED to PUBLIC
 */
const { updateVideoVisibility, getScheduledVideos } = require('../utils/youtube');
const { updateVideoStatus, getVideosByDate } = require('../utils/firestore');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

async function publishLongVideos() {
  /**
   * Publish long videos at 5:00 PM IST
   * 1. Get all UNLISTED videos scheduled for today
   * 2. Update visibility to PUBLIC
   * 3. Update Firestore status
   * 4. Store video URL for shorts to reference
   */
  
  logger.info('📹 Starting long video publication');
  
  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Get videos scheduled for today
    const videos = await getVideosByDate(today, 'long');
    
    if (!videos || videos.length === 0) {
      logger.info('ℹ️ No long videos scheduled for today');
      return {
        success: true,
        published: 0,
        message: 'No videos to publish'
      };
    }
    
    logger.info(`📹 Found ${videos.length} long video(s) to publish`);
    
    const results = [];
    
    for (const video of videos) {
      try {
        logger.info(`📹 Publishing: ${video.title} (${video.videoId})`);
        
        // Update visibility to PUBLIC
        const updateResult = await updateVideoVisibility(video.videoId, 'public');
        
        if (updateResult.success) {
          // Update Firestore
          await updateVideoStatus(video.videoId, {
            status: 'published',
            visibility: 'public',
            publishedAt: new Date().toISOString(),
            publishedBy: 'scheduler_5pm'
          });
          
          logger.info(`✅ Published: ${video.title}`);
          
          results.push({
            videoId: video.videoId,
            title: video.title,
            status: 'published',
            url: `https://youtube.com/watch?v=${video.videoId}`
          });
        } else {
          throw new Error(updateResult.error);
        }
        
      } catch (error) {
        logger.error(`❌ Failed to publish ${video.videoId}:`, error);
        
        results.push({
          videoId: video.videoId,
          title: video.title,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.status === 'published').length;
    
    logger.info(`✅ Published ${successCount}/${videos.length} long videos`);
    
    return {
      success: true,
      published: successCount,
      total: videos.length,
      results
    };
    
  } catch (error) {
    logger.error('❌ Publish long videos failed:', error);
    throw error;
  }
}

module.exports = { publishLongVideos };
