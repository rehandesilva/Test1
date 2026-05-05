# Garage Sync Server

## Setup

### 1. Install dependencies
```bash
cd sync-server
npm install
```

### 2. Configure .env
Fill in your credentials in `.env`:

**Google Drive:**
- Go to https://console.cloud.google.com
- Create a project → Enable Drive API
- Create OAuth2 credentials → get Client ID + Secret
- Get refresh token using OAuth playground: https://developers.google.com/oauthplayground
- Create a folder in Google Drive → copy its ID from the URL

**Mega:**
- Just use your Mega email and password

### 3. Start the server
```bash
npm start
```

Server runs on http://localhost:3001

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/status | Server health + stats |
| GET | /api/data | Get full database |
| POST | /api/data | Save full database |
| POST | /api/sync | Manual sync now |
| GET | /api/backups | List backups |
| POST | /api/backups/restore | Restore a backup |
| GET | /api/logs | Sync log history |

## How it works

1. On startup → fetches latest JSON from Google Drive + Mega, uses newest
2. Every save → pushes to both clouds automatically
3. Every 5 minutes → auto sync
4. Click the sync indicator in the top bar → manual sync now
5. Offline → saves locally, retries on next cycle
6. Keeps last 20 backups in `/backups` folder
