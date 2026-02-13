/**
 * Publish Shorts Scheduler - 5:30 PM IST
 * Changes shorts visibility to PUBLIC and adds long video links
 */
const { updateVideoVisibility, updateVideoDescription } = require('../utils/youtube');
const { updateVideoStatus, getVideosByDate, getLongVideoForShorts } = require('../utils/firestore');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

async function publishShorts() {
  /**
   * Publish shorts at 5:30 PM IST
   * 1. Get all UNLISTED shorts scheduled for today
   * 2. Get corresponding long video URL
   * 3. Update description with long video link
   * 4. Update visibility to PUBLIC
   * 5. Update Firestore status
   */
  
  logger.info('📱 Starting shorts publication');
  
  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Get shorts scheduled for today
    const shorts = await getVideosByDate(today, 'short');
    
    if (!shorts || shorts.length === 0) {
      logger.info('ℹ️ No shorts scheduled for today');
      return {
        success: true,
        published: 0,
        message: 'No shorts to publish'
      };
    }
    
    logger.info(`📱 Found ${shorts.length} short(s) to publish`);
    
    // Get today's long video URL for linking
    const longVideo = await getLongVideoForShorts(today);
    const longVideoUrl = longVideo ? `https://youtube.com/watch?v=${longVideo.videoId}` : '';
    
    if (longVideoUrl) {
      logger.info(`🔗 Long video URL for shorts: ${longVideoUrl}`);
    }
    
    const results = [];
    
    for (const short of shorts) {
      try {
        logger.info(`📱 Publishing: ${short.title} (${short.videoId})`);
        
        // Update description with long video link
        let updatedDescription = short.description || '';
        
        if (longVideoUrl) {
          // Add long video link to description
          const linkSection = `\n\n📺 पूरी वीडियो यहाँ देखें:\n${longVideoUrl}\n\n⚠️ ये सिर्फ एक छोटा सा हिस्सा था... असली कहानी और भी ज़्यादा शॉकिंग है!`;
          
          // Only add if not already present
          if (!updatedDescription.includes(longVideoUrl)) {
            updatedDescription += linkSection;
          }
          
          // Update description on YouTube
          await updateVideoDescription(short.videoId, updatedDescription);
          logger.info(`📝 Updated description with long video link`);
        }
        
        // Update visibility to PUBLIC
        const updateResult = await updateVideoVisibility(short.videoId, 'public');
        
        if (updateResult.success) {
          // Update Firestore
          await updateVideoStatus(short.videoId, {
            status: 'published',
            visibility: 'public',
            publishedAt: new Date().toISOString(),
            publishedBy: 'scheduler_530pm',
            longVideoUrl: longVideoUrl,
            descriptionUpdated: !!longVideoUrl
          });
          
          logger.info(`✅ Published: ${short.title}`);
          
          results.push({
            videoId: short.videoId,
            title: short.title,
            status: 'published',
            url: `https://youtube.com/shorts/${short.videoId}`,
            longVideoUrl: longVideoUrl
          });
        } else {
          throw new Error(updateResult.error);
        }
        
      } catch (error) {
        logger.error(`❌ Failed to publish ${short.videoId}:`, error);
        
        results.push({
          videoId: short.videoId,
          title: short.title,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.status === 'published').length;
    
    logger.info(`✅ Published ${successCount}/${shorts.length} shorts`);
    
    return {
      success: true,
      published: successCount,
      total: shorts.length,
      results
    };
    
  } catch (error) {
    logger.error('❌ Publish shorts failed:', error);
    throw error;
  }
}

module.exports = { publishShorts };
