/**
 * YT-AutoPilot Pro - Frontend Application
 * Updated for Multi-Channel Support + User Authentication
 */

// Configuration
const CONFIG = {
    API_BASE_URL: window.location.origin,
    REFRESH_INTERVAL: 30000, // 30 seconds
};

// State
const state = {
    user: null,
    token: null,
    isLoggedIn: false,
    channels: [],
    currentPage: 'dashboard',
    stats: null,
    videos: [],
    categories: [],
    selectedChannelId: null
};

// DOM Elements cache
let elements = {};

// Initialize
function init() {
    cacheElements();
    setupEventListeners();
    checkAuth();
}

// Cache DOM elements
function cacheElements() {
    elements = {
        // Auth pages
        authPages: document.getElementById('authPages'),
        loginPage: document.getElementById('loginPage'),
        registerPage: document.getElementById('registerPage'),
        loginForm: document.getElementById('loginForm'),
        registerForm: document.getElementById('registerForm'),
        loginEmail: document.getElementById('loginEmail'),
        loginPassword: document.getElementById('loginPassword'),
        registerName: document.getElementById('registerName'),
        registerEmail: document.getElementById('registerEmail'),
        registerPassword: document.getElementById('registerPassword'),
        showRegister: document.getElementById('showRegister'),
        showLogin: document.getElementById('showLogin'),
        
        // Dashboard pages
        dashboardPages: document.getElementById('dashboardPages'),
        sidebar: document.getElementById('sidebar'),
        menuToggle: document.getElementById('menuToggle'),
        pageTitle: document.getElementById('pageTitle'),
        refreshBtn: document.getElementById('refreshBtn'),
        connectionStatus: document.getElementById('connectionStatus'),
        userInfo: document.getElementById('userInfo'),
        userName: document.getElementById('userName'),
        userEmail: document.getElementById('userEmail'),
        logoutBtn: document.getElementById('logoutBtn'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        
        // Dashboard
        noChannelsWarning: document.getElementById('noChannelsWarning'),
        statsGrid: document.getElementById('statsGrid'),
        statusSection: document.getElementById('statusSection'),
        recentVideosSection: document.getElementById('recentVideosSection'),
        connectFirstChannelBtn: document.getElementById('connectFirstChannelBtn'),
        
        // Stats
        totalVideos: document.getElementById('totalVideos'),
        successRate: document.getElementById('successRate'),
        nextUpload: document.getElementById('nextUpload'),
        totalChannels: document.getElementById('totalChannels'),
        
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
        channelFilter: document.getElementById('channelFilter'),
        
        // Channels
        channelsGrid: document.getElementById('channelsGrid'),
        addChannelBtn: document.getElementById('addChannelBtn'),
        
        // Categories
        categoriesList: document.getElementById('categoriesList'),
        
        // Settings
        discordWebhook: document.getElementById('discordWebhook'),
        slackWebhook: document.getElementById('slackWebhook'),
        uploadTime: document.getElementById('uploadTime'),
        defaultCategory: document.getElementById('defaultCategory'),
        profileName: document.getElementById('profileName'),
        profileEmail: document.getElementById('profileEmail'),
        saveProfileBtn: document.getElementById('saveProfileBtn'),
        pauseAutomationBtn: document.getElementById('pauseAutomationBtn'),
        changePasswordBtn: document.getElementById('changePasswordBtn'),
        
        // Modals
        channelSettingsModal: document.getElementById('channelSettingsModal'),
        closeChannelModal: document.getElementById('closeChannelModal'),
        modalChannelInfo: document.getElementById('modalChannelInfo'),
        modalChannelThumbnail: document.getElementById('modalChannelThumbnail'),
        modalChannelName: document.getElementById('modalChannelName'),
        modalChannelId: document.getElementById('modalChannelId'),
        modalChannelCategory: document.getElementById('modalChannelCategory'),
        modalChannelVoice: document.getElementById('modalChannelVoice'),
        modalChannelActive: document.getElementById('modalChannelActive'),
        cancelChannelSettings: document.getElementById('cancelChannelSettings'),
        saveChannelSettings: document.getElementById('saveChannelSettings'),
        
        changePasswordModal: document.getElementById('changePasswordModal'),
        closePasswordModal: document.getElementById('closePasswordModal'),
        currentPassword: document.getElementById('currentPassword'),
        newPassword: document.getElementById('newPassword'),
        confirmPassword: document.getElementById('confirmPassword'),
        cancelPasswordChange: document.getElementById('cancelPasswordChange'),
        savePasswordChange: document.getElementById('savePasswordChange'),
    };
}

// Event Listeners
function setupEventListeners() {
    // Auth navigation
    elements.showRegister?.addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterPage();
    });
    
    elements.showLogin?.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginPage();
    });
    
    // Auth forms
    elements.loginForm?.addEventListener('submit', handleLogin);
    elements.registerForm?.addEventListener('submit', handleRegister);
    
    // Logout
    elements.logoutBtn?.addEventListener('click', handleLogout);
    
    // Navigation
    elements.menuToggle?.addEventListener('click', toggleSidebar);
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
    
    // Dashboard
    elements.connectFirstChannelBtn?.addEventListener('click', addYouTubeChannel);
    elements.addChannelBtn?.addEventListener('click', addYouTubeChannel);
    
    // Refresh
    elements.refreshBtn?.addEventListener('click', refreshData);
    
    // Video search & filter
    elements.videoSearch?.addEventListener('input', debounce(filterVideos, 300));
    elements.channelFilter?.addEventListener('change', filterVideos);
    
    // Settings
    elements.saveProfileBtn?.addEventListener('click', saveProfile);
    elements.pauseAutomationBtn?.addEventListener('click', pauseAutomation);
    elements.changePasswordBtn?.addEventListener('click', () => openModal('changePasswordModal'));
    
    // Modal - Channel Settings
    elements.closeChannelModal?.addEventListener('click', () => closeModal('channelSettingsModal'));
    elements.cancelChannelSettings?.addEventListener('click', () => closeModal('channelSettingsModal'));
    elements.saveChannelSettings?.addEventListener('click', saveChannelSettings);
    
    // Modal - Password
    elements.closePasswordModal?.addEventListener('click', () => closeModal('changePasswordModal'));
    elements.cancelPasswordChange?.addEventListener('click', () => closeModal('changePasswordModal'));
    elements.savePasswordChange?.addEventListener('click', changePassword);
    
    // Close sidebar on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!elements.sidebar.contains(e.target) && !elements.menuToggle.contains(e.target)) {
                elements.sidebar.classList.remove('open');
            }
        }
    });
    
    // Close modals on outside click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
}

