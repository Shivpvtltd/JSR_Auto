/**
 * GitHub API Operations
 * Triggers workflows in JSR_Automation repository
 */

const axios = require('axios');
const { logger } = require('../server');

const GITHUB_API_BASE = 'https://api.github.com';

// Trigger GitHub Actions workflow
const triggerGitHubWorkflow = async (workflowFileName, inputs = {}) => {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  
  if (!owner || !repo || !token) {
    throw new Error('GitHub configuration missing. Check GITHUB_REPO_OWNER, GITHUB_REPO_NAME, GITHUB_TOKEN');
  }
  
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${workflowFileName}/dispatches`;
  
  const payload = {
    ref: 'main',
    inputs: {
      ...inputs,
      tier1_webhook_url: process.env.BASE_URL + '/webhooks/github-actions',
      timestamp: new Date().toISOString()
    }
  };
  
  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    });
    
    logger.info(`Workflow triggered: ${workflowFileName}`, { inputs: Object.keys(inputs) });
    
    return {
      success: true,
      workflow: workflowFileName,
      status: response.status
    };
  } catch (error) {
    logger.error(`Failed to trigger workflow ${workflowFileName}:`, error.response?.data || error.message);
    throw new Error(`Workflow trigger failed: ${error.response?.data?.message || error.message}`);
  }
};

// Get workflow run status
const getWorkflowRunStatus = async (runId) => {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}`;
  
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  return {
    id: response.data.id,
    name: response.data.name,
    status: response.data.status,
    conclusion: response.data.conclusion,
    runNumber: response.data.run_number,
    createdAt: response.data.created_at,
    updatedAt: response.data.updated_at,
    htmlUrl: response.data.html_url
  };
};

// List recent workflow runs
const listWorkflowRuns = async (workflowFileName, limit = 10) => {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  
  let url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs`;
  if (workflowFileName) {
    url += `?workflow_id=${workflowFileName}`;
  }
  
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  return response.data.workflow_runs.slice(0, limit).map(run => ({
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    runNumber: run.run_number,
    createdAt: run.created_at,
    htmlUrl: run.html_url
  }));
};

// Get workflow logs
const getWorkflowLogs = async (runId) => {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}/logs`;
  
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    },
    responseType: 'arraybuffer'
  });
  
  return response.data;
};

// Cancel workflow run
const cancelWorkflowRun = async (runId) => {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}/cancel`;
  
  await axios.post(url, {}, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  logger.info(`Workflow run cancelled: ${runId}`);
  
  return { success: true, runId };
};

// Rerun workflow
const rerunWorkflow = async (runId) => {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}/rerun`;
  
  await axios.post(url, {}, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  logger.info(`Workflow run reran: ${runId}`);
  
  return { success: true, runId };
};

// Get repository content
const getRepositoryContent = async (path, ref = 'main') => {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
  
  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  return response.data;
};

// Create or update file
const createOrUpdateFile = async (path, content, message, sha = null) => {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const token = process.env.GITHUB_TOKEN;
  
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
  
  const payload = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch: 'main'
  };
  
  if (sha) {
    payload.sha = sha;
  }
  
  const response = await axios.put(url, payload, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  logger.info(`File created/updated: ${path}`);
  
  return response.data;
};

module.exports = {
  triggerGitHubWorkflow,
  getWorkflowRunStatus,
  listWorkflowRuns,
  getWorkflowLogs,
  cancelWorkflowRun,
  rerunWorkflow,
  getRepositoryContent,
  createOrUpdateFile
};
