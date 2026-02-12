# JSR_Auto - YouTube Automation Server

Render-hosted orchestration server for automated YouTube content management.

## 🎯 Overview

This server handles:
- **Scheduling**: 4 cron jobs for video generation and publishing
- **YouTube API**: Upload videos as UNLISTED, manage visibility
- **GitHub Integration**: Triggers JSR_Automation workflows
- **Visibility Management**: Publishes videos at scheduled times (5:00 PM, 5:30 PM)
- **Webhooks**: Receives notifications from GitHub Actions

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      JSR_Auto Server                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  12:05 AM    │  │   4:00 AM    │  │   5:00 PM    │     │
│  │ Main Trigger │  │Backup Trigger│  │Publish Long  │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                  │              │
│         ▼                 ▼                  ▼              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              GitHub Actions Trigger                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              YouTube API Integration                │   │
│  │  - Upload (UNLISTED)                                │   │
│  │  - Visibility Management                            │   │
│  │  - Description Updates                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Firebase Firestore                     │   │
│  │  - Video Status                                     │   │
│  │  - Workflow Tracking                                │   │
│  │  - Episode Management                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Directory Structure

```
src/
├── server.js           # Main Express server with cron jobs
├── scheduler/          # Cron job handlers
│   ├── mainTrigger.js      # 12:05 AM - Video generation
│   ├── backupTrigger.js    # 4:00 AM - Backup check
│   ├── publishLong.js      # 5:00 PM - Long videos public
│   └── publishShorts.js    # 5:30 PM - Shorts public
├── routes/             # API routes
│   ├── auth.js            # Google OAuth
│   ├── webhooks.js        # GitHub/Cloudinary webhooks
│   ├── status.js          # System status
│   └── upload.js          # Manual upload endpoints
└── utils/              # Utilities
    ├── firebase.js        # Firebase initialization
    ├── firestore.js       # Database operations
    ├── youtube.js         # YouTube API
    ├── github.js          # GitHub API
    └── health.js          # Health checks
```

## ⏰ Scheduler Timeline

| Time (IST) | Scheduler | Action |
|------------|-----------|--------|
| 12:05 AM | Main Trigger | Triggers JSR_Automation for video generation |
| 4:00 AM | Backup Check | Checks if main run succeeded, triggers backup if needed |
| 5:00 PM | Publish Long | Changes long videos from UNLISTED → PUBLIC |
| 5:30 PM | Publish Shorts | Changes shorts from UNLISTED → PUBLIC + adds long video link |

## 🔄 Data Flow

```
12:05 AM: JSR_Auto triggers JSR_Automation
    ↓
JSR_Automation: Script → Audio → Assets → Thumbnail → Video
    ↓
Upload to Cloudinary
    ↓
Webhook to JSR_Auto: /webhooks/cloudinary-ready
    ↓
JSR_Auto: Download from Cloudinary → Upload to YouTube (UNLISTED)
    ↓
Firestore: Store videoId + scheduledPublishTime
    ↓
5:00 PM: JSR_Auto changes visibility to PUBLIC
    ↓
5:30 PM: JSR_Auto changes shorts visibility + adds long video link
```

## 🔧 Setup

### 1. Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
cp .env.example .env
```

Required variables:
- `YOUTUBE_CLIENT_ID` - From Google Cloud Console
- `YOUTUBE_CLIENT_SECRET` - From Google Cloud Console
- `GITHUB_TOKEN` - Personal access token with repo access
- `GITHUB_REPO_OWNER` - Your GitHub username
- `GITHUB_REPO_NAME` - JSR_Automation
- `FIREBASE_SERVICE_ACCOUNT_JSON` - From Firebase Console

### 2. Deploy to Render

1. Create new Web Service on Render
2. Connect your GitHub repository
3. Set environment variables in Render Dashboard
4. Deploy!

### 3. YouTube OAuth Setup

1. Visit `https://your-render-url/auth/youtube`
2. Complete Google OAuth flow
3. Tokens are automatically stored in Firestore

## 🌐 API Endpoints

### Health Check
```
GET /health
```

### Status
```
GET /status              # System health
GET /status/github-usage # GitHub Actions usage
GET /status/videos       # Recent videos
GET /status/workflows    # Workflow history
GET /status/schedulers   # Scheduler configuration
```

### Authentication
```
GET /auth/youtube          # Start YouTube OAuth
GET /auth/youtube/callback # OAuth callback
GET /auth/status           # Check auth status
GET /auth/logout           # Logout
```

### Webhooks (GitHub Actions → JSR_Auto)
```
POST /webhooks/github-actions   # Workflow notifications
POST /webhooks/cloudinary-ready # Upload complete trigger
POST /webhooks/manual-trigger   # Manual scheduler trigger
```

### Upload (Manual)
```
POST /upload/youtube     # Manual video upload
POST /upload/visibility  # Update video visibility
```

## 📊 Database Schema

### Videos Collection
```javascript
{
  videoId: "string",
  type: "long" | "short",
  title: "string",
  status: "uploaded" | "published",
  visibility: "unlisted" | "public",
  uploadDate: "YYYY-MM-DD",
  scheduledFor: "17:00" | "17:30",
  youtubeUrl: "string",
  longVideoUrl: "string", // For shorts
  cloudinaryUrls: {
    video: "string",
    thumbnail: "string"
  }
}
```

### Workflows Collection
```javascript
{
  runId: "string",
  status: "triggered" | "uploaded" | "published" | "failed",
  category: "string",
  subCategory: "string",
  episode: number,
  triggerType: "main" | "backup",
  triggeredAt: "ISO timestamp"
}
```

### Episodes Collection
```javascript
{
  episode: number,
  mainCategory: "string",
  subCategory: "string",
  generatedAt: "ISO timestamp"
}
```

## 🛠️ Development

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run in production mode
npm start
```

### Testing Schedulers

```bash
# Trigger main generation
curl -X POST https://your-url/webhooks/manual-trigger \
  -H "Content-Type: application/json" \
  -d '{"trigger": "main"}'

# Trigger publish long
curl -X POST https://your-url/webhooks/manual-trigger \
  -H "Content-Type: application/json" \
  -d '{"trigger": "publish-long"}'
```

## 🔒 Security

- Rate limiting: 100 requests per 15 minutes
- Helmet.js for security headers
- CORS configured for allowed origins
- Session-based authentication

## 📄 License

Private - For JSR Auto use only
