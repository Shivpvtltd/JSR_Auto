/**
 * YouTube API Integration
 * Handles video upload, visibility management, and description updates
 */
const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs-extra');
const { getUserTokens, saveUserTokens } = require('./firestore');

const oauth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  `${process.env.BASE_URL}/auth/youtube/callback`
);

const youtube = google.youtube({
  version: 'v3',
  auth: oauth2Client
});

/**
 * Refresh YouTube access token
 */
async function refreshYouTubeToken(userId = 'default') {
  try {
    const tokens = await getUserTokens(userId);
    
    if (!tokens || !tokens.refreshToken) {
      throw new Error('No refresh token found');
    }
    
    oauth2Client.setCredentials({
      refresh_token: tokens.refreshToken
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Save new tokens
    await saveUserTokens(userId, {
      accessToken: credentials.access_token,
      expiryDate: credentials.expiry_date,
      updatedAt: new Date().toISOString()
    });
    
    return {
      accessToken: credentials.access_token,
      expiresIn: credentials.expiry_date
    };
    
  } catch (error) {
    console.error('❌ Error refreshing token:', error);
    throw error;
  }
}

/**
 * Upload video to YouTube (UNLISTED by default)
 */
async function uploadToYouTube({
  videoUrl,
  videoPath,
  thumbnailUrl,
  metadata,
  videoType = 'long'
}) {
  try {
    // Refresh token before upload
    await refreshYouTubeToken();
    
    const videoFilePath = videoPath || await downloadVideo(videoUrl);
    
    const requestBody = {
      snippet: {
        title: metadata.title,
        description: buildDescription(metadata, videoType),
        tags: metadata.tags || [],
        categoryId: metadata.categoryId || '27', // Education
        defaultLanguage: 'hi',
        defaultAudioLanguage: 'hi'
      },
      status: {
        privacyStatus: 'unlisted', // Upload as UNLISTED
        selfDeclaredMadeForKids: false,
        publishAt: null // Will be published manually by scheduler
      }
    };
    
    // Add shorts hashtag for short videos
    if (videoType === 'short') {
      requestBody.snippet.tags.push('Shorts', 'YTShorts', 'YouTubeShorts');
    }
    
    console.log('📤 Uploading video to YouTube (UNLISTED):', metadata.title);
    
    const response = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody,
      media: {
        body: fs.createReadStream(videoFilePath)
      }
    });
    
    const videoId = response.data.id;
    
    console.log('✅ Video uploaded (UNLISTED):', videoId);
    
    // Upload thumbnail if provided
    if (thumbnailUrl) {
      await uploadThumbnail(videoId, thumbnailUrl);
    }
    
    // Cleanup downloaded file
    if (videoUrl && videoFilePath.startsWith('/tmp')) {
      await fs.remove(videoFilePath).catch(() => {});
    }
    
    return {
      videoId,
      url: `https://youtube.com/watch?v=${videoId}`,
      visibility: 'unlisted'
    };
    
  } catch (error) {
    console.error('❌ YouTube upload error:', error);
    throw error;
  }
}

/**
 * Update video visibility (for scheduler)
 */
