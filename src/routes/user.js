/**
 * User Management Routes
 * - User registration
 * - User login
 * - User profile management
 */
const express = require('express');
const router = express.Router();
const { getFirestore } = require('../utils/firebase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

/**
 * User Registration
 * POST /api/user/register
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ 
        error: 'Email, password, and name are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
    }

    const db = getFirestore();

    // Check if user already exists
    const existingUser = await db.collection('users').doc(email).get();
    if (existingUser.exists) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user document
    const userData = {
      email,
      name,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      channels: [],  // Array of connected channel IDs
      settings: {
        defaultCategory: 'Human Psychology & Behavior',
        defaultSubCategory: 'Dark Psychology',
        autoPublish: true,
        preferredTime: '17:30'
      }
    };

    await db.collection('users').doc(email).set(userData);

    // Generate JWT token
    const token = jwt.sign(
      { email, name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`✅ User registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        email,
        name,
        settings: userData.settings
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * User Login
 * POST /api/user/login
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    const db = getFirestore();

    // Get user document
    const userDoc = await db.collection('users').doc(email).get();
    if (!userDoc.exists) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userData = userDoc.data();

    // Verify password
    const isValidPassword = await bcrypt.compare(password, userData.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await db.collection('users').doc(email).update({
      lastLogin: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Generate JWT token
    const token = jwt.sign(
      { email: userData.email, name: userData.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`✅ User logged in: ${email}`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        email: userData.email,
        name: userData.name,
        settings: userData.settings,
        channels: userData.channels || []
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * Get User Profile
 * GET /api/user/profile
 */
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(req.user.email).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Get channel details
    const channels = [];
    for (const channelId of userData.channels || []) {
      const channelDoc = await db.collection('channels').doc(channelId).get();
      if (channelDoc.exists) {
        const channelData = channelDoc.data();
        channels.push({
          channelId,
          name: channelData.name,
          isActive: channelData.isActive,
          connectedAt: channelData.connectedAt
        });
      }
    }

    res.json({
      success: true,
      user: {
        email: userData.email,
        name: userData.name,
        createdAt: userData.createdAt,
        lastLogin: userData.lastLogin,
        settings: userData.settings,
        channels
      }
    });

  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * Update User Settings
 * PUT /api/user/settings
 */
router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const { settings } = req.body;
    const db = getFirestore();

    await db.collection('users').doc(req.user.email).update({
      settings: settings,
      updatedAt: new Date().toISOString()
    });

    console.log(`✅ Settings updated for: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    console.error('❌ Settings update error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * Change Password
 * PUT /api/user/password
 */
router.put('/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'New password must be at least 6 characters' 
      });
    }

    const db = getFirestore();
    const userDoc = await db.collection('users').doc(req.user.email).get();
    const userData = userDoc.data();

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, userData.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.collection('users').doc(req.user.email).update({
      password: hashedPassword,
      updatedAt: new Date().toISOString()
    });

    console.log(`✅ Password changed for: ${req.user.email}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('❌ Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
module.exports.authenticateToken = authenticateToken;
