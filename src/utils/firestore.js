/**
 * Firestore Database Operations
 */
const { getFirestore } = require('./firebase');

async function getCurrentEpisode() {
  /**
   * Get the next episode to generate
   */
  const db = getFirestore();
  
  try {
    // Get the latest episode
    const snapshot = await db.collection('episodes')
      .orderBy('episode', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      // No episodes yet - return default
      return {
        mainCategory: 'Human Psychology & Behavior',
        subCategory: 'Dark Psychology',
        episode: 1
      };
    }
    
    const latestEpisode = snapshot.docs[0].data();
    const nextEpisode = latestEpisode.episode + 1;
    
    // Check if we need to move to next sub-category
    const subCategories = await getSubCategories(latestEpisode.mainCategory);
    const currentSubIndex = subCategories.indexOf(latestEpisode.subCategory);
    
    let nextSubCategory = latestEpisode.subCategory;
    let nextMainCategory = latestEpisode.mainCategory;
    
    if (currentSubIndex >= subCategories.length - 1) {
      // Move to next main category
      const mainCategories = await getMainCategories();
      const currentMainIndex = mainCategories.indexOf(latestEpisode.mainCategory);
      
      if (currentMainIndex >= mainCategories.length - 1) {
        // Cycle back to first
        nextMainCategory = mainCategories[0];
      } else {
        nextMainCategory = mainCategories[currentMainIndex + 1];
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
      previousEpisode: latestEpisode.episode
    };
    
  } catch (error) {
    console.error('❌ Error getting current episode:', error);
    throw error;
  }
}

async function saveUserTokens(userId, data) {
  const db = getFirestore();

  try {
    const docRef = db.collection('userTokens').doc(userId);

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
    'Human Life Reality'
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

async function getVideosByDate(date, type = null) {
  /**
   * Get videos by upload date
   */
  const db = getFirestore();
  
  try {
    let query = db.collection('videos')
      .where('uploadDate', '==', date);
    
    if (type) {
      query = query.where('type', '==', type);
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

async function getLongVideoForShorts(date) {
  /**
   * Get today's long video for linking in shorts
   */
  const db = getFirestore();
  
  try {
    const snapshot = await db.collection('videos')
      .where('uploadDate', '==', date)
      .where('type', '==', 'long')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return {
      videoId: doc.id,
      ...doc.data()
    };
    
  } catch (error) {
    console.error('❌ Error getting long video:', error);
    return null;
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
  getLongVideoForShorts,
  saveUserTokens // 👈 ADD THIS
};
