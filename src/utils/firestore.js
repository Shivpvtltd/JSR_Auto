/**
 * Firestore Database Operations
 */

const { getFirestore } = require('./firebase');
const { logger } = require('../server');

const DB_NAMES = {
  EPISODES: 'episodes',
  TOKENS: 'youtube_tokens',
  ASSETS: 'used_assets',
  STATS: 'system_stats',
  SCHEDULED_PUBLISHES: 'scheduled_publishes'
};

// Episode Operations
const createEpisode = async (runId, data) => {
  const db = getFirestore();
  const episodeRef = db.collection(DB_NAMES.EPISODES).doc(runId);
  
  const episodeData = {
    runId,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...data
  };
  
  await episodeRef.set(episodeData);
  logger.info(`Episode created: ${runId}`);
  return episodeData;
};

const updateEpisodeStatus = async (runId, updates) => {
  const db = getFirestore();
  const episodeRef = db.collection(DB_NAMES.EPISODES).doc(runId);
  
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  await episodeRef.update(updateData);
  logger.info(`Episode ${runId} updated:`, updates.status || 'data update');
  return updateData;
};

const getEpisodeStatus = async (runId) => {
  const db = getFirestore();
  const episodeDoc = await db.collection(DB_NAMES.EPISODES).doc(runId).get();
  
  if (!episodeDoc.exists) {
    return null;
  }
  
  return episodeDoc.data();
};

const getEpisodeByRunId = async (runId) => {
  return getEpisodeStatus(runId);
};

const getAllEpisodes = async (limit = 20, status = null) => {
  const db = getFirestore();
  let query = db.collection(DB_NAMES.EPISODES)
    .orderBy('createdAt', 'desc')
    .limit(limit);
  
  if (status) {
    query = query.where('status', '==', status);
  }
  
  const snapshot = await query.get();
  return snapshot.docs.map(doc => doc.data());
};

const getRecentEpisodes = async (days = 7) => {
  const db = getFirestore();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const snapshot = await db.collection(DB_NAMES.EPISODES)
    .where('createdAt', '>=', cutoffDate.toISOString())
    .orderBy('createdAt', 'desc')
    .get();
  
  return snapshot.docs.map(doc => doc.data());
};

// YouTube Tokens
const saveYouTubeTokens = async (userData) => {
  const db = getFirestore();
  const tokenRef = db.collection(DB_NAMES.TOKENS).doc(userData.id);
  
  await tokenRef.set({
    ...userData,
    updatedAt: new Date().toISOString()
  });
  
  logger.info(`YouTube tokens saved for user: ${userData.email}`);
};

const getYouTubeTokens = async (userId) => {
  const db = getFirestore();
  const tokenDoc = await db.collection(DB_NAMES.TOKENS).doc(userId).get();
  
  if (!tokenDoc.exists) {
    return null;
  }
  
  return tokenDoc.data();
};

const getLatestYouTubeTokens = async () => {
  const db = getFirestore();
  const snapshot = await db.collection(DB_NAMES.TOKENS)
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    return null;
  }
  
  return snapshot.docs[0].data();
};

// Video IDs
const saveVideoIds = async (runId, videoData) => {
  const db = getFirestore();
  const episodeRef = db.collection(DB_NAMES.EPISODES).doc(runId);
  
  await episodeRef.update({
    ...videoData,
    updatedAt: new Date().toISOString()
  });
  
  logger.info(`Video IDs saved for episode: ${runId}`);
};

// Asset tracking (for duplicate prevention)
const checkAssetUsed = async (md5Hash) => {
  const db = getFirestore();
  const assetDoc = await db.collection(DB_NAMES.ASSETS).doc(md5Hash).get();
  
  if (!assetDoc.exists) {
    return { used: false, count: 0 };
  }
  
  const data = assetDoc.data();
  return { used: true, count: data.useCount || 0 };
};

const markAssetUsed = async (md5Hash, metadata) => {
  const db = getFirestore();
  const assetRef = db.collection(DB_NAMES.ASSETS).doc(md5Hash);
  
  const assetDoc = await assetRef.get();
  
  if (assetDoc.exists) {
    const data = assetDoc.data();
    await assetRef.update({
      useCount: (data.useCount || 0) + 1,
      lastUsed: new Date().toISOString(),
      lastUsedBy: metadata.runId,
      history: [...(data.history || []), metadata]
    });
  } else {
    await assetRef.set({
      md5Hash,
      useCount: 1,
      firstUsed: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
      lastUsedBy: metadata.runId,
      history: [metadata]
    });
  }
  
  logger.info(`Asset marked as used: ${md5Hash}`);
};

// System Stats
const getSystemStats = async () => {
  const db = getFirestore();
  
  const [episodesSnapshot, tokensSnapshot] = await Promise.all([
    db.collection(DB_NAMES.EPISODES).get(),
    db.collection(DB_NAMES.TOKENS).get()
  ]);
  
  const episodes = episodesSnapshot.docs.map(doc => doc.data());
  
  return {
    totalEpisodes: episodes.length,
    completedEpisodes: episodes.filter(e => e.status === 'completed').length,
    failedEpisodes: episodes.filter(e => e.status === 'failed').length,
    inProgressEpisodes: episodes.filter(e => 
      e.status && !['completed', 'failed', 'pending'].includes(e.status)
    ).length,
    connectedAccounts: tokensSnapshot.size,
    lastUpdated: new Date().toISOString()
  };
};

const updateSystemStats = async (stats) => {
  const db = getFirestore();
  const statsRef = db.collection(DB_NAMES.STATS).doc('current');
  
  await statsRef.set({
    ...stats,
    updatedAt: new Date().toISOString()
  });
};

// Scheduled Publishes
const addScheduledPublish = async (videoId, type, runId, longVideoId, scheduledTime) => {
  const db = getFirestore();
  const scheduleRef = db.collection(DB_NAMES.SCHEDULED_PUBLISHES).doc(videoId);
  
  await scheduleRef.set({
    videoId,
    type,
    runId,
    longVideoId,
    scheduledTime: scheduledTime.toISOString(),
    status: 'scheduled',
    createdAt: new Date().toISOString()
  });
  
  logger.info(`Scheduled publish added: ${videoId} at ${scheduledTime}`);
};

const getScheduledPublishes = async () => {
  const db = getFirestore();
  const snapshot = await db.collection(DB_NAMES.SCHEDULED_PUBLISHES)
    .where('status', '==', 'scheduled')
    .get();
  
  return snapshot.docs.map(doc => doc.data());
};

const markPublishCompleted = async (videoId) => {
  const db = getFirestore();
  const scheduleRef = db.collection(DB_NAMES.SCHEDULED_PUBLISHES).doc(videoId);
  
  await scheduleRef.update({
    status: 'completed',
    completedAt: new Date().toISOString()
  });
};

module.exports = {
  DB_NAMES,
  createEpisode,
  updateEpisodeStatus,
  getEpisodeStatus,
  getEpisodeByRunId,
  getAllEpisodes,
  getRecentEpisodes,
  saveYouTubeTokens,
  getYouTubeTokens,
  getLatestYouTubeTokens,
  saveVideoIds,
  checkAssetUsed,
  markAssetUsed,
  getSystemStats,
  updateSystemStats,
  addScheduledPublish,
  getScheduledPublishes,
  markPublishCompleted
};
