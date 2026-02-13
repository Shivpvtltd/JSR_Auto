/**
 * Upload Routes
 * Handles direct file uploads to Cloudinary
 */

const express = require('express');
const { logger } = require('../server');
const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');

const router = express.Router();

// Upload file to Cloudinary
router.post('/cloudinary', async (req, res) => {
  try {
    const { file, folder, resource_type = 'auto' } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'File data required' });
    }
    
    const result = await uploadToCloudinary(file, {
      folder: folder || process.env.CLOUDINARY_FOLDER,
      resource_type
    });
    
    res.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      size: result.bytes
    });
  } catch (error) {
    logger.error('Cloudinary upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Delete file from Cloudinary
router.delete('/cloudinary/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    const result = await deleteFromCloudinary(publicId);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    logger.error('Cloudinary delete error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Get upload signature (for client-side uploads)
router.get('/signature', async (req, res) => {
  try {
    const { folder } = req.query;
    const cloudinary = require('cloudinary').v2;
    
    const timestamp = Math.round(new Date().getTime() / 1000);
    const params = {
      timestamp,
      folder: folder || process.env.CLOUDINARY_FOLDER
    };
    
    const signature = cloudinary.utils.api_sign_request(
      params,
      process.env.CLOUDINARY_API_SECRET
    );
    
    res.json({
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY,
      folder: params.folder
    });
  } catch (error) {
    logger.error('Signature generation error:', error);
    res.status(500).json({ error: 'Failed to generate signature' });
  }
});

module.exports = router;
