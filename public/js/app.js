/**
 * YT-AutoPilot Pro - Frontend Application
 */

// Configuration
const CONFIG = {
    API_BASE_URL: window.location.origin,
    REFRESH_INTERVAL: 30000, // 30 seconds
};

// State
const state = {
    user: null,
    isConnected: false,
    currentPage: 'dashboard',
    stats: null,
    videos: [],
    categories: []
};

// DOM Elements
const elements = {
    sidebar: document.getElementById('sidebar'),
    menuToggle: document.getElementById('menuToggle'),
    pageTitle: document.getElementById('pageTitle'),
    refreshBtn: document.getElementById('refreshBtn'),
    connectionStatus: document.getElementById('connectionStatus'),
    userInfo: document.getElementById('userInfo'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    toastContainer: document.getElementById('toastContainer'),
    
    // Auth
    authSection: document.getElementById('authSection'),
    connectYouTubeBtn: document.getElementById('connectYouTubeBtn'),
    
    // Dashboard
    statsGrid: document.getElementById('statsGrid'),
    statusSection: document.getElementById('statusSection'),
    recentVideosSection: document.getElementById('recentVideosSection'),
    
    // Stats
    totalVideos: document.getElementById('totalVideos'),
    successRate: document.getElementById('successRate'),
    nextUpload: document.getElementById('nextUpload'),
    currentStreak: document.getElementById('currentStreak'),
    
    // Status
    systemStatus: document.getElementById('systemStatus'),
    currentCategory: document.getElementById('currentCategory'),
    nextEpisode: document.getElementById('nextEpisode'),
    lastUpload: document.getElementById('lastUpload'),
    githubStatus: document.getElementById('githubStatus'),
    
    // Videos
    recentVideoList: document.getElementById('recentVideoList'),
    videoGrid: document.getElementById('videoGrid'),
    videoSearch: document.getElementById('videoSearch'),
    videoFilter: document.getElementById('videoFilter'),
    
    // Categories
    categoriesList: document.getElementById('categoriesList'),
    
    // Settings
    discordWebhook: document.getElementById('discordWebhook'),
    slackWebhook: document.getElementById('slackWebhook'),
    uploadTime: document.getElementById('uploadTime'),
    backupTime: document.getElementById('backupTime'),
    longDuration: document.getElementById('longDuration'),
    shortDuration: document.getElementById('shortDuration'),
    privacyStatus: document.getElementById('privacyStatus'),
    pauseAutomationBtn: document.getElementById('pauseAutomationBtn'),
    resetEpisodeBtn: document.getElementById('resetEpisodeBtn'),
    disconnectYouTubeBtn: document.getElementById('disconnectYouTubeBtn')
};

// Initialize
function init() {
    setupEventListeners();
    checkAuth();
    loadInitialData();
    startAutoRefresh();
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    elements.menuToggle?.addEventListener('click', toggleSidebar);
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
    
    // Auth
    elements.connectYouTubeBtn?.addEventListener('click', connectYouTube);
    
    // Refresh
    elements.refreshBtn?.addEventListener('click', refreshData);
    
    // Video search & filter
    elements.videoSearch?.addEventListener('input', debounce(filterVideos, 300));
    elements.videoFilter?.addEventListener('change', filterVideos);
    
    // Settings
    elements.pauseAutomationBtn?.addEventListener('click', pauseAutomation);
    elements.resetEpisodeBtn?.addEventListener('click', resetEpisode);
    elements.disconnectYouTubeBtn?.addEventListener('click', disconnectYouTube);
    
    // Close sidebar on mobile when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!elements.sidebar.contains(e.target) && !elements.menuToggle.contains(e.target)) {
                elements.sidebar.classList.remove('open');
            }
        }
    });
}

// Navigation
function navigateTo(page) {
    state.currentPage = page;
    
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        videos: 'Videos',
        categories: 'Categories',
        analytics: 'Analytics',
        settings: 'Settings'
    };
    elements.pageTitle.textContent = titles[page] || 'Dashboard';
    
    // Show page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${page}-page`)?.classList.add('active');
    
    // Close sidebar on mobile
    elements.sidebar.classList.remove('open');
    
    // Load page data
    loadPageData(page);
}

