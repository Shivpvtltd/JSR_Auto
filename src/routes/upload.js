/**
 * Upload Routes - Manual video upload endpoints
 */
const express = require('express');
const router = express.Router();
const { uploadToYouTube, updateVideoVisibility } = require('../utils/youtube');
const { updateVideoStatus } = require('../utils/firestore');

/**
 * Manual video upload endpoint
 */
router.post('/youtube', async (req, res) => {
  try {
    const { videoUrl, thumbnailUrl, metadata, videoType } = req.body;
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'Video URL required' });
    }
    
    console.log(`📤 Manual upload request: ${videoType} video`);
    
    const result = await uploadToYouTube({
      videoUrl,
      thumbnailUrl,
      metadata,
      videoType: videoType || 'long'
    });
    
    // Store in Firestore
    await updateVideoStatus(result.videoId, {
      type: videoType || 'long',
      title: metadata?.title,
      status: 'uploaded',
      visibility: 'unlisted',
      uploadDate: new Date().toISOString().split('T')[0],
      uploadedBy: 'manual'
    });
    
    res.json({
      success: true,
      videoId: result.videoId,
      url: result.url,
      visibility: 'unlisted'
    });
    
  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update video visibility endpoint
 */
router.post('/visibility', async (req, res) => {
  try {
    const { videoId, visibility } = req.body;
    
    if (!videoId || !visibility) {
      return res.status(400).json({ error: 'videoId and visibility required' });
    }
    
    console.log(`🔄 Manual visibility update: ${videoId} → ${visibility}`);
    
    const result = await updateVideoVisibility(videoId, visibility);
    
    if (result.success) {
      // Update Firestore
      await updateVideoStatus(videoId, {
        visibility,
        updatedAt: new Date().toISOString(),
        updatedBy: 'manual'
      });
      
      res.json({ success: true, videoId, visibility });
    } else {
      res.status(500).json({ error: result.error });
    }
    
  } catch (error) {
    console.error('❌ Visibility update error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
