/**
 * YouTube API Operations
 */

const { google } = require('googleapis');
const { logger } = require('../server');
const { getLatestYouTubeTokens } = require('./firestore');

// Initialize YouTube API client
const getYouTubeClient = async () => {
  const tokens = await getLatestYouTubeTokens();
  
  if (!tokens) {
    throw new Error('No YouTube tokens found. Please authenticate first.');
  }
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken
  });
  
  // Handle token refresh
  oauth2Client.on('tokens', async (newTokens) => {
    if (newTokens.refresh_token) {
      logger.info('YouTube tokens refreshed');
      // Save new tokens to Firestore
      const { saveYouTubeTokens } = require('./firestore');
      await saveYouTubeTokens({
        ...tokens,
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || tokens.refreshToken
      });
    }
  });
  
  return google.youtube({ version: 'v3', auth: oauth2Client });
};

// Upload video to YouTube
const uploadToYouTube = async (videoData) => {
  const youtube = await getYouTubeClient();
  
  const {
    videoBuffer,
    title,
    description,
    tags = [],
    categoryId = '27', // Education
    privacyStatus = 'unlisted',
    publishAt = null // For scheduled publishing
  } = videoData;
  
  const requestBody = {
    snippet: {
      title: title.substring(0, 100), // YouTube title limit
      description: description.substring(0, 5000), // YouTube description limit
      tags: tags.slice(0, 500), // YouTube tag limit
      categoryId
    },
    status: {
      privacyStatus,
      ...(publishAt && { publishAt: new Date(publishAt).toISOString() }),
      selfDeclaredMadeForKids: false
    }
  };
  
  const response = await youtube.videos.insert({
    part: 'snippet,status',
    requestBody,
    media: {
      body: Buffer.from(videoBuffer, 'base64')
    }
  });
  
  logger.info(`Video uploaded: ${response.data.id}`);
  
  return {
    videoId: response.data.id,
    title: response.data.snippet.title,
    status: response.data.status.privacyStatus
  };
};

// Update video visibility
const updateVideoVisibility = async (videoId, privacyStatus) => {
  const youtube = await getYouTubeClient();
  
  const response = await youtube.videos.update({
    part: 'status',
    requestBody: {
      id: videoId,
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false
      }
    }
  });
  
  logger.info(`Video visibility updated: ${videoId} -> ${privacyStatus}`);
  
  return {
    videoId: response.data.id,
    status: response.data.status.privacyStatus
  };
};

// Update video description
const updateVideoDescription = async (videoId, additionalDescription) => {
  const youtube = await getYouTubeClient();
  
  // First get current video details
  const videoResponse = await youtube.videos.list({
    part: 'snippet',
    id: videoId
  });
  
  if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
    throw new Error('Video not found');
  }
  
  const currentSnippet = videoResponse.data.items[0].snippet;
  
  // Update description
  const response = await youtube.videos.update({
    part: 'snippet',
    requestBody: {
      id: videoId,
      snippet: {
        ...currentSnippet,
        description: currentSnippet.description + additionalDescription
      }
    }
  });
  
  logger.info(`Video description updated: ${videoId}`);
  
  return {
    videoId: response.data.id,
    description: response.data.snippet.description
  };
};

// Upload thumbnail
const uploadThumbnail = async (videoId, thumbnailBuffer) => {
  const youtube = await getYouTubeClient();
  
  await youtube.thumbnails.set({
    videoId,
    media: {
      body: Buffer.from(thumbnailBuffer, 'base64')
    }
  });
  
  logger.info(`Thumbnail uploaded: ${videoId}`);
  
  return { videoId, thumbnailSet: true };
};

// Get video status
const getVideoStatus = async (videoId) => {
  const youtube = await getYouTubeClient();
  
  const response = await youtube.videos.list({
    part: 'snippet,status,statistics',
    id: videoId
  });
  
  if (!response.data.items || response.data.items.length === 0) {
    return null;
  }
  
  const video = response.data.items[0];
  
  return {
    videoId: video.id,
    title: video.snippet.title,
    description: video.snippet.description,
    privacyStatus: video.status.privacyStatus,
    publishAt: video.status.publishAt,
    viewCount: video.statistics?.viewCount || 0,
    likeCount: video.statistics?.likeCount || 0,
    commentCount: video.statistics?.commentCount || 0
  };
};

// Add video to playlist
const addVideoToPlaylist = async (videoId, playlistId) => {
  const youtube = await getYouTubeClient();
  
  const response = await youtube.playlistItems.insert({
    part: 'snippet',
    requestBody: {
      snippet: {
        playlistId,
        resourceId: {
          kind: 'youtube#video',
          videoId
        }
      }
    }
  });
  
  logger.info(`Video added to playlist: ${videoId} -> ${playlistId}`);
  
  return {
    playlistItemId: response.data.id,
    videoId,
    playlistId
  };
};

// Link shorts to long video (update description)
const linkToLongVideo = async (shortsId, longVideoId) => {
  const longVideoUrl = `https://youtube.com/watch?v=${longVideoId}`;
  const ctaText = `\n\n📺 Full Video: ${longVideoUrl}\n#Shorts #YouTubeShorts`;
  
  return updateVideoDescription(shortsId, ctaText);
};

// Search videos
const searchVideos = async (query, maxResults = 10) => {
  const youtube = await getYouTubeClient();
  
  const response = await youtube.search.list({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults
  });
  
  return response.data.items.map(item => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: item.snippet.thumbnails.medium?.url,
    publishedAt: item.snippet.publishedAt
  }));
};

module.exports = {
  getYouTubeClient,
  uploadToYouTube,
  updateVideoVisibility,
  updateVideoDescription,
  uploadThumbnail,
  getVideoStatus,
  addVideoToPlaylist,
  linkToLongVideo,
  searchVideos
};
