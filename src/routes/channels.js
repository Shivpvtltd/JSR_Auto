/**
 * Channel Management Routes
 * - Add/connect YouTube channels
 * - List user's channels
 * - Update channel settings
 * - Remove channels
 */
const express = require('express');
const router = express.Router();
const { getFirestore } = require('../utils/firebase');
const { authenticateToken } = require('./user');

/**
 * Get all channels for logged-in user
 * GET /api/channels
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    
    // Get user's channels
    const userDoc = await db.collection('users').doc(req.user.email).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const channelIds = userData.channels || [];

    // Get channel details
    const channels = [];
    for (const channelId of channelIds) {
      const channelDoc = await db.collection('channels').doc(channelId).get();
      if (channelDoc.exists) {
        const channelData = channelDoc.data();
        channels.push({
          channelId,
          name: channelData.name,
          thumbnail: channelData.thumbnail,
          subscriberCount: channelData.subscriberCount,
          isActive: channelData.isActive,
          connectedAt: channelData.connectedAt,
          lastUpload: channelData.lastUpload,
          voiceFile: channelData.voiceFile,
          settings: channelData.settings
        });
      }
    }

    res.json({
      success: true,
      channels
    });

  } catch (error) {
    console.error('❌ Channels fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

/**
 * Get single channel details
 * GET /api/channels/:channelId
 */
router.get('/:channelId', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const db = getFirestore();

    // Verify user owns this channel
    const userDoc = await db.collection('users').doc(req.user.email).get();
    const userData = userDoc.data();
    
    if (!userData.channels || !userData.channels.includes(channelId)) {
      return res.status(403).json({ error: 'Channel not found or access denied' });
    }

    const channelDoc = await db.collection('channels').doc(channelId).get();
    if (!channelDoc.exists) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const channelData = channelDoc.data();

    res.json({
      success: true,
      channel: {
        channelId,
        name: channelData.name,
        thumbnail: channelData.thumbnail,
        subscriberCount: channelData.subscriberCount,
        isActive: channelData.isActive,
        connectedAt: channelData.connectedAt,
        lastUpload: channelData.lastUpload,
        voiceFile: channelData.voiceFile,
        settings: channelData.settings,
        uploadHistory: channelData.uploadHistory || []
      }
    });

  } catch (error) {
    console.error('❌ Channel fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch channel' });
  }
});

/**
 * Update channel settings
 * PUT /api/channels/:channelId/settings
 */
router.put('/:channelId/settings', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { settings } = req.body;
    const db = getFirestore();

    // Verify user owns this channel
    const userDoc = await db.collection('users').doc(req.user.email).get();
    const userData = userDoc.data();
    
    if (!userData.channels || !userData.channels.includes(channelId)) {
      return res.status(403).json({ error: 'Channel not found or access denied' });
    }

    await db.collection('channels').doc(channelId).update({
      settings: settings,
      updatedAt: new Date().toISOString()
    });

    console.log(`✅ Channel settings updated: ${channelId}`);

    res.json({
      success: true,
      message: 'Channel settings updated successfully'
    });

  } catch (error) {
    console.error('❌ Channel settings update error:', error);
    res.status(500).json({ error: 'Failed to update channel settings' });
  }
});

/**
 * Update channel voice file
 * PUT /api/channels/:channelId/voice
 */
router.put('/:channelId/voice', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { voiceFile } = req.body;
    const db = getFirestore();

    // Verify user owns this channel
    const userDoc = await db.collection('users').doc(req.user.email).get();
    const userData = userDoc.data();
    
    if (!userData.channels || !userData.channels.includes(channelId)) {
      return res.status(403).json({ error: 'Channel not found or access denied' });
    }

    await db.collection('channels').doc(channelId).update({
      voiceFile: voiceFile,
      updatedAt: new Date().toISOString()
    });

    console.log(`✅ Channel voice updated: ${channelId} -> ${voiceFile}`);

    res.json({
      success: true,
      message: 'Channel voice updated successfully'
    });

  } catch (error) {
    console.error('❌ Channel voice update error:', error);
    res.status(500).json({ error: 'Failed to update channel voice' });
  }
});

/**
 * Toggle channel active status
 * PUT /api/channels/:channelId/toggle
 */
