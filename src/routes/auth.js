/**
 * Authentication Routes - Google OAuth for YouTube with Multi-Channel Support
 */
const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { getFirestore } = require('../utils/firestore');

// Store pending OAuth states (in production, use Redis)
const pendingOAuthStates = new Map();

// Configure Google OAuth Strategy
const axios = require('axios');

passport.use(new GoogleStrategy({
  clientID: process.env.YOUTUBE_CLIENT_ID,
  clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
  callbackURL: `${process.env.BASE_URL}/auth/youtube/callback`,
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.readonly'
  ],
  passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    console.log('🔐 OAuth success, fetching YouTube channel details...');

    // Get user email from session (set during OAuth initiation)
    const userEmail = req.session?.pendingUserEmail;
    
    if (!userEmail) {
      console.error('❌ No user email found in session');
      return done(new Error('User session expired. Please try again.'), null);
    }

    // Fetch YouTube channel details using accessToken
    const ytResponse = await axios.get(
      'https://youtube.googleapis.com/youtube/v3/channels',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          part: 'id,snippet,statistics',
          mine: true
        }
      }
    );

    if (!ytResponse.data.items || ytResponse.data.items.length === 0) {
      throw new Error('No YouTube channel found for this account');
    }

    const channel = ytResponse.data.items[0];
    const channelId = channel.id;
    const channelName = channel.snippet.title;
    const channelThumbnail = channel.snippet.thumbnails?.default?.url;
    const subscriberCount = channel.statistics?.subscriberCount || '0';

    console.log(`📺 YouTube Channel Found: ${channelName} (${channelId})`);
    console.log(`👤 Owner: ${userEmail}`);

    const db = getFirestore();

    // Save/update channel tokens
    await db.collection('userTokens').doc(channelId).set({
      channelId: channelId,
      ownerEmail: userEmail,
      googleUserId: profile.id,
      accessToken: accessToken,
      refreshToken: refreshToken,
      name: channelName,
      thumbnail: channelThumbnail,
      subscriberCount: subscriberCount,
      email: profile.emails?.[0]?.value || null,
      picture: profile.photos?.[0]?.value || null,
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    }, { merge: true });

    // Save/update channels collection
    await db.collection('channels').doc(channelId).set({
      channelId: channelId,
      ownerEmail: userEmail,
      name: channelName,
      thumbnail: channelThumbnail,
      subscriberCount: subscriberCount,
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      voiceFile: null,  // Will be set later
      settings: {
        defaultCategory: 'Human Psychology & Behavior',
        defaultSubCategory: 'Dark Psychology',
        autoPublish: true,
        preferredTime: '17:30'
      },
      uploadHistory: []
    }, { merge: true });

    // Add channel to user's channels array
    const userDoc = await db.collection('users').doc(userEmail).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const userChannels = userData.channels || [];
      
      if (!userChannels.includes(channelId)) {
        userChannels.push(channelId);
        await db.collection('users').doc(userEmail).update({
          channels: userChannels,
          updatedAt: new Date().toISOString()
        });
        console.log(`✅ Channel added to user: ${userEmail}`);
      }
    }

    console.log('✅ Channel connected successfully');

    // Clear pending state
    delete req.session.pendingUserEmail;

    return done(null, {
      channelId: channelId,
      displayName: channelName,
      ownerEmail: userEmail,
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('❌ OAuth error:', error.message);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

/**
 * Initiate YouTube OAuth
 * POST /auth/youtube/initiate
 * Body: { email: userEmail }
 */
router.post('/youtube/initiate', (req, res, next) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'User email is required' });
  }

  // Store user email in session for callback
  req.session.pendingUserEmail = email;
  
  console.log(`🔄 Initiating OAuth for user: ${email}`);

  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.readonly'
    ],
    accessType: 'offline',
    prompt: 'consent'
  })(req, res, next);
});

/**
 * YouTube OAuth callback
 */
router.get('/youtube/callback',
  passport.authenticate('google', { failureRedirect: '/auth/error' }),
  (req, res) => {
    console.log('✅ YouTube authentication successful');
    
    // Redirect to frontend success page with channel info
    const channelId = req.user?.channelId;
    const channelName = req.user?.displayName;
    
    res.redirect(`/auth/success?channel=${channelId}&name=${encodeURIComponent(channelName)}`);
  }
);

/**
 * Auth success page
 */
router.get('/success', (req, res) => {
  const channelId = req.query.channel;
  const channelName = req.query.name;
  
  res.json({
    success: true,
    message: 'YouTube channel connected successfully',
    channel: {
      id: channelId,
      name: channelName
    }
  });
});

/**
 * Auth error page
 */
router.get('/error', (req, res) => {
  res.status(401).json({
    success: false,
    message: 'Authentication failed. Please try again.'
  });
});

/**
 * Logout
 */
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, message: 'Logged out' });
  });
});

/**
 * Check auth status
 */
router.get('/status', (req, res) => {
  res.json({
    authenticated: req.isAuthenticated(),
    user: req.user?.displayName || null,
    channel: req.user?.channelId || null
  });
});

module.exports = router;
