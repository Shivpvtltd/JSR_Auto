/**
 * Cloudinary Operations
 */

const cloudinary = require('cloudinary').v2;
const { logger } = require('../server');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload file to Cloudinary
const uploadToCloudinary = async (fileData, options = {}) => {
  const {
    folder = process.env.CLOUDINARY_FOLDER || 'yt-autopilot',
    resource_type = 'auto',
    public_id = null,
    transformation = null
  } = options;
  
  const uploadOptions = {
    folder,
    resource_type,
    ...(public_id && { public_id }),
    ...(transformation && { transformation })
  };
  
  let result;
  
  if (typeof fileData === 'string' && fileData.startsWith('http')) {
    // Upload from URL
    result = await cloudinary.uploader.upload(fileData, uploadOptions);
  } else if (typeof fileData === 'string' && fileData.startsWith('data:')) {
    // Upload from base64 data URI
    result = await cloudinary.uploader.upload(fileData, uploadOptions);
  } else if (typeof fileData === 'string') {
    // Upload from base64 string
    result = await cloudinary.uploader.upload(
      `data:${resource_type === 'video' ? 'video/mp4' : 'image/jpeg'};base64,${fileData}`,
      uploadOptions
    );
  } else {
    // Upload buffer
    result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
      stream.end(fileData);
    });
  }
  
  logger.info(`File uploaded to Cloudinary: ${result.public_id}`);
  
  return {
    public_id: result.public_id,
    secure_url: result.secure_url,
    url: result.url,
    format: result.format,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    duration: result.duration,
    created_at: result.created_at
  };
};

// Delete file from Cloudinary
const deleteFromCloudinary = async (publicId, options = {}) => {
  const { resource_type = 'image', invalidate = false } = options;
  
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type,
    invalidate
  });
  
  logger.info(`File deleted from Cloudinary: ${publicId}`);
  
  return result;
};

// Delete files by prefix (folder)
const deleteByPrefix = async (prefix, options = {}) => {
  const { resource_type = 'all' } = options;
  
  // List resources with prefix
  const result = await cloudinary.api.resources({
    type: 'upload',
    prefix,
    resource_type,
    max_results: 500
  });
  
  const publicIds = result.resources.map(r => r.public_id);
  
  if (publicIds.length === 0) {
    return { deleted: 0 };
  }
  
  // Delete resources
  const deleteResult = await cloudinary.api.delete_resources(publicIds, {
    resource_type
  });
  
  logger.info(`Deleted ${publicIds.length} files from Cloudinary with prefix: ${prefix}`);
  
  return {
    deleted: publicIds.length,
    result: deleteResult
  };
};

// Get file info
const getFileInfo = async (publicId) => {
  const result = await cloudinary.api.resource(publicId);
  
  return {
    public_id: result.public_id,
    secure_url: result.secure_url,
    format: result.format,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    duration: result.duration,
    created_at: result.created_at
  };
};

// Generate signed URL
const generateSignedUrl = (publicId, options = {}) => {
  const {
    resource_type = 'image',
    transformation = [],
    expires_at = Math.floor(Date.now() / 1000) + 3600 // 1 hour
  } = options;
  
  return cloudinary.utils.private_download_url(publicId, resource_type, {
    transformation,
    expires_at
  });
};

// List files in folder
const listFiles = async (folder, options = {}) => {
  const { resource_type = 'all', max_results = 100 } = options;
  
  const result = await cloudinary.api.resources({
    type: 'upload',
    prefix: folder,
    resource_type,
    max_results
  });
  
  return result.resources.map(r => ({
    public_id: r.public_id,
    secure_url: r.secure_url,
    format: r.format,
    bytes: r.bytes,
    created_at: r.created_at
  }));
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
  deleteByPrefix,
  getFileInfo,
  generateSignedUrl,
  listFiles
};
