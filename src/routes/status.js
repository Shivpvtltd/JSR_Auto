/**
 * Status Routes - System status and monitoring
 */
const express = require('express');
const router = express.Router();
const { checkSystemHealth } = require('../utils/health');
const { getActionsUsage } = require('../utils/github');
const { getFirestore } = require('../utils/firebase');

/**
 * Get system status
 */
router.get('/', async (req, res) => {
  try {
    const health = await checkSystemHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get GitHub Actions usage
 */
router.get('/github-usage', async (req, res) => {
  try {
    const usage = await getActionsUsage();
    res.json(usage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get recent videos
 */
router.get('/videos', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db.collection('videos')
      .orderBy('uploadDate', 'desc')
      .limit(10)
      .get();
    
    const videos = snapshot.docs.map(doc => ({
      videoId: doc.id,
      ...doc.data()
    }));
    
    res.json({ videos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get workflow history
 */
router.get('/workflows', async (req, res) => {
  try {
    const db = getFirestore();
    const snapshot = await db.collection('workflows')
      .orderBy('triggeredAt', 'desc')
      .limit(10)
      .get();
    
    const workflows = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ workflows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get scheduler status
 */
router.get('/schedulers', (req, res) => {
  res.json({
    schedulers: [
      {
        name: 'Main Generation',
        schedule: '12:05 AM IST',
        cron: '5 0 * * *',
        timezone: 'Asia/Kolkata',
        status: 'active'
      },
      {
        name: 'Backup Check',
        schedule: '4:00 AM IST',
        cron: '0 4 * * *',
        timezone: 'Asia/Kolkata',
        status: 'active'
      },
      {
        name: 'Publish Long Videos',
        schedule: '5:00 PM IST',
        cron: '0 17 * * *',
        timezone: 'Asia/Kolkata',
        status: 'active'
      },
      {
        name: 'Publish Shorts',
        schedule: '5:30 PM IST',
        cron: '30 17 * * *',
        timezone: 'Asia/Kolkata',
        status: 'active'
      }
    ]
  });
});

module.exports = router;
