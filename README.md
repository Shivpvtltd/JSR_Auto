# JSR_Auto - Tier 1: Render Orchestration Server

YT-AutoPilot Pro का Tier 1 component - Node.js server जो पूरे workflow को orchestrate करता है।

## Features

- **Cron Scheduling**: 12:05 AM IST पर daily workflow trigger
- **GitHub Actions Integration**: 12 sequential workflows को trigger और monitor करता है
- **YouTube OAuth**: Google authentication handling
- **Webhook Management**: GitHub Actions से communication
- **Scheduled Publishing**: 5:00 PM (long) और 5:30 PM (shorts) पर automatic publish
- **Backup System**: 4:00 AM IST पर failed workflow की check और backup trigger

## Project Structure

```
JSR_Auto/
├── src/
│   ├── server.js           # Main Express server
│   ├── routes/
│   │   ├── auth.js         # Google OAuth routes
│   │   ├── webhooks.js     # GitHub Actions webhooks
│   │   ├── status.js       # System status endpoints
│   │   ├── upload.js       # Cloudinary upload routes
│   │   └── publish.js      # YouTube publishing routes
│   └── utils/
│       ├── firebase.js     # Firebase initialization
│       ├── firestore.js    # Database operations
│       ├── youtube.js      # YouTube API operations
│       ├── github.js       # GitHub API operations
│       ├── cloudinary.js   # Cloudinary operations
│       ├── scheduler.js    # Publish scheduling
│       ├── health.js       # Health checks
│       ├── backup.js       # Backup system
│       └── notifications.js # Discord/Slack notifications
├── logs/                   # Application logs
├── public/                 # Static files
├── package.json
└── .env.example
```

## Environment Variables

```env
PORT=3000
NODE_ENV=production
BASE_URL=https://jsr-auto.onrender.com

# Security
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret

# GitHub
GITHUB_TOKEN=ghp_your_token
GITHUB_REPO_OWNER=Shivpvtltd
GITHUB_REPO_NAME=JSR_Automation

# YouTube OAuth
YOUTUBE_CLIENT_ID=your_client_id
YOUTUBE_CLIENT_SECRET=your_client_secret

# Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY=your_private_key
FIREBASE_CLIENT_EMAIL=your_client_email

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Notifications (Optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## API Endpoints

### Health & Status
- `GET /health` - System health check
- `GET /status/system` - System statistics
- `GET /status/episodes` - All episodes list
- `GET /status/episodes/:runId` - Specific episode status
- `GET /status/today` - Today's episode status
- `GET /status/queue` - Queue status

### Authentication
- `GET /auth/youtube` - Initiate YouTube OAuth
- `GET /auth/youtube/callback` - OAuth callback
- `GET /auth/status` - Check auth status
- `POST /auth/logout` - Logout

### Webhooks
- `POST /webhooks/github-actions` - GitHub Actions webhook
- `POST /webhooks/trigger-workflow` - Manual workflow trigger

### Upload
- `POST /upload/cloudinary` - Upload to Cloudinary
- `DELETE /upload/cloudinary/:publicId` - Delete from Cloudinary
- `GET /upload/signature` - Get upload signature

### Publish
- `POST /publish/long/:videoId` - Make long video public
- `POST /publish/shorts/:videoId` - Make shorts public
- `POST /publish/schedule` - Schedule publish
- `GET /publish/status/:videoId` - Get video status

## Cron Schedules (IST - Asia/Kolkata)

| Time | Task |
|------|------|
| 12:05 AM | Main workflow trigger (01-script-generation.yml) |
| 4:00 AM | Backup check (if main failed) |
| 5:00 PM | Make long video PUBLIC |
| 5:30 PM | Make shorts PUBLIC with long video link |

## Deployment

### Render.com

1. Create new Web Service
2. Connect GitHub repository
3. Set environment variables
4. Build Command: `npm install`
5. Start Command: `npm start`

### Local Development

```bash
npm install
npm run dev
```

## Logs

Logs are stored in:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only

View logs:
```bash
npm run logs
```

## License

MIT
