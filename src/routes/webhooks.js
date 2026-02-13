/**
 * Webhook Routes
 * Handles communication from GitHub Actions (Tier 2)
 */

const express = require('express');
const crypto = require('crypto');
const { logger } = require('../server');
const { triggerGitHubWorkflow } = require('../utils/github');
const { 
  updateEpisodeStatus, 
  saveVideoIds, 
  getEpisodeByRunId 
} = require('../utils/firestore');
const { notifyWebhook } = require('../utils/notifications');
const { schedulePublishJob } = require('../utils/scheduler');

const router = express.Router();

// Verify GitHub webhook signature
const verifyWebhookSignature = (payload, signature, secret) => {
  if (!signature || !secret) return true; // Skip verification if not configured
  
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
};

// Main webhook endpoint for GitHub Actions
router.post('/github-actions', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    
    // Verify signature
    if (!verifyWebhookSignature(payload, signature, process.env.GITHUB_WEBHOOK_SECRET)) {
      logger.warn('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const { 
      event_type, 
      run_id, 
      status, 
      data,
      workflow_name 
    } = req.body;
    
    logger.info(`Webhook received: ${event_type} from ${workflow_name}`, { run_id, status });
    
    switch (event_type) {
      case 'workflow_completed':
        await handleWorkflowCompleted(req.body);
        break;
        
      case 'workflow_failed':
        await handleWorkflowFailed(req.body);
        break;
        
      case 'script_generated':
        await handleScriptGenerated(req.body);
        break;
        
      case 'metadata_generated':
        await handleMetadataGenerated(req.body);
        break;
        
      case 'audio_chunk_completed':
        await handleAudioChunkCompleted(req.body);
        break;
        
      case 'audio_assembled':
        await handleAudioAssembled(req.body);
        break;
        
      case 'captions_generated':
        await handleCaptionsGenerated(req.body);
        break;
        
      case 'assets_acquired':
        await handleAssetsAcquired(req.body);
        break;
        
      case 'video_edited':
        await handleVideoEdited(req.body);
        break;
        
      case 'thumbnail_generated':
        await handleThumbnailGenerated(req.body);
        break;
        
      case 'upload_complete':
        await handleUploadComplete(req.body);
        break;
        
      case 'cleanup_complete':
        await handleCleanupComplete(req.body);
        break;
        
      default:
        logger.warn(`Unknown webhook event type: ${event_type}`);
    }
    
    res.json({ success: true, received: event_type });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Handle workflow completion
async function handleWorkflowCompleted({ run_id, workflow_name, data }) {
  logger.info(`Workflow completed: ${workflow_name}`, { run_id });
  
  // Update episode status
  await updateEpisodeStatus(run_id, {
    status: 'completed',
    workflow: workflow_name,
    completedAt: new Date().toISOString()
  });
  
  // Trigger next workflow based on current one
  const nextWorkflow = getNextWorkflow(workflow_name);
  if (nextWorkflow) {
    await triggerGitHubWorkflow(nextWorkflow, {
      run_id,
      ...data
    });
  }
}

// Handle workflow failure
async function handleWorkflowFailed({ run_id, workflow_name, error, data }) {
  logger.error(`Workflow failed: ${workflow_name}`, { run_id, error });
  
  await updateEpisodeStatus(run_id, {
    status: 'failed',
    workflow: workflow_name,
    error: error,
    failedAt: new Date().toISOString()
  });
  
  await notifyWebhook('workflow_failed', {
    workflow: workflow_name,
    run_id,
    error
  });
}

// Handle script generation completion
async function handleScriptGenerated({ run_id, data }) {
  logger.info('Script generated, triggering metadata generation', { run_id });
  
  await updateEpisodeStatus(run_id, {
    status: 'script_generated',
    script: data.script,
    category: data.category,
    subCategory: data.subCategory
  });
  
  // Trigger next workflow: 02-metadata-generation
  await triggerGitHubWorkflow('02-metadata-generation.yml', {
    run_id,
    script_data: data.script
  });
}

// Handle metadata generation completion
async function handleMetadataGenerated({ run_id, data }) {
  logger.info('Metadata generated, starting audio chunks', { run_id });
  
  await updateEpisodeStatus(run_id, {
    status: 'metadata_generated',
    metadata: data.metadata,
    title: data.metadata.title,
    description: data.metadata.description,
    thumbnailPrompt: data.metadata.thumbnail_prompt
  });
  
  // Trigger first audio chunk workflow
  await triggerGitHubWorkflow('03-audio-chunk-1.yml', {
    run_id,
    metadata: data.metadata,
    script_segments: data.script_segments
  });
}

// Handle audio chunk completion
async function handleAudioChunkCompleted({ run_id, data }) {
  logger.info(`Audio chunk ${data.chunk_number} completed`, { run_id });
  
  await updateEpisodeStatus(run_id, {
    status: `audio_chunk_${data.chunk_number}_completed`,
    [`audioChunk${data.chunk_number}`]: data.audio_url
  });
  
  // Trigger next chunk or assembly
  if (data.has_more_chunks) {
    const nextChunkWorkflow = `03-audio-chunk-${data.chunk_number + 1}.yml`;
    await triggerGitHubWorkflow(nextChunkWorkflow, {
      run_id,
      previous_chunks: data.completed_chunks
    });
  } else {
    // All chunks done, trigger assembly
    await triggerGitHubWorkflow('06-audio-assembler.yml', {
      run_id,
      all_chunks: data.completed_chunks
    });
  }
}

// Handle audio assembly completion
async function handleAudioAssembled({ run_id, data }) {
  logger.info('Audio assembled, triggering caption generation', { run_id });
  
  await updateEpisodeStatus(run_id, {
    status: 'audio_assembled',
    finalAudio: data.audio_url,
    duration: data.duration
  });
  
  // Trigger caption generation
  await triggerGitHubWorkflow('07-caption-generation.yml', {
    run_id,
    audio_url: data.audio_url,
    duration: data.duration
  });
}

// Handle captions generation completion
async function handleCaptionsGenerated({ run_id, data }) {
  logger.info('Captions generated, triggering asset acquisition', { run_id });
  
  await updateEpisodeStatus(run_id, {
    status: 'captions_generated',
    captionsUrl: data.captions_url,
    wordCount: data.word_count
  });
  
  // Trigger asset acquisition
  await triggerGitHubWorkflow('08-asset-acquisition.yml', {
    run_id,
    captions_url: data.captions_url,
    duration: data.duration
  });
}

// Handle asset acquisition completion
async function handleAssetsAcquired({ run_id, data }) {
  logger.info('Assets acquired, triggering video editing', { run_id });
  
  await updateEpisodeStatus(run_id, {
    status: 'assets_acquired',
    clipsManifest: data.clips_manifest,
    clipsCount: data.clips_count
  });
  
  // Trigger video editing
  await triggerGitHubWorkflow('09-video-editing.yml', {
    run_id,
    clips_manifest: data.clips_manifest,
    audio_url: data.audio_url,
    captions_url: data.captions_url
  });
}

// Handle video editing completion
async function handleVideoEdited({ run_id, data }) {
  logger.info('Video edited, triggering thumbnail generation', { run_id });
  
  await updateEpisodeStatus(run_id, {
    status: 'video_edited',
    longVideoUrl: data.long_video_url,
    shortVideoUrl: data.short_video_url,
    longDuration: data.long_duration,
    shortDuration: data.short_duration
  });
  
  // Trigger thumbnail generation
  await triggerGitHubWorkflow('10-thumbnail-generation.yml', {
    run_id,
    thumbnail_prompt: data.thumbnail_prompt
  });
}

// Handle thumbnail generation completion
async function handleThumbnailGenerated({ run_id, data }) {
  logger.info('Thumbnail generated, triggering YouTube upload', { run_id });
  
  await updateEpisodeStatus(run_id, {
    status: 'thumbnail_generated',
    thumbnailUrl: data.thumbnail_url
  });
  
  // Trigger YouTube upload
  await triggerGitHubWorkflow('11-youtube-upload.yml', {
    run_id,
    long_video_url: data.long_video_url,
    short_video_url: data.short_video_url,
    thumbnail_url: data.thumbnail_url,
    metadata: data.metadata
  });
}

// Handle YouTube upload completion
async function handleUploadComplete({ run_id, data }) {
  logger.info('YouTube upload complete, scheduling publishes', { run_id });
  
  const { longVideoId, shortVideoId } = data;
  
  // Save video IDs to Firestore
  await saveVideoIds(run_id, {
    longVideoId,
    shortVideoId,
    uploadedAt: new Date().toISOString()
  });
  
  await updateEpisodeStatus(run_id, {
    status: 'uploaded',
    longVideoId,
    shortVideoId
  });
  
  // Schedule publishing (5:00 PM & 5:30 PM IST)
  await schedulePublishJob(longVideoId, 'long', run_id);
  await schedulePublishJob(shortVideoId, 'shorts', run_id, longVideoId);
  
  // Trigger cleanup
  await triggerGitHubWorkflow('12-cleanup.yml', {
    run_id,
    long_video_id: longVideoId,
    short_video_id: shortVideoId
  });
}

// Handle cleanup completion
async function handleCleanupComplete({ run_id, data }) {
  logger.info('Cleanup complete', { run_id });
  
  await updateEpisodeStatus(run_id, {
    status: 'completed',
    cleanedAt: new Date().toISOString(),
    filesDeleted: data.files_deleted
  });
  
  await notifyWebhook('episode_complete', {
    run_id,
    message: 'Episode production completed successfully'
  });
}

// Get next workflow in sequence
function getNextWorkflow(currentWorkflow) {
  const workflowSequence = {
    '01-script-generation.yml': '02-metadata-generation.yml',
    '02-metadata-generation.yml': '03-audio-chunk-1.yml',
    '03-audio-chunk-1.yml': '03-audio-chunk-2.yml',
    '03-audio-chunk-2.yml': '03-audio-chunk-3.yml',
    '03-audio-chunk-3.yml': '06-audio-assembler.yml',
    '06-audio-assembler.yml': '07-caption-generation.yml',
    '07-caption-generation.yml': '08-asset-acquisition.yml',
    '08-asset-acquisition.yml': '09-video-editing.yml',
    '09-video-editing.yml': '10-thumbnail-generation.yml',
    '10-thumbnail-generation.yml': '11-youtube-upload.yml',
    '11-youtube-upload.yml': '12-cleanup.yml'
  };
  
  return workflowSequence[currentWorkflow] || null;
}

// Manual trigger endpoint (for testing)
router.post('/trigger-workflow', async (req, res) => {
  try {
    const { workflow, inputs } = req.body;
    
    if (!workflow) {
      return res.status(400).json({ error: 'Workflow name required' });
    }
    
    const result = await triggerGitHubWorkflow(workflow, inputs || {});
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Manual workflow trigger error:', error);
    res.status(500).json({ error: 'Failed to trigger workflow' });
  }
});

module.exports = router;