function toggleSidebar() {
    elements.sidebar.classList.toggle('open');
}

// Auth Functions
async function checkAuth() {
    const token = localStorage.getItem('yt_autopilot_token');
    
    if (!token) {
        showAuthSection();
        return;
    }
    
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/auth/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        
        const data = await response.json();
        
        if (data.valid) {
            state.user = data.user;
            state.isConnected = true;
            showDashboard();
            updateUserInfo();
        } else {
            localStorage.removeItem('yt_autopilot_token');
            showAuthSection();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showAuthSection();
    }
}

function connectYouTube() {
    window.location.href = `${CONFIG.API_BASE_URL}/auth/youtube`;
}

function disconnectYouTube() {
    if (!confirm('Are you sure you want to disconnect your YouTube channel?')) return;
    
    localStorage.removeItem('yt_autopilot_token');
    state.user = null;
    state.isConnected = false;
    
    showToast('YouTube disconnected', 'info');
    showAuthSection();
}

function showAuthSection() {
    elements.authSection.style.display = 'flex';
    elements.statsGrid.style.display = 'none';
    elements.statusSection.style.display = 'none';
    elements.recentVideosSection.style.display = 'none';
    updateConnectionStatus(false);
}

function showDashboard() {
    elements.authSection.style.display = 'none';
    elements.statsGrid.style.display = 'grid';
    elements.statusSection.style.display = 'block';
    elements.recentVideosSection.style.display = 'block';
    updateConnectionStatus(true);
}

function updateUserInfo() {
    if (state.user) {
        elements.userInfo.querySelector('.user-name').textContent = state.user.displayName || 'User';
        elements.userInfo.querySelector('.user-status').textContent = 'Connected';
        elements.userInfo.querySelector('.user-status').style.color = 'var(--success)';
    }
}

function updateConnectionStatus(connected) {
    const dot = elements.connectionStatus.querySelector('.status-dot');
    const text = elements.connectionStatus.querySelector('.status-text');
    
    dot.classList.toggle('online', connected);
    dot.classList.toggle('offline', !connected);
    text.textContent = connected ? 'Online' : 'Offline';
}

// Data Loading
async function loadInitialData() {
    if (!state.isConnected) return;
    
    showLoading(true);
    
    try {
        await Promise.all([
            loadSystemStats(),
            loadRecentVideos(),
            loadCategories()
        ]);
    } catch (error) {
        console.error('Error loading initial data:', error);
        showToast('Failed to load data', 'error');
    } finally {
        showLoading(false);
    }
}

async function loadPageData(page) {
    if (!state.isConnected) return;
    
    switch (page) {
        case 'dashboard':
            await loadSystemStats();
            await loadRecentVideos();
            break;
        case 'videos':
            await loadAllVideos();
            break;
        case 'categories':
            await loadCategories();
            break;
        case 'analytics':
            await loadAnalytics();
            break;
        case 'settings':
            await loadSettings();
            break;
    }
}

async function loadSystemStats() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/status/system`);
        const data = await response.json();
        
        state.stats = data;
        
        // Update stats display
        if (data.stats) {
            elements.totalVideos.textContent = data.stats.totalVideos || 0;
            elements.successRate.textContent = data.stats.successRate || '0%';
        }
        
        // Update next upload time
        if (data.nextScheduledRun) {
            const nextDate = new Date(data.nextScheduledRun);
            elements.nextUpload.textContent = nextDate.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        // Update status section
        elements.systemStatus.textContent = data.status === 'healthy' ? 'Healthy' : 'Degraded';
        elements.systemStatus.className = 'badge ' + (data.status === 'healthy' ? 'success' : 'warning');
        
        // Calculate streak
        if (data.stats) {
            const streak = calculateStreak(data.stats);
            elements.currentStreak.textContent = streak + ' days';
        }
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadRecentVideos() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/status/videos?limit=5`);
        const data = await response.json();
        
        state.videos = data.videos || [];
        renderRecentVideos(state.videos);
        
        // Update last upload
        if (state.videos.length > 0) {
            const lastVideo = state.videos[0];
            elements.lastUpload.textContent = formatDate(lastVideo.uploadedAt);
        }
        
    } catch (error) {
        console.error('Error loading videos:', error);
    }
}

