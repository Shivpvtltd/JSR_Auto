/**
 * Publish Routes
 * Handles video publishing to YouTube
 */

const express = require('express');
const { logger } = require('../server');
const { 
  updateVideoVisibility, 
  addVideoToPlaylist,
  updateVideoDescription
} = require('../utils/youtube');
const { updateEpisodeStatus } = require('../utils/firestore');
const { notifyWebhook } = require('../utils/notifications');

const router = express.Router();

// Make long video public
router.post('/long/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { run_id } = req.body;
    
    logger.info(`Making long video public: ${videoId}`);
    
    // Update video visibility to public
    const result = await updateVideoVisibility(videoId, 'public');
    
    // Update Firestore
    if (run_id) {
      await updateEpisodeStatus(run_id, {
        status: 'long_published',
        longPublishedAt: new Date().toISOString()
      });
    }
    
    await notifyWebhook('long_video_published', {
      videoId,
      run_id,
      publishedAt: new Date().toISOString()
    });
    
    res.json({
      success: true,
      videoId,
      status: 'public',
      result
    });
  } catch (error) {
    logger.error('Publish long video error:', error);
    res.status(500).json({ error: 'Failed to publish long video' });
  }
});

// Make shorts public with long video link
router.post('/shorts/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { run_id, long_video_id } = req.body;
    
    logger.info(`Making shorts public: ${videoId}`);
    
    // Update description with long video link
    if (long_video_id) {
      const longVideoUrl = `https://youtube.com/watch?v=${long_video_id}`;
      const description = `\n\n📺 Full Video: ${longVideoUrl}`;
      await updateVideoDescription(videoId, description);
    }
    
    // Update video visibility to public
    const result = await updateVideoVisibility(videoId, 'public');
    
    // Update Firestore
    if (run_id) {
      await updateEpisodeStatus(run_id, {
        status: 'shorts_published',
        shortsPublishedAt: new Date().toISOString(),
        linkedLongVideo: long_video_id
      });
    }
    
    await notifyWebhook('shorts_published', {
      videoId,
      longVideoId: long_video_id,
      run_id,
      publishedAt: new Date().toISOString()
    });
    
    res.json({
      success: true,
      videoId,
      longVideoId: long_video_id,
      status: 'public',
      result
    });
  } catch (error) {
    logger.error('Publish shorts error:', error);
    res.status(500).json({ error: 'Failed to publish shorts' });
  }
});

// Schedule publish (manual trigger)
router.post('/schedule', async (req, res) => {
  try {
    const { video_id, type, publish_at, long_video_id } = req.body;
    
    if (!video_id || !type || !publish_at) {
      return res.status(400).json({ 
        error: 'video_id, type, and publish_at required' 
      });
    }
    
    const { schedulePublishJob } = require('../utils/scheduler');
    await schedulePublishJob(video_id, type, null, long_video_id, new Date(publish_at));
    
    res.json({
      success: true,
      video_id,
      type,
      scheduled_for: publish_at
    });
  } catch (error) {
    logger.error('Schedule publish error:', error);
    res.status(500).json({ error: 'Failed to schedule publish' });
  }
});

// Get video status
router.get('/status/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const { getVideoStatus } = require('../utils/youtube');
    
    const status = await getVideoStatus(videoId);
    res.json(status);
  } catch (error) {
    logger.error('Get video status error:', error);
    res.status(500).json({ error: 'Failed to get video status' });
  }
});

module.exports = router;
