/**
 * Status Routes
 * Provides system status and episode tracking
 */

const express = require('express');
const { logger } = require('../server');
const { 
  getEpisodeStatus, 
  getAllEpisodes, 
  getRecentEpisodes,
  getSystemStats 
} = require('../utils/firestore');

const router = express.Router();

// Get system status
router.get('/system', async (req, res) => {
  try {
    const stats = await getSystemStats();
    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      stats
    });
  } catch (error) {
    logger.error('System status error:', error);
    res.status(500).json({ error: 'Failed to get system status' });
  }
});

// Get all episodes
router.get('/episodes', async (req, res) => {
  try {
    const { limit = 20, status } = req.query;
    const episodes = await getAllEpisodes(parseInt(limit), status);
    res.json({
      count: episodes.length,
      episodes
    });
  } catch (error) {
    logger.error('Get episodes error:', error);
    res.status(500).json({ error: 'Failed to get episodes' });
  }
});

// Get recent episodes
router.get('/episodes/recent', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const episodes = await getRecentEpisodes(parseInt(days));
    res.json({
      count: episodes.length,
      episodes
    });
  } catch (error) {
    logger.error('Get recent episodes error:', error);
    res.status(500).json({ error: 'Failed to get recent episodes' });
  }
});

// Get specific episode status
router.get('/episodes/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    const episode = await getEpisodeStatus(runId);
    
    if (!episode) {
      return res.status(404).json({ error: 'Episode not found' });
    }
    
    res.json(episode);
  } catch (error) {
    logger.error('Get episode status error:', error);
    res.status(500).json({ error: 'Failed to get episode status' });
  }
});

// Get today's episode status
router.get('/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const episodes = await getRecentEpisodes(1);
    const todayEpisode = episodes.find(ep => {
      const epDate = new Date(ep.createdAt);
      return epDate >= today;
    });
    
    if (!todayEpisode) {
      return res.json({
        message: 'No episode found for today',
        status: 'not_started'
      });
    }
    
    res.json(todayEpisode);
  } catch (error) {
    logger.error('Get today episode error:', error);
    res.status(500).json({ error: 'Failed to get today episode' });
  }
});

// Get queue status
router.get('/queue', async (req, res) => {
  try {
    const episodes = await getAllEpisodes(50);
    
    const queue = {
      pending: episodes.filter(ep => ep.status === 'pending'),
      in_progress: episodes.filter(ep => 
        ep.status && !['completed', 'failed', 'pending'].includes(ep.status)
      ),
      completed: episodes.filter(ep => ep.status === 'completed'),
      failed: episodes.filter(ep => ep.status === 'failed')
    };
    
    res.json({
      total: episodes.length,
      queue: {
        pending: queue.pending.length,
        in_progress: queue.in_progress.length,
        completed: queue.completed.length,
        failed: queue.failed.length
      },
      recent: episodes.slice(0, 5)
    });
  } catch (error) {
    logger.error('Get queue status error:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

module.exports = router;