async function loadAllVideos() {
    showLoading(true);
    
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/status/videos?limit=50`);
        const data = await response.json();
        
        state.videos = data.videos || [];
        renderVideoGrid(state.videos);
        
    } catch (error) {
        console.error('Error loading videos:', error);
        showToast('Failed to load videos', 'error');
    } finally {
        showLoading(false);
    }
}

async function loadCategories() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/status/categories`);
        const data = await response.json();
        
        state.categories = data.categories || [];
        renderCategories(state.categories);
        
        // Update current category
        if (data.categories.length > 0) {
            const current = data.categories[0];
            elements.currentCategory.textContent = current.name;
            elements.nextEpisode.textContent = `Ep ${(current.episodesCompleted || 0) + 1}`;
        }
        
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadAnalytics() {
    showLoading(true);
    
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/status/analytics/youtube`);
        const data = await response.json();
        
        // Update analytics display
        if (data.channel) {
            document.getElementById('totalViews').textContent = formatNumber(data.channel.totalViews);
        }
        
        // Render chart
        renderUploadChart(data);
        
    } catch (error) {
        console.error('Error loading analytics:', error);
    } finally {
        showLoading(false);
    }
}

async function loadSettings() {
    // Load settings from localStorage or API
    const settings = JSON.parse(localStorage.getItem('yt_autopilot_settings') || '{}');
    
    elements.discordWebhook.value = settings.discordWebhook || '';
    elements.slackWebhook.value = settings.slackWebhook || '';
    elements.uploadTime.value = settings.uploadTime || '17:00';
    elements.backupTime.value = settings.backupTime || '17:05';
    elements.longDuration.value = settings.longDuration || '14';
    elements.shortDuration.value = settings.shortDuration || '45';
    elements.privacyStatus.value = settings.privacyStatus || 'public';
}

// Rendering Functions
function renderRecentVideos(videos) {
    if (!videos || videos.length === 0) {
        elements.recentVideoList.innerHTML = '<div class="loading">No videos yet</div>';
        return;
    }
    
    elements.recentVideoList.innerHTML = videos.map(video => `
        <div class="video-item">
            <div class="video-thumbnail">
                ${video.thumbnailUrl 
                    ? `<img src="${video.thumbnailUrl}" alt="">`
                    : '<i class="fas fa-video"></i>'
                }
            </div>
            <div class="video-info">
                <div class="video-title">${video.metadata?.title || 'Untitled'}</div>
                <div class="video-meta">${formatDate(video.uploadedAt)} • ${video.videoType || 'long'}</div>
            </div>
            <span class="video-status ${video.status || 'published'}">${video.status || 'Published'}</span>
        </div>
    `).join('');
}

function renderVideoGrid(videos) {
    if (!videos || videos.length === 0) {
        elements.videoGrid.innerHTML = '<div class="loading">No videos found</div>';
        return;
    }
    
    elements.videoGrid.innerHTML = videos.map(video => `
        <div class="video-card">
            <div class="video-card-thumb">
                ${video.thumbnailUrl 
                    ? `<img src="${video.thumbnailUrl}" alt="">`
                    : '<i class="fas fa-video fa-2x"></i>'
                }
            </div>
            <div class="video-card-info">
                <div class="video-card-title">${video.metadata?.title || 'Untitled'}</div>
                <div class="video-card-meta">
                    <span>${formatDate(video.uploadedAt)}</span>
                    <span>${video.videoType || 'long'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function renderCategories(categories) {
    if (!categories || categories.length === 0) {
        elements.categoriesList.innerHTML = '<div class="loading">No categories found</div>';
        return;
    }
    
    elements.categoriesList.innerHTML = categories.map(cat => `
        <div class="category-item">
            <div class="category-header">
                <div>
                    <div class="category-name">${cat.name}</div>
                    <div class="category-hindi">${cat.hindiName || ''}</div>
                </div>
                <span class="badge">${cat.episodesCompleted || 0} episodes</span>
            </div>
            <div class="category-progress">
                ${(cat.subCategories || []).map(sub => `
                    <div class="sub-category">
                        <div class="sub-name">${sub.name}</div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${(sub.lastEpisode / 10) * 100}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

function renderUploadChart(data) {
    const canvas = document.getElementById('uploadChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Simple bar chart
    const chartData = data.dailyStats || [
        { date: 'Mon', count: 2 },
        { date: 'Tue', count: 1 },
        { date: 'Wed', count: 2 },
        { date: 'Thu', count: 1 },
        { date: 'Fri', count: 2 },
        { date: 'Sat', count: 1 },
        { date: 'Sun', count: 2 }
    ];
    
    const maxCount = Math.max(...chartData.map(d => d.count));
    const barWidth = 60;
    const gap = 40;
    const startX = 50;
    const startY = 250;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    chartData.forEach((item, index) => {
        const barHeight = (item.count / maxCount) * 200;
        const x = startX + index * (barWidth + gap);
        const y = startY - barHeight;
        
        // Draw bar
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Draw label
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(item.date, x + barWidth / 2, startY + 20);
        
        // Draw value
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(item.count, x + barWidth / 2, y - 10);
    });
}

// Filter Functions
function filterVideos() {
    const searchTerm = elements.videoSearch?.value.toLowerCase() || '';
    const filterType = elements.videoFilter?.value || 'all';
    
    let filtered = state.videos;
    
    if (searchTerm) {
        filtered = filtered.filter(v => 
            v.metadata?.title?.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filterType !== 'all') {
        filtered = filtered.filter(v => v.videoType === filterType);
    }
    
    renderVideoGrid(filtered);
}

// Settings Actions
async function saveSettings() {
    const settings = {
        discordWebhook: elements.discordWebhook.value,
        slackWebhook: elements.slackWebhook.value,
        uploadTime: elements.uploadTime.value,
        backupTime: elements.backupTime.value,
        longDuration: elements.longDuration.value,
        shortDuration: elements.shortDuration.value,
        privacyStatus: elements.privacyStatus.value
    };
    
    localStorage.setItem('yt_autopilot_settings', JSON.stringify(settings));
    
    // TODO: Send to API
    showToast('Settings saved', 'success');
}

function pauseAutomation() {
    if (!confirm('Are you sure you want to pause automation?')) return;
    
    // TODO: Call API to pause
    showToast('Automation paused', 'warning');
}

function resetEpisode() {
    if (!confirm('Are you sure you want to reset the episode counter? This cannot be undone.')) return;
    
    // TODO: Call API to reset
    showToast('Episode counter reset', 'warning');
}

// Utility Functions
function showLoading(show) {
    elements.loadingOverlay.classList.toggle('active', show);
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function calculateStreak(stats) {
    // Simple streak calculation based on consecutive days with uploads
    return Math.floor(Math.random() * 30) + 1; // Placeholder
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function refreshData() {
    elements.refreshBtn.querySelector('i').classList.add('fa-spin');
    
    loadInitialData().then(() => {
        setTimeout(() => {
            elements.refreshBtn.querySelector('i').classList.remove('fa-spin');
        }, 500);
    });
}

function startAutoRefresh() {
    setInterval(() => {
        if (state.isConnected && state.currentPage === 'dashboard') {
            loadSystemStats();
        }
    }, CONFIG.REFRESH_INTERVAL);
}

// Handle OAuth callback
function handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
        localStorage.setItem('yt_autopilot_token', token);
        window.history.replaceState({}, document.title, window.location.pathname);
        checkAuth();
        showToast('YouTube connected successfully!', 'success');
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    handleOAuthCallback();
    init();
});
