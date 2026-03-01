/**
 * Firestore Database Operations
 * Updated for Multi-Channel Support
 */
const { getFirestore } = require('./firebase');

async function getCurrentEpisode(channelId) {
  /**
   * Get the next episode to generate for a specific channel
   */
  const db = getFirestore();
  
  try {
    // Get the latest episode for this channel
    const snapshot = await db.collection('episodes')
      .where('channelId', '==', channelId)
      .orderBy('episode', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      // No episodes yet for this channel - return default
      return {
        mainCategory: 'Human Psychology & Behavior',
        subCategory: 'Dark Psychology',
        episode: 1,
        channelId
      };
    }
    
    const latestEpisode = snapshot.docs[0].data();
    const nextEpisode = latestEpisode.episode + 1;
    
    // Get categories for rotation
    const categories = await getMainCategories();
    const subCategories = await getSubCategories(latestEpisode.mainCategory);
    
    const currentSubIndex = subCategories.indexOf(latestEpisode.subCategory);
    
    let nextSubCategory = latestEpisode.subCategory;
    let nextMainCategory = latestEpisode.mainCategory;
    
    if (currentSubIndex >= subCategories.length - 1) {
      // Move to next main category
      const currentMainIndex = categories.indexOf(latestEpisode.mainCategory);
      
      if (currentMainIndex >= categories.length - 1) {
        // Cycle back to first
        nextMainCategory = categories[0];
      } else {
        nextMainCategory = categories[currentMainIndex + 1];
      }
      
      const newSubCategories = await getSubCategories(nextMainCategory);
      nextSubCategory = newSubCategories[0];
    } else {
      nextSubCategory = subCategories[currentSubIndex + 1];
    }
    
    return {
      mainCategory: nextMainCategory,
      subCategory: nextSubCategory,
      episode: nextEpisode,
      channelId,
      previousEpisode: latestEpisode.episode
    };
    
  } catch (error) {
    console.error('❌ Error getting current episode:', error);
    throw error;
  }
}

async function saveUserTokens(channelId, data) {
  const db = getFirestore();

  try {
    const docRef = db.collection('userTokens').doc(channelId);

    await docRef.set({
      ...data,
      savedAt: new Date().toISOString()
    }, { merge: true });

    console.log('✅ User tokens saved');
    return true;

  } catch (error) {
    console.error('❌ Error saving user tokens:', error);
    throw error;
  }
}

async function getUserChannels(userEmail) {
  /**
   * Get all channels for a user
   */
  const db = getFirestore();
  
  try {
    const userDoc = await db.collection('users').doc(userEmail).get();
    if (!userDoc.exists) {
      return [];
    }
    
    const userData = userDoc.data();
    const channelIds = userData.channels || [];
    
    const channels = [];
    for (const channelId of channelIds) {
      const channelDoc = await db.collection('channels').doc(channelId).get();
      if (channelDoc.exists) {
        channels.push({
          channelId,
          ...channelDoc.data()
        });
      }
    }
    
    return channels;
  } catch (error) {
    console.error('❌ Error getting user channels:', error);
    return [];
  }
}