// ==================== AUTH FUNCTIONS ====================

function showLoginPage() {
    elements.loginPage.classList.add('active');
    elements.registerPage.classList.remove('active');
}

function showRegisterPage() {
    elements.loginPage.classList.remove('active');
    elements.registerPage.classList.add('active');
}

async function checkAuth() {
    const token = localStorage.getItem('yt_autopilot_token');
    
    if (!token) {
        showAuthPages();
        return;
    }
    
    state.token = token;
    
    try {
        // Get user profile
        const response = await apiGet('/api/user/profile');
        
        if (response.success) {
            state.user = response.user;
            state.isLoggedIn = true;
            showDashboardPages();
            updateUserInfo();
            loadInitialData();
            startAutoRefresh();
        } else {
            handleLogout();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        handleLogout();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = elements.loginEmail.value.trim();
    const password = elements.loginPassword.value;
    
    if (!email || !password) {
        showToast('Please enter email and password', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await apiPost('/api/user/login', { email, password });
        
        if (response.success) {
            state.token = response.token;
            state.user = response.user;
            state.isLoggedIn = true;
            
            localStorage.setItem('yt_autopilot_token', response.token);
            
            showToast('Login successful!', 'success');
            showDashboardPages();
            updateUserInfo();
            loadInitialData();
            startAutoRefresh();
        } else {
            showToast(response.error || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const name = elements.registerName.value.trim();
    const email = elements.registerEmail.value.trim();
    const password = elements.registerPassword.value;
    
    if (!name || !email || !password) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await apiPost('/api/user/register', { name, email, password });
        
        if (response.success) {
            state.token = response.token;
            state.user = response.user;
            state.isLoggedIn = true;
            
            localStorage.setItem('yt_autopilot_token', response.token);
            
            showToast('Account created successfully!', 'success');
            showDashboardPages();
            updateUserInfo();
            loadInitialData();
            startAutoRefresh();
        } else {
            showToast(response.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Registration failed. Please try again.', 'error');
    } finally {
        showLoading(false);
    }
}

function handleLogout() {
    localStorage.removeItem('yt_autopilot_token');
    state.token = null;
    state.user = null;
    state.isLoggedIn = false;
    state.channels = [];
    
    showToast('Logged out successfully', 'info');
    showAuthPages();
}

function showAuthPages() {
    elements.authPages.style.display = 'block';
    elements.dashboardPages.style.display = 'none';
    elements.sidebar.classList.remove('logged-in');
    showLoginPage();
}

function showDashboardPages() {
    elements.authPages.style.display = 'none';
    elements.dashboardPages.style.display = 'block';
    elements.sidebar.classList.add('logged-in');
}

// ==================== NAVIGATION ====================

function navigateTo(page) {
    state.currentPage = page;
    
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        channels: 'My Channels',
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

// ==================== DATA LOADING ====================

async function loadInitialData() {
    showLoading(true);
    
    try {
        await Promise.all([
            loadChannels(),
            loadSystemStats(),
            loadRecentVideos()
        ]);
    } catch (error) {
        console.error('Error loading initial data:', error);
    } finally {
        showLoading(false);
    }
}

async function loadPageData(page) {
    switch (page) {
        case 'dashboard':
            await loadSystemStats();
            await loadRecentVideos();
            break;
        case 'channels':
            await loadChannels();
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

// ==================== CHANNELS ====================

async function loadChannels() {
    try {
        const response = await apiGet('/api/channels');
        
        if (response.success) {
            state.channels = response.channels || [];
            renderChannels(state.channels);
            updateChannelFilter(state.channels);
            
            // Show/hide no channels warning
            if (state.channels.length === 0) {
                elements.noChannelsWarning.style.display = 'flex';
                elements.statsGrid.style.display = 'none';
                elements.statusSection.style.display = 'none';
                elements.recentVideosSection.style.display = 'none';
            } else {
                elements.noChannelsWarning.style.display = 'none';
                elements.statsGrid.style.display = 'grid';
                elements.statusSection.style.display = 'block';
                elements.recentVideosSection.style.display = 'block';
            }
            
            // Update total channels stat
            elements.totalChannels.textContent = state.channels.length;
        }
    } catch (error) {
        console.error('Error loading channels:', error);
    }
}

function renderChannels(channels) {
    if (!channels || channels.length === 0) {
        elements.channelsGrid.innerHTML = `
            <div class="empty-state">
                <i class="fab fa-youtube"></i>
                <h3>No Channels Connected</h3>
                <p>Connect your YouTube channels to start generating videos.</p>
                <button class="btn btn-youtube" onclick="addYouTubeChannel()">
                    <i class="fas fa-plus"></i>
                    Add Channel
                </button>
            </div>
        `;
        return;
    }
    
    elements.channelsGrid.innerHTML = channels.map(channel => `
        <div class="channel-card ${channel.isActive ? 'active' : 'inactive'}">
            <div class="channel-header">
                <img src="${channel.thumbnail || 'https://via.placeholder.com/80'}" alt="${channel.name}" class="channel-thumb">
                <div class="channel-info">
                    <h4>${channel.name}</h4>
                    <p>${channel.subscriberCount || 0} subscribers</p>
                    <span class="channel-status ${channel.isActive ? 'active' : 'inactive'}">
                        ${channel.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
            </div>
            <div class="channel-details">
                <div class="detail-item">
                    <span class="detail-label">Category:</span>
                    <span class="detail-value">${channel.settings?.defaultCategory || 'Not set'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Voice:</span>
                    <span class="detail-value">${channel.voiceFile ? channel.voiceFile.split('/').pop() : 'Default'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Connected:</span>
                    <span class="detail-value">${formatDate(channel.connectedAt)}</span>
                </div>
            </div>
            <div class="channel-actions">
                <button class="btn btn-sm btn-secondary" onclick="openChannelSettings('${channel.channelId}')">
                    <i class="fas fa-cog"></i>
                    Settings
                </button>
                <button class="btn btn-sm btn-primary" onclick="generateVideo('${channel.channelId}')">
                    <i class="fas fa-play"></i>
                    Generate
                </button>
            </div>
        </div>
    `).join('');
}

function updateChannelFilter(channels) {
    const options = ['<option value="all">All Channels</option>'];
    channels.forEach(channel => {
        options.push(`<option value="${channel.channelId}">${channel.name}</option>`);
    });
    elements.channelFilter.innerHTML = options.join('');
}

function addYouTubeChannel() {
    if (!state.user) {
        showToast('Please login first', 'error');
        return;
    }
    
    showToast('Opening YouTube authorization...', 'info');
    
    // Open OAuth in popup
    const width = 600;
    const height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    
    const popupUrl = `${CONFIG.API_BASE_URL}/auth/youtube/connect?email=${encodeURIComponent(state.user.email)}`;
    
    console.log('Opening OAuth popup:', popupUrl);
    
    const popup = window.open(
        popupUrl,
        'youtubeOAuth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );
    
    if (!popup) {
        showToast('Popup blocked! Please allow popups for this site.', 'error');
        return;
    }
    
    // Listen for OAuth completion
    const messageHandler = (e) => {
        console.log('Received message:', e.data);
        
        if (e.data && e.data.type === 'oauth_complete' && e.data.success) {
            window.removeEventListener('message', messageHandler);
            
            if (popup && !popup.closed) {
                popup.close();
            }
            
            showToast(`Channel "${e.data.channelName}" connected successfully!`, 'success');
            loadChannels(); // Refresh channels list
        } else if (e.data && e.data.type === 'oauth_error') {
            window.removeEventListener('message', messageHandler);
            
            if (popup && !popup.closed) {
                popup.close();
            }
            
            showToast('Failed to connect channel. Please try again.', 'error');
        }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Check if popup is closed manually
    const checkClosed = setInterval(() => {
        if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageHandler);
            console.log('Popup closed by user');
        }
    }, 500);
}

function openChannelSettings(channelId) {
    const channel = state.channels.find(c => c.channelId === channelId);
    if (!channel) return;
    
    state.selectedChannelId = channelId;
    
    elements.modalChannelThumbnail.src = channel.thumbnail || '';
    elements.modalChannelName.textContent = channel.name;
    elements.modalChannelId.textContent = channel.channelId;
    elements.modalChannelCategory.value = channel.settings?.defaultCategory || 'Human Psychology & Behavior';
    elements.modalChannelVoice.value = channel.voiceFile || 'voices/my_voice.wav';
    elements.modalChannelActive.checked = channel.isActive !== false;
    
    openModal('channelSettingsModal');
}

async function saveChannelSettings() {
    if (!state.selectedChannelId) return;
    
    showLoading(true);
    
    try {
        const settings = {
            defaultCategory: elements.modalChannelCategory.value,
            voiceFile: elements.modalChannelVoice.value,
            isActive: elements.modalChannelActive.checked
        };
        
        // Update settings
        await apiPut(`/api/channels/${state.selectedChannelId}/settings`, { settings });
        
        // Update voice file
        await apiPut(`/api/channels/${state.selectedChannelId}/voice`, { 
            voiceFile: elements.modalChannelVoice.value 
        });
        
        // Toggle active status if changed
        const channel = state.channels.find(c => c.channelId === state.selectedChannelId);
        if (channel && channel.isActive !== elements.modalChannelActive.checked) {
            await apiPut(`/api/channels/${state.selectedChannelId}/toggle`);
        }
        
        showToast('Channel settings saved!', 'success');
        closeModal('channelSettingsModal');
        loadChannels();
    } catch (error) {
        console.error('Error saving channel settings:', error);
        showToast('Failed to save settings', 'error');
    } finally {
        showLoading(false);
    }
}

async function generateVideo(channelId) {
    showLoading(true);
    
    try {
        const response = await apiPost(`/api/channels/${channelId}/generate`);
        
        if (response.success) {
            showToast('Video generation started!', 'success');
        } else {
            showToast(response.error || 'Generation failed', 'error');
        }
    } catch (error) {
        console.error('Error generating video:', error);
        showToast('Failed to start generation', 'error');
    } finally {
        showLoading(false);
    }
}

// ==================== SYSTEM STATS ====================

async function loadSystemStats() {
    try {
        const response = await apiGet('/health');
        
        if (response.status === 'healthy') {
            elements.systemStatus.textContent = 'Healthy';
            elements.systemStatus.className = 'badge success';
            elements.githubStatus.textContent = 'Active';
        } else {
            elements.systemStatus.textContent = 'Degraded';
            elements.systemStatus.className = 'badge warning';
            elements.githubStatus.textContent = 'Issues';
        }
        
        updateConnectionStatus(true);
    } catch (error) {
        console.error('Error loading system stats:', error);
        elements.systemStatus.textContent = 'Offline';
        elements.systemStatus.className = 'badge error';
        elements.githubStatus.textContent = 'Offline';
        updateConnectionStatus(false);
    }
}

// ==================== VIDEOS ====================

async function loadRecentVideos() {
    try {
        // This would be an API call to get recent videos
        // For now, showing placeholder
        elements.recentVideoList.innerHTML = `
            <div class="empty-state small">
                <i class="fas fa-video"></i>
                <p>No videos yet. Generate your first video!</p>
            </div>
        `;
        elements.totalVideos.textContent = '0';
        elements.successRate.textContent = '100%';
        elements.nextUpload.textContent = '5:30 PM';
    } catch (error) {
        console.error('Error loading recent videos:', error);
    }
}

async function loadAllVideos() {
    showLoading(true);
    
    try {
        // This would be an API call
        elements.videoGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-video"></i>
                <h3>No Videos Yet</h3>
                <p>Your generated videos will appear here.</p>
            </div>
        `;
    } catch (error) {
        console.error('Error loading videos:', error);
    } finally {
        showLoading(false);
    }
}

function filterVideos() {
    const searchTerm = elements.videoSearch?.value.toLowerCase() || '';
    const channelId = elements.channelFilter?.value || 'all';
    
    // Filter logic here
    console.log('Filtering videos:', { searchTerm, channelId });
}

// ==================== CATEGORIES ====================

async function loadCategories() {
    const categories = [
        { name: 'Human Psychology & Behavior', hindiName: 'मानव मनोविज्ञान और व्यवहार' },
        { name: 'Hidden Historical Truths', hindiName: 'इतिहास की छुपी सच्चाई' },
        { name: 'Politics Decoded', hindiName: 'राजनीति का खेल' },
        { name: 'Business Fundamentals', hindiName: 'बिजनेस की बुनियाद' },
        { name: 'Education System Exposed', hindiName: 'स्टडी सिस्टम रिव्यू' },
        { name: 'Society Reality', hindiName: 'समाज का सच' },
        { name: 'Communication Mastery', hindiName: 'कम्युनिकेशन मास्टरी' },
        { name: 'Human Life Reality', hindiName: 'इंसानी जिंदगी की हकीकत' },
        { name: 'Mythology', hindiName: 'पौराणिक कथाएं और प्राचीन ज्ञान' },
        { name: 'Health & Wellness', hindiName: 'स्वास्थ्य और कल्याण' },
        { name: 'Personal Finance', hindiName: 'व्यक्तिगत वित्त' },
        { name: 'Technology & Future', hindiName: 'टेक्नोलॉजी और भविष्य' }
    ];
    
    elements.categoriesList.innerHTML = categories.map(cat => `
        <div class="category-item">
            <div class="category-header">
                <div>
                    <div class="category-name">${cat.name}</div>
                    <div class="category-hindi">${cat.hindiName}</div>
                </div>
            </div>
        </div>
    `).join('');
    
    if (state.channels.length > 0) {
        elements.currentCategory.textContent = state.channels[0].settings?.defaultCategory || categories[0].name;
        elements.nextEpisode.textContent = 'Ep 1';
    }
}

// ==================== ANALYTICS ====================

async function loadAnalytics() {
    showLoading(true);
    
    try {
        document.getElementById('totalViews').textContent = '-';
        document.getElementById('totalLikes').textContent = '-';
        renderUploadChart([]);
    } catch (error) {
        console.error('Error loading analytics:', error);
    } finally {
        showLoading(false);
    }
}

function renderUploadChart(data) {
    const canvas = document.getElementById('uploadChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Placeholder chart
    const chartData = [
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
    
    chartData.forEach((item, index) => {
        const barHeight = maxCount > 0 ? (item.count / maxCount) * 200 : 0;
        const x = startX + index * (barWidth + gap);
        const y = startY - barHeight;
        
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(item.date, x + barWidth / 2, startY + 20);
        
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(item.count, x + barWidth / 2, y - 10);
    });
}

// ==================== SETTINGS ====================

async function loadSettings() {
    if (state.user) {
        elements.profileName.value = state.user.name || '';
        elements.profileEmail.value = state.user.email || '';
        elements.defaultCategory.value = state.user.settings?.defaultCategory || 'Human Psychology & Behavior';
        elements.uploadTime.value = state.user.settings?.preferredTime || '17:30';
    }
}

async function saveProfile() {
    showLoading(true);
    
    try {
        const settings = {
            defaultCategory: elements.defaultCategory.value,
            preferredTime: elements.uploadTime.value
        };
        
        await apiPut('/api/user/settings', { settings });
        showToast('Profile saved!', 'success');
    } catch (error) {
        console.error('Error saving profile:', error);
        showToast('Failed to save profile', 'error');
    } finally {
        showLoading(false);
    }
}

async function changePassword() {
    const current = elements.currentPassword.value;
    const newPass = elements.newPassword.value;
    const confirm = elements.confirmPassword.value;
    
    if (!current || !newPass || !confirm) {
        showToast('Please fill all fields', 'error');
        return;
    }
    
    if (newPass.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (newPass !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        await apiPut('/api/user/password', { 
            currentPassword: current, 
            newPassword: newPass 
        });
        
        showToast('Password changed successfully!', 'success');
        closeModal('changePasswordModal');
        
        elements.currentPassword.value = '';
        elements.newPassword.value = '';
        elements.confirmPassword.value = '';
    } catch (error) {
        console.error('Error changing password:', error);
        showToast('Failed to change password', 'error');
    } finally {
        showLoading(false);
    }
}

function pauseAutomation() {
    if (!confirm('Are you sure you want to pause automation for all channels?')) return;
    showToast('Automation paused', 'warning');
}

// ==================== API HELPERS ====================

async function apiGet(endpoint) {
    const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${state.token}`,
            'Content-Type': 'application/json'
        }
    });
    return response.json();
}

async function apiPost(endpoint, data) {
    const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${state.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    return response.json();
}

async function apiPut(endpoint, data) {
    const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${state.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    return response.json();
}

// ==================== UI HELPERS ====================

function updateUserInfo() {
    if (state.user) {
        elements.userName.textContent = state.user.name || 'User';
        elements.userEmail.textContent = state.user.email || '';
    }
}

function updateConnectionStatus(connected) {
    const dot = elements.connectionStatus.querySelector('.status-dot');
    const text = elements.connectionStatus.querySelector('.status-text');
    
    dot.classList.toggle('online', connected);
    dot.classList.toggle('offline', !connected);
    text.textContent = connected ? 'Online' : 'Offline';
}

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

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
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
        if (state.isLoggedIn && state.currentPage === 'dashboard') {
            loadSystemStats();
        }
    }, CONFIG.REFRESH_INTERVAL);
}

// Handle OAuth callback (not used anymore - handled in popup)
function handleOAuthCallback() {
    // OAuth callback is now handled in the popup window
    // This function is kept for backward compatibility
    console.log('OAuth callback handler - not used in popup flow');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    handleOAuthCallback();
    init();
});

// Expose functions for onclick handlers
window.openChannelSettings = openChannelSettings;
window.generateVideo = generateVideo;
window.addYouTubeChannel = addYouTubeChannel;
