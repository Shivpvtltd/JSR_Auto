/**
 * Authentication Routes - Google OAuth for YouTube with Multi-Channel Support
 * FIXED: Use OAuth state param to pass email instead of relying on session
 */
const express = require('express');
const router = express.Router();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { getFirestore } = require('../utils/firebase');
const axios = require('axios');

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.YOUTUBE_CLIENT_ID,
  clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
  callbackURL: `${process.env.BASE_URL || 'http://localhost:3000'}/auth/youtube/callback`,
  scope: [
    'profile',
    'email',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.readonly'
  ],
  passReqToCallback: true,
  state: false // We handle state manually to embed email
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    console.log('🔐 OAuth success, fetching YouTube channel details...');
    console.log('📊 Profile email:', profile.emails?.[0]?.value);

    let userEmail = null;

    // PRIMARY FIX: Extract email from state parameter (survives cross-domain redirect)
    try {
      const stateParam = req.query.state;
      if (stateParam) {
        const decoded = Buffer.from(stateParam, 'base64').toString('utf8');
        const stateObj = JSON.parse(decoded);
        if (stateObj.email) {
          userEmail = stateObj.email;
          console.log('📧 Got email from state param:', userEmail);
        }
      }
    } catch (stateErr) {
      console.log('⚠️ Could not parse state param:', stateErr.message);
    }

    // Fallback 1: session
    if (!userEmail && req.session?.pendingUserEmail) {
      userEmail = req.session.pendingUserEmail;
      console.log('📧 Got email from session:', userEmail);
    }

    // Fallback 2: Google profile email
    if (!userEmail && profile.emails && profile.emails.length > 0) {
      userEmail = profile.emails[0].value;
      console.log('📧 Using email from Google profile:', userEmail);
    }

    if (!userEmail) {
      console.error('❌ No user email found in state, session, or profile');
      return done(new Error('User email not found. Please try logging in again.'), null);
    }

    // Fetch YouTube channel details using accessToken
    let ytResponse;
    try {
      ytResponse = await axios.get(
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
    } catch (ytError) {
      console.error('❌ YouTube API Error:', ytError.response?.data || ytError.message);
      return done(new Error('Failed to fetch YouTube channel. Please check your permissions.'), null);
    }

    if (!ytResponse.data.items || ytResponse.data.items.length === 0) {
      return done(new Error('No YouTube channel found for this account'), null);
    }

    const channel = ytResponse.data.items[0];
    const channelId = channel.id;
    const channelName = channel.snippet.title;
    const channelThumbnail = channel.snippet.thumbnails?.default?.url;
    const subscriberCount = channel.statistics?.subscriberCount || '0';

    console.log(`📺 YouTube Channel Found: ${channelName} (${channelId})`);
    console.log(`👤 Owner: ${userEmail}`);

    const db = getFirestore();

    // Save/update channel tokens in userTokens collection
    try {
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
      
      console.log(`✅ Tokens saved for channel: ${channelId}`);
    } catch (dbError) {
      console.error('❌ Error saving tokens to userTokens:', dbError.message);
      return done(new Error('Failed to save channel tokens'), null);
    }

    // Save/update channels collection
    try {
      await db.collection('channels').doc(channelId).set({
        channelId: channelId,
        ownerEmail: userEmail,
        name: channelName,
        thumbnail: channelThumbnail,
        subscriberCount: subscriberCount,
        connectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        voiceFile: null,
        settings: {
          defaultCategory: 'Human Psychology & Behavior',
          defaultSubCategory: 'Dark Psychology',
          autoPublish: true,
          preferredTime: '17:30'
        },
        uploadHistory: []
      }, { merge: true });
      
      console.log(`✅ Channel saved to channels collection`);
    } catch (dbError) {
      console.error('❌ Error saving to channels collection:', dbError.message);
      return done(new Error('Failed to save channel details'), null);
    }

    // Add channel to user's channels array
    try {
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
          console.log(`✅ Channel added to user's channels list: ${userEmail}`);
        }
      } else {
        await db.collection('users').doc(userEmail).set({
          email: userEmail,
          channels: [channelId],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        console.log(`✅ User created and channel added: ${userEmail}`);
      }
    } catch (dbError) {
      console.error('⚠️ Error updating user channels:', dbError.message);
    }

    console.log('✅ Channel connected successfully');

    // Clear pending state from session
    if (req.session) {
      req.session.pendingUserEmail = null;
      req.session.save();
    }

    return done(null, {
      channelId: channelId,
      displayName: channelName,
      ownerEmail: userEmail,
      email: userEmail,
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('❌ OAuth error in verify callback:', error.message);
    console.error('Stack:', error.stack);
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
 * GET /auth/youtube/connect?email=user@example.com
 */
router.get('/youtube/connect', (req, res, next) => {
  const { email } = req.query;
  
  if (!email) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body style="font-family: Arial; padding: 40px; text-align: center;">
        <h2 style="color: #ef4444;">❌ Error</h2>
        <p>User email is required. Please login first.</p>
        <script>setTimeout(() => window.close(), 3000);</script>
      </body>
      </html>
    `);
  }

  // Store user email in session (fallback only)
  req.session.pendingUserEmail = email;
  req.session.save((err) => {
    if (err) console.error('⚠️ Session save warning (non-fatal):', err);
  });

  console.log(`🔄 Initiating OAuth for user: ${email}`);
  console.log(`📍 Session ID: ${req.sessionID}`);

  // PRIMARY FIX: Encode email in state parameter as base64 JSON
  // This survives cross-domain redirects where session cookies may be lost
  const stateObj = { email: email, ts: Date.now() };
  const stateParam = Buffer.from(JSON.stringify(stateObj)).toString('base64');

  passport.authenticate('google', {
    scope: [
      'profile',
      'email',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.readonly'
    ],
    accessType: 'offline',
    prompt: 'consent',
    state: stateParam  // Email encoded here - survives cross-domain redirect
  })(req, res, next);
});

/**
 * YouTube OAuth callback
 */
router.get('/youtube/callback',
  (req, res, next) => {
    // Guard: if already handled (e.g. browser retry), ignore
    if (res.headersSent) return;
    passport.authenticate('google', { 
      failureRedirect: '/auth/error',
      session: true
    })(req, res, next);
  },
  (req, res) => {
    console.log('✅ YouTube authentication successful');
    
    const channelId = req.user?.channelId;
    const channelName = req.user?.displayName;
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Channel Connected</title>
        <style>
          body {
            font-family: 'Inter', Arial, sans-serif;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
          }
          .success-card {
            background: white;
            border-radius: 16px;
            padding: 40px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            max-width: 400px;
          }
          .success-icon { font-size: 64px; color: #22c55e; margin-bottom: 20px; }
          h2 { color: #1e293b; margin-bottom: 10px; }
          p { color: #64748b; margin-bottom: 20px; }
          .channel-name { font-weight: 600; color: #6366f1; }
          .spinner {
            border: 3px solid #e2e8f0;
            border-top-color: #6366f1;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="success-card">
          <div class="success-icon">✅</div>
          <h2>Channel Connected!</h2>
          <p>Your YouTube channel <span class="channel-name">${channelName}</span> has been successfully connected.</p>
          <div class="spinner"></div>
          <p style="font-size: 14px;">Closing window...</p>
        </div>
        <script>
          function notifyParent() {
            try {
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ 
                  type: 'oauth_complete', 
                  success: true,
                  channelId: '${channelId}',
                  channelName: '${channelName}'
                }, '*');
                console.log('✅ Parent window notified');
              }
            } catch(e) {
              console.log('Could not notify parent:', e);
            }
          }
          // Notify immediately and with delay
          notifyParent();
          setTimeout(notifyParent, 300);
          setTimeout(notifyParent, 800);
          setTimeout(() => window.close(), 2000);
        </script>
      </body>
      </html>
    `);
  }
);

/**
 * Auth error page
 */
router.get('/error', (req, res) => {
  res.status(401).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Authentication Failed</title>
      <style>
        body {
          font-family: 'Inter', Arial, sans-serif;
          background: #0f172a;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          color: white;
        }
        .error-card {
          background: #1e293b;
          border-radius: 16px;
          padding: 40px;
          text-align: center;
          border: 1px solid #334155;
        }
        .error-icon { font-size: 64px; color: #ef4444; margin-bottom: 20px; }
        h2 { margin-bottom: 10px; }
        p { color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="error-card">
        <div class="error-icon">❌</div>
        <h2>Authentication Failed</h2>
        <p>Could not connect YouTube channel. Please try again.</p>
        <script>
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'oauth_error', success: false }, '*');
            }
          } catch(e) {}
          setTimeout(() => window.close(), 3000);
        </script>
      </div>
    </body>
    </html>
  `);
});

/**
 * Logout
 */
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    req.session.destroy();
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
    channel: req.user?.channelId || null,
    email: req.user?.email || null
  });
});

module.exports = router;