async function getActiveChannels() {
  /**
   * Get all active channels across all users
   */
  const db = getFirestore();
  
  try {
    const snapshot = await db.collection('channels')
      .where('isActive', '==', true)
      .get();
    
    return snapshot.docs.map(doc => ({
      channelId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('❌ Error getting active channels:', error);
    return [];
  }
}

async function getChannelVoiceFile(channelId, channelIndex = 0) {
  /**
   * Get voice file for a channel
   * Returns voice file path or randomly selects from available voices
   */
  const db = getFirestore();
  
  try {
    const channelDoc = await db.collection('channels').doc(channelId).get();
    if (channelDoc.exists) {
      const channelData = channelDoc.data();
      if (channelData.voiceFile) {
        return channelData.voiceFile;
      }
    }
    
    // Default voice selection based on channel index
    // In production, this would scan the voices directory
    const defaultVoices = [
      'voices/voice1.wav',
      'voices/voice2.wav',
      'voices/voice3.wav',
      'voices/voice4.wav',
      'voices/voice5.wav'
    ];
    
    // Try to get voice based on channel index
    if (channelIndex < defaultVoices.length) {
      return defaultVoices[channelIndex];
    }
    
    // Random fallback
    return defaultVoices[Math.floor(Math.random() * defaultVoices.length)];
    
  } catch (error) {
    console.error('❌ Error getting channel voice file:', error);
    return 'voices/my_voice.wav';
  }
}

async function getMainCategories() {
  /**
   * Get list of main categories
   */
  return [
    'Human Psychology & Behavior',
    'Hidden Historical Truths',
    'Politics Decoded',
    'Business Fundamentals',
    'Education System Exposed',
    'Society Reality',
    'Communication Mastery',
    'Human Life Reality',
    'Mythology',
    'Health & Wellness',
    'Personal Finance',
    'Technology & Future'
  ];
}

async function getSubCategories(mainCategory) {
  /**
   * Get sub-categories for a main category
   */
  const subCategoriesMap = {
    'Human Psychology & Behavior': [
      'Dark Psychology',
      'Life Hacks Psychology',
      'Behavioral Psychology',
      'Body Language Secrets'
    ],
    'Hidden Historical Truths': [
      'Untold School History',
      'Historical Conspiracies',
      'Real Stories of Kings',
      'Unknown Freedom Struggle'
    ],
    'Politics Decoded': [
      'Vote Bank Psychology',
      'Real Intent Behind Schemes',
      'Leader Manipulation',
      'Election Strategies'
    ],
    'Business Fundamentals': [
      'Businessman Mindset',
      'Building Systems',
      'Money Works For You',
      'Startup Psychology'
    ],
    'Education System Exposed': [
      'Why Old Education Fails',
      'School vs Real Life',
      'Real Education for Success',
      'Daily Routine Mastery'
    ],
    'Society Reality': [
      'Cycle of Poverty',
      'Secrets of Rich Society',
      'Social Class Psychology',
      'Breaking the System'
    ],
    'Communication Mastery': [
      'Presentation Psychology',
      'Less Education More Impact',
      'Art of Speaking',
      'Impactful Writing'
    ],
    'Human Life Reality': [
      'Lies About Success',
      'Relations Marketplace',
      'Emotional Manipulation',
      'Real Way of Living'
    ],
    'Mythology': [
      'Mahabharat Hidden Secrets',
      'Ramayan Life Lessons',
      'Vedic Science Facts',
      'Temple Mysteries'
    ],
    'Health & Wellness': [
      'Ayurvedic Wisdom',
      'Mental Health Awareness',
      'Fitness Mindset',
      'Sleep Science'
    ],
    'Personal Finance': [
      'Saving Psychology',
      'Investment Basics',
      'Debt Trap Reality',
      'Path to Financial Freedom'
    ],
    'Technology & Future': [
      'AI Impact on Life',
      'Digital Privacy',
      'Social Media Psychology',
      'Future of Jobs'
    ]
  };
  
  return subCategoriesMap[mainCategory] || ['General'];
}

async function updateWorkflowStatus(data) {
  /**
   * Update workflow status in Firestore
   */
  const db = getFirestore();
  
  try {
    const docRef = db.collection('workflows').doc(data.runId || `workflow_${Date.now()}`);
    
    await docRef.set({
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log(`✅ Workflow status updated: ${data.status}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error updating workflow status:', error);
    throw error;
  }
}

async function getWorkflowStatus(date) {
  /**
   * Get workflow status for a specific date
   */
  const db = getFirestore();
  
  try {
    const snapshot = await db.collection('workflows')
      .where('triggeredAt', '>=', `${date}T00:00:00`)
      .where('triggeredAt', '<=', `${date}T23:59:59`)
      .orderBy('triggeredAt', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    return snapshot.docs[0].data();
    
  } catch (error) {
    console.error('❌ Error getting workflow status:', error);
    return null;
  }
}

async function updateVideoStatus(videoId, data) {
  /**
   * Update video status in Firestore
   */
  const db = getFirestore();
  
  try {
    const docRef = db.collection('videos').doc(videoId);
    
    await docRef.set({
      ...data,
      videoId,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    
    console.log(`✅ Video status updated: ${videoId} - ${data.status}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error updating video status:', error);
    throw error;
  }
}

async function getVideosByDate(date, channelId = null) {
  /**
   * Get videos by upload date
   */
  const db = getFirestore();
  
  try {
    let query = db.collection('videos')
      .where('uploadDate', '==', date);
    
    if (channelId) {
      query = query.where('channelId', '==', channelId);
    }
    
    const snapshot = await query.get();
    
    return snapshot.docs.map(doc => ({
      videoId: doc.id,
      ...doc.data()
    }));
    
  } catch (error) {
    console.error('❌ Error getting videos:', error);
    return [];
  }
}

async function saveEpisode(data) {
  /**
   * Save episode information
   */
  const db = getFirestore();
  
  try {
    const docRef = db.collection('episodes').doc(`${data.channelId}_${data.episode}`);
    
    await docRef.set({
      ...data,
      createdAt: new Date().toISOString()
    });
    
    console.log(`✅ Episode saved: ${data.channelId} - Episode ${data.episode}`);
    return true;
    
  } catch (error) {
    console.error('❌ Error saving episode:', error);
    throw error;
  }
}

module.exports = {
  getCurrentEpisode,
  getMainCategories,
  getSubCategories,
  updateWorkflowStatus,
  getWorkflowStatus,
  updateVideoStatus,
  getVideosByDate,
  saveUserTokens,
  getUserChannels,
  getActiveChannels,
  getChannelVoiceFile,
  saveEpisode
};