async function updateVideoVisibility(videoId, visibility) {
  try {
    await refreshYouTubeToken();
    
    console.log(`🔄 Updating visibility: ${videoId} → ${visibility}`);
    
    const response = await youtube.videos.update({
      part: 'status',
      requestBody: {
        id: videoId,
        status: {
          privacyStatus: visibility,
          selfDeclaredMadeForKids: false
        }
      }
    });
    
    console.log(`✅ Visibility updated: ${videoId} → ${visibility}`);
    
    return {
      success: true,
      videoId,
      visibility: response.data.status.privacyStatus
    };
    
  } catch (error) {
    console.error('❌ Error updating visibility:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update video description (for adding long video links to shorts)
 */
async function updateVideoDescription(videoId, description) {
  try {
    await refreshYouTubeToken();
    
    console.log(`📝 Updating description: ${videoId}`);
    
    // First get current video data
    const videoResponse = await youtube.videos.list({
      part: 'snippet',
      id: videoId
    });
    
    if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
      throw new Error('Video not found');
    }
    
    const video = videoResponse.data.items[0];
    
    // Update description
    const response = await youtube.videos.update({
      part: 'snippet',
      requestBody: {
        id: videoId,
        snippet: {
          ...video.snippet,
          description: description
        }
      }
    });
    
    console.log(`✅ Description updated: ${videoId}`);
    
    return {
      success: true,
      videoId
    };
    
  } catch (error) {
    console.error('❌ Error updating description:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload thumbnail to video
 */
async function uploadThumbnail(videoId, thumbnailUrl) {
  try {
    const thumbnailPath = await downloadThumbnail(thumbnailUrl);
    
    await youtube.thumbnails.set({
      videoId,
      media: {
        body: fs.createReadStream(thumbnailPath)
      }
    });
    
    console.log('✅ Thumbnail uploaded for:', videoId);
    
    // Cleanup
    await fs.remove(thumbnailPath).catch(() => {});
    
  } catch (error) {
    console.error('❌ Thumbnail upload error:', error);
    // Don't throw - video is already uploaded
  }
}

/**
 * Build video description
 */
function buildDescription(metadata, videoType) {
  let description = metadata.description || '';
  
  // Add timestamps if available
  if (metadata.timestamps && metadata.timestamps.length > 0) {
    description += '\n\n📌 Timestamps:\n';
    metadata.timestamps.forEach(t => {
      description += `${t.time} - ${t.label}\n`;
    });
  }
  
  // Add hashtags
  description += '\n\n#HindiContent #Educational #Psychology #History #Politics #Business';
  
  if (videoType === 'short') {
    description += '\n\n#Shorts #YTShorts';
  }
  
  // Add channel info
  description += '\n\n---\n🎯 हर रोज़ शाम 5 बजे नया वीडियो!\n📢 Subscribe करें और बेल आइकन दबाएं!';
  
  return description;
}

/**
 * Download video from URL
 */
async function downloadVideo(url) {
  const response = await axios({
    method: 'GET',
    url,
    responseType: 'stream'
  });
  
  const tempPath = `/tmp/video_${Date.now()}.mp4`;
  const writer = fs.createWriteStream(tempPath);
  
  response.data.pipe(writer);
  
  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(tempPath));
    writer.on('error', reject);
  });
}

/**
 * Download thumbnail from URL
 */
async function downloadThumbnail(url) {
  const response = await axios({
    method: 'GET',
    url,
    responseType: 'stream'
  });
  
  const tempPath = `/tmp/thumb_${Date.now()}.jpg`;
  const writer = fs.createWriteStream(tempPath);
  
  response.data.pipe(writer);
  
  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(tempPath));
    writer.on('error', reject);
  });
}

/**
 * Get YouTube analytics
 */
async function getYouTubeAnalytics() {
  try {
    await refreshYouTubeToken();
    
    // Get channel statistics
    const channelResponse = await youtube.channels.list({
      part: 'statistics,snippet',
      mine: true
    });
    
    const channel = channelResponse.data.items[0];
    
    // Get recent videos
    const videosResponse = await youtube.search.list({
      part: 'snippet',
      channelId: channel.id,
      order: 'date',
      maxResults: 10,
      type: 'video'
    });
    
    return {
      channel: {
        title: channel.snippet.title,
        subscribers: channel.statistics.subscriberCount,
        totalViews: channel.statistics.viewCount,
        totalVideos: channel.statistics.videoCount
      },
      recentVideos: videosResponse.data.items.map(v => ({
        id: v.id.videoId,
        title: v.snippet.title,
        publishedAt: v.snippet.publishedAt
      }))
    };
    
  } catch (error) {
    console.error('❌ Analytics error:', error);
    throw error;
  }
}

module.exports = {
  refreshYouTubeToken,
  uploadToYouTube,
  updateVideoVisibility,
  updateVideoDescription,
  uploadThumbnail,
  getYouTubeAnalytics,
  oauth2Client
};
