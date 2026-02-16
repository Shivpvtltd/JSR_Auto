/**
 * Authentication Routes - Google OAuth for YouTube
 */
const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { saveUserTokens } = require('../utils/firestore');

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
    'https://www.googleapis.com/auth/youtube'
  ]
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('🔐 OAuth success, fetching YouTube channel ID...');

    // Fetch YouTube channel ID using accessToken
    const ytResponse = await axios.get(
      'https://youtube.googleapis.com/youtube/v3/channels',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        params: {
          part: 'id,snippet',
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

    console.log(`📺 YouTube Channel Found: ${channelName} (${channelId})`);

    // Save tokens to Firestore using channelId as document ID
    await saveUserTokens(channelId, {
      channelId: channelId,
      googleUserId: profile.id,
      accessToken: accessToken,
      refreshToken: refreshToken,
      name: channelName,
      email: profile.emails?.[0]?.value || null,
      picture: profile.photos?.[0]?.value || null,
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log('✅ Tokens saved to Firestore with channel ID');

    return done(null, {
      id: channelId,
      displayName: channelName,
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
 */
router.get('/youtube', passport.authenticate('google', {
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube'
  ],
  accessType: 'offline',
  prompt: 'consent'
}));

/**
 * YouTube OAuth callback
 */
router.get('/youtube/callback',
  passport.authenticate('google', { failureRedirect: '/auth/error' }),
  (req, res) => {
    console.log('✅ YouTube authentication successful');
    res.redirect('/auth/success');
  }
);

/**
 * Auth success page
 */
router.get('/success', (req, res) => {
  res.json({
    success: true,
    message: 'YouTube authentication successful',
    user: req.user?.displayName
  });
});

/**
 * Auth error page
 */
router.get('/error', (req, res) => {
  res.status(401).json({
    success: false,
    message: 'Authentication failed'
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
    user: req.user?.displayName || null
  });
});

module.exports = router;
