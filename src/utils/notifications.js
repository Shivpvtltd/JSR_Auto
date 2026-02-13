/**
 * Notification Utility
 * Sends notifications to Discord, Slack, etc.
 */

const axios = require('axios');
const { logger } = require('../server');

// Send notification to Discord
const sendDiscordNotification = async (message, embeds = []) => {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  
  if (!webhookUrl) {
    return;
  }
  
  try {
    await axios.post(webhookUrl, {
      content: message,
      embeds: embeds.map(embed => ({
        title: embed.title,
        description: embed.description,
        color: embed.color || 0x00ff00,
        fields: embed.fields || [],
        timestamp: new Date().toISOString()
      }))
    });
    
    logger.info('Discord notification sent');
  } catch (error) {
    logger.error('Discord notification error:', error.message);
  }
};

// Send notification to Slack
const sendSlackNotification = async (message, attachments = []) => {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  
  if (!webhookUrl) {
    return;
  }
  
  try {
    await axios.post(webhookUrl, {
      text: message,
      attachments: attachments.map(att => ({
        color: att.color || 'good',
        title: att.title,
        text: att.text,
        fields: att.fields || [],
        footer: 'YT-AutoPilot Pro',
        ts: Math.floor(Date.now() / 1000)
      }))
    });
    
    logger.info('Slack notification sent');
  } catch (error) {
    logger.error('Slack notification error:', error.message);
  }
};

// Generic webhook notification
const notifyWebhook = async (eventType, data) => {
  logger.info(`Event: ${eventType}`, data);
  
  // Send to Discord if configured
  const discordEmbeds = [{
    title: `Event: ${eventType}`,
    description: JSON.stringify(data, null, 2).substring(0, 2000),
    color: getEventColor(eventType),
    fields: Object.entries(data).map(([key, value]) => ({
      name: key,
      value: String(value).substring(0, 1000),
      inline: true
    }))
  }];
  
  await sendDiscordNotification(`YT-AutoPilot Event: ${eventType}`, discordEmbeds);
  
  // Send to Slack if configured
  const slackAttachments = [{
    color: getEventColorSlack(eventType),
    title: eventType,
    text: JSON.stringify(data, null, 2).substring(0, 2000),
    fields: Object.entries(data).map(([key, value]) => ({
      title: key,
      value: String(value).substring(0, 1000),
      short: true
    }))
  }];
  
  await sendSlackNotification(`YT-AutoPilot Event: ${eventType}`, slackAttachments);
};

// Get color for event type (Discord)
const getEventColor = (eventType) => {
  const colors = {
    workflow_triggered: 0x3498db, // Blue
    workflow_completed: 0x2ecc71, // Green
    workflow_failed: 0xe74c3c, // Red
    workflow_trigger_failed: 0xe67e22, // Orange
    episode_complete: 0x9b59b6, // Purple
    long_video_published: 0x1abc9c, // Teal
    shorts_published: 0xf1c40f, // Yellow
    backup_triggered: 0x95a5a6, // Gray
    publish_failed: 0xe74c3c // Red
  };
  
  return colors[eventType] || 0x3498db;
};

// Get color for event type (Slack)
const getEventColorSlack = (eventType) => {
  const colors = {
    workflow_triggered: 'good',
    workflow_completed: 'good',
    workflow_failed: 'danger',
    workflow_trigger_failed: 'warning',
    episode_complete: '#9b59b6',
    long_video_published: 'good',
    shorts_published: 'warning',
    backup_triggered: '#95a5a6',
    publish_failed: 'danger'
  };
  
  return colors[eventType] || 'good';
};

module.exports = {
  sendDiscordNotification,
  sendSlackNotification,
  notifyWebhook
};
