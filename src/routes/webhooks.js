/**
 * Webhook Routes - Receives notifications from GitHub Actions
 */
const express = require('express');
const router = express.Router();
const { updateWorkflowStatus, updateVideoStatus } = require('../utils/firestore');
const { uploadToYouTube } = require('../utils/youtube');
const axios = require('axios');
const fs = require('fs-extra');

/**
 * GitHub Actions webhook endpoint
 * Receives notifications from workflow jobs
 */
router.post('/github-actions', async (req, res) => {
  try {
    const { action, run_id, status, video_type, timestamp } = req.body;
    
    console.log(`📥 Webhook received: ${action} - ${status}`);
    
    // Update workflow status
    await updateWorkflowStatus({
      runId: run_id,
      action,
      status,
      videoType: video_type,
      receivedAt: new Date().toISOString()
    });
    
    // Handle specific actions
    switch (action) {
      case 'upload_ready':
        // Trigger video download and YouTube upload
        console.log('📹 Upload ready - starting YouTube upload process');
        // This would trigger the upload process
        break;
        
      case 'script_generated':
        console.log('✅ Script generated successfully');
        break;
        
      case 'audio_generated':
        console.log('✅ Audio generated successfully');
        break;
        
      case 'assets_downloaded':
        console.log('✅ Assets downloaded successfully');
        break;
        
      case 'thumbnail_generated':
        console.log('✅ Thumbnail generated successfully');
        break;
        
      case 'video_rendered':
        console.log(`✅ ${video_type} video rendered successfully`);
        break;
        
      default:
        console.log(`ℹ️ Unknown action: ${action}`);
    }
    
    res.json({ success: true, received: action });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Cloudinary upload complete webhook
 * Triggers YouTube upload when files are ready
 */
router.post('/cloudinary-ready', async (req, res) => {
  try {
    const { run_id, files } = req.body;
    
    console.log(`☁️ Cloudinary upload complete: ${run_id}`);
    
    // Download files from Cloudinary
    const videoUrl = files.long_video?.url || files.short_video?.url;
    const thumbnailUrl = files.thumbnail?.url;
    const scriptData = files.script;
    
    if (!videoUrl) {
      throw new Error('No video URL provided');
    }
    
    // Get script metadata
    let metadata = {};
    if (scriptData?.url) {
      try {
        const response = await axios.get(scriptData.url);
        const scriptJson = response.data;
        metadata = {
          title: scriptJson.metadata?.final_title || 'Untitled',
          description: scriptJson.metadata?.description || '',
          tags: scriptJson.metadata?.tags || [],
          categoryId: scriptJson.metadata?.categoryId || '27'
        };
      } catch (e) {
        console.warn('⚠️ Could not fetch script metadata');
      }
    }
    
    // Determine video type
    const videoType = files.long_video ? 'long' : 'short';
    
    // Upload to YouTube (UNLISTED)
    console.log(`📤 Uploading ${videoType} video to YouTube (UNLISTED)...`);
    
    const uploadResult = await uploadToYouTube({
      videoUrl,
      thumbnailUrl,
      metadata,
      videoType
    });
    
    // Store video info in Firestore
    await updateVideoStatus(uploadResult.videoId, {
      runId: run_id,
      type: videoType,
      title: metadata.title,
      status: 'uploaded',
      visibility: 'unlisted',
      uploadDate: new Date().toISOString().split('T')[0],
      cloudinaryUrls: {
        video: videoUrl,
        thumbnail: thumbnailUrl
      },
      youtubeUrl: uploadResult.url,
      scheduledFor: videoType === 'long' ? '17:00' : '17:30'
    });
    
    console.log(`✅ Video uploaded to YouTube (UNLISTED): ${uploadResult.videoId}`);
    
    res.json({
      success: true,
      videoId: uploadResult.videoId,
      visibility: 'unlisted',
      scheduledFor: videoType === 'long' ? '17:00 IST' : '17:30 IST'
    });
    
  } catch (error) {
    console.error('❌ Cloudinary webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manual trigger webhook (for testing)
 */
router.post('/manual-trigger', async (req, res) => {
  try {
    const { trigger } = req.body;
    
    const { mainTrigger } = require('../scheduler/mainTrigger');
    const { backupTrigger } = require('../scheduler/backupTrigger');
    const { publishLongVideos } = require('../scheduler/publishLong');
    const { publishShorts } = require('../scheduler/publishShorts');
    
    let result;
    
    switch (trigger) {
      case 'main':
        result = await mainTrigger();
        break;
      case 'backup':
        result = await backupTrigger();
        break;
      case 'publish-long':
        result = await publishLongVideos();
        break;
      case 'publish-shorts':
        result = await publishShorts();
        break;
      default:
        return res.status(400).json({ error: 'Unknown trigger' });
    }
    
    res.json({ success: true, result });
    
  } catch (error) {
    console.error('❌ Manual trigger error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
