/**
 * GitHub Actions Integration
 * Triggers workflows in JSR_Automation repository
 */
const axios = require('axios');

const GITHUB_API_BASE = 'https://api.github.com';
const REPO_OWNER = process.env.GITHUB_REPO_OWNER;
const REPO_NAME = process.env.GITHUB_REPO_NAME;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

/**
 * Trigger GitHub Actions workflow
 */
async function triggerGitHubWorkflow({
  runId,
  category,
  subCategory,
  episode,
  episodeData, // kept for compatibility — not sent to GitHub
  isRetry = false,
  attempt = 1
}) {
  try {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/main.yml/dispatches`;

    const response = await axios.post(
      url,
      {
        ref: 'main',
        inputs: {
          run_id: runId || `run_${Date.now()}`,
          main_category: category,
          sub_category: subCategory,
          episode: episode.toString(),
          is_retry: isRetry.toString(),
          attempt: attempt.toString()
        }
      },
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ GitHub workflow triggered:', response.status);

    return {
      success: true,
      runId: runId || `run_${Date.now()}`,
      status: response.status
    };
  } catch (error) {
    console.error(
      '❌ Failed to trigger GitHub workflow:',
      error.response?.data || error.message
    );

    return {
      success: false,
      error: error.response?.data?.message || error.message
    };
  }
}

/**
 * Get workflow run status
 */
async function getWorkflowRun(runId) {
  try {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json'
      },
      params: {
        per_page: 1
      }
    });

    const runs = response.data.workflow_runs;
    if (runs.length === 0) return null;

    return runs[0];
  } catch (error) {
    console.error('❌ Error fetching workflow run:', error.message);
    return null;
  }
}

/**
 * Get workflow run logs
 */
async function getWorkflowLogs(runId) {
  try {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${runId}/logs`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('❌ Error fetching workflow logs:', error.message);
    return null;
  }
}

/**
 * Get GitHub Actions usage
 */
async function getActionsUsage() {
  try {
    const url = `${GITHUB_API_BASE}/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json'
      },
      params: {
        per_page: 100,
        created: `>${new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000
        ).toISOString()}`
      }
    });

    const runs = response.data.workflow_runs;

    return {
      totalRuns: runs.length,
      successful: runs.filter(r => r.conclusion === 'success').length,
      failed: runs.filter(r => r.conclusion === 'failure').length,
      inProgress: runs.filter(r => r.status === 'in_progress').length
    };
  } catch (error) {
    console.error('❌ Error fetching actions usage:', error.message);
    return null;
  }
}

module.exports = {
  triggerGitHubWorkflow,
  getWorkflowRun,
  getWorkflowLogs,
  getActionsUsage
};