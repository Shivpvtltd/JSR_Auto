/**
 * Authentication Routes
 * Handles Google OAuth for YouTube API access
 */

const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const logger = require('../logger');
const router = express.Router();

// Configure Passport Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.YOUTUBE_CLIENT_ID,
  clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
  callbackURL: process.env.YOUTUBE_REDIRECT_URI || '/auth/youtube/callback',
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.readonly'
  ]
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Store tokens in Firestore or session
    const user = {
      id: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      picture: profile.photos[0]?.value,
      accessToken,
      refreshToken,
      connectedAt: new Date().toISOString()
    };
    
    // Save to Firestore
    const { saveYouTubeTokens } = require('../utils/firestore');
    await saveYouTubeTokens(user);
    
    return done(null, user);
  } catch (error) {
    logger.error('Google OAuth error:', error);
    return done(error, null);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { getYouTubeTokens } = require('../utils/firestore');
    const user = await getYouTubeTokens(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Initiate Google OAuth
router.get('/youtube', passport.authenticate('google', {
  accessType: 'offline',
  prompt: 'consent',
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.readonly'
  ]
}));

// Google OAuth callback
router.get('/youtube/callback',
  passport.authenticate('google', { failureRedirect: '/auth/failure' }),
  (req, res) => {
    // Generate JWT for API access
    const token = jwt.sign(
      { userId: req.user.id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    // Redirect to frontend with token
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/success?token=${token}`;
    res.redirect(redirectUrl);
  }
);

// Auth failure
router.get('/failure', (req, res) => {
  res.status(401).json({
    error: 'Authentication failed',
    message: 'Unable to authenticate with YouTube. Please try again.'
  });
});

// Auth success
router.get('/success', (req, res) => {
  res.json({
    success: true,
    message: 'YouTube account connected successfully',
    user: req.user
  });
});

// Check auth status
router.get('/status', async (req, res) => {
  try {
    const { getLatestYouTubeTokens } = require('../utils/firestore');
    const tokens = await getLatestYouTubeTokens();
    
    res.json({
      authenticated: !!tokens,
      connectedAt: tokens?.connectedAt,
      email: tokens?.email
    });
  } catch (error) {
    logger.error('Auth status check error:', error);
    res.status(500).json({ error: 'Failed to check auth status' });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    req.logout((err) => {
      if (err) {
        throw err;
      }
      req.session.destroy();
      res.json({ success: true, message: 'Logged out successfully' });
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

module.exports = router;