router.put('/:channelId/toggle', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const db = getFirestore();

    // Verify user owns this channel
    const userDoc = await db.collection('users').doc(req.user.email).get();
    const userData = userDoc.data();
    
    if (!userData.channels || !userData.channels.includes(channelId)) {
      return res.status(403).json({ error: 'Channel not found or access denied' });
    }

    const channelDoc = await db.collection('channels').doc(channelId).get();
    const channelData = channelDoc.data();
    const newStatus = !channelData.isActive;

    await db.collection('channels').doc(channelId).update({
      isActive: newStatus,
      updatedAt: new Date().toISOString()
    });

    console.log(`✅ Channel status toggled: ${channelId} -> ${newStatus ? 'active' : 'inactive'}`);

    res.json({
      success: true,
      message: `Channel ${newStatus ? 'activated' : 'deactivated'} successfully`,
      isActive: newStatus
    });

  } catch (error) {
    console.error('❌ Channel toggle error:', error);
    res.status(500).json({ error: 'Failed to toggle channel' });
  }
});

/**
 * Remove channel from user account
 * DELETE /api/channels/:channelId
 */
router.delete('/:channelId', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const db = getFirestore();

    // Verify user owns this channel
    const userDoc = await db.collection('users').doc(req.user.email).get();
    const userData = userDoc.data();
    
    if (!userData.channels || !userData.channels.includes(channelId)) {
      return res.status(403).json({ error: 'Channel not found or access denied' });
    }

    // Remove channel from user's channels array
    const updatedChannels = userData.channels.filter(id => id !== channelId);
    await db.collection('users').doc(req.user.email).update({
      channels: updatedChannels,
      updatedAt: new Date().toISOString()
    });

    // Optionally delete channel document (or keep for history)
    // await db.collection('channels').doc(channelId).delete();

    console.log(`✅ Channel removed: ${channelId}`);

    res.json({
      success: true,
      message: 'Channel removed successfully'
    });

  } catch (error) {
    console.error('❌ Channel removal error:', error);
    res.status(500).json({ error: 'Failed to remove channel' });
  }
});

/**
 * Trigger video generation for a specific channel
 * POST /api/channels/:channelId/generate
 */
router.post('/:channelId/generate', authenticateToken, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { category, subCategory } = req.body;
    const db = getFirestore();

    // Verify user owns this channel
    const userDoc = await db.collection('users').doc(req.user.email).get();
    const userData = userDoc.data();
    
    if (!userData.channels || !userData.channels.includes(channelId)) {
      return res.status(403).json({ error: 'Channel not found or access denied' });
    }

    const channelDoc = await db.collection('channels').doc(channelId).get();
    const channelData = channelDoc.data();

    if (!channelData.isActive) {
      return res.status(400).json({ error: 'Channel is not active' });
    }

    // Trigger GitHub Actions workflow
    const { triggerGitHubWorkflow } = require('../utils/github');
    
    const runId = `manual_${Date.now()}`;
    const result = await triggerGitHubWorkflow({
      run_id: runId,
      main_category: category || userData.settings?.defaultCategory || 'Human Psychology & Behavior',
      sub_category: subCategory || userData.settings?.defaultSubCategory || 'Dark Psychology',
      episode: 1,  // Will be determined by backend
      channel_id: channelId,
      channel_index: userData.channels.indexOf(channelId)
    });

    console.log(`✅ Generation triggered for channel: ${channelId}`);

    res.json({
      success: true,
      message: 'Video generation triggered successfully',
      runId,
      result
    });

  } catch (error) {
    console.error('❌ Generation trigger error:', error);
    res.status(500).json({ error: 'Failed to trigger generation' });
  }
});

/**
 * Get all active channels (for scheduler)
 * GET /api/channels/all/active
 * Internal use only - no auth required
 */
router.get('/all/active', async (req, res) => {
  try {
    const db = getFirestore();
    
    // Get all active channels
    const channelsSnapshot = await db.collection('channels')
      .where('isActive', '==', true)
      .get();

    const channels = [];
    for (const doc of channelsSnapshot.docs) {
      const channelData = doc.data();
      channels.push({
        channelId: doc.id,
        name: channelData.name,
        ownerEmail: channelData.ownerEmail,
        voiceFile: channelData.voiceFile,
        settings: channelData.settings
      });
    }

    res.json({
      success: true,
      channels
    });

  } catch (error) {
    console.error('❌ Active channels fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch active channels' });
  }
});

module.exports = router;
