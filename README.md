# Wix-HubSpot Integration App

A secure, bi-directional contact sync integration between Wix and HubSpot with form capture, field mapping, and loop prevention.

## Features

✅ **OAuth 2.0 HubSpot Connection** - Secure token-based authentication  
✅ **Bi-Directional Contact Sync** - Sync contacts between Wix and HubSpot  
✅ **Infinite Loop Prevention** - Deduplication window + source tracking + idempotency  
✅ **Form Submission Capture** - Push Wix/HubSpot form submissions with UTM attribution  
✅ **Field Mapping UI** - User configurable Wix field → HubSpot property mapping  
✅ **Sync Activity Logging** - View connection and sync history

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- HubSpot Developer Account

### Setup

1. **Clone the repo**

   ```bash
   cd "Wix App"
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Create `.env` file** (from `.env.example`)

   ```bash
   cp .env.example .env
   ```

4. **Add HubSpot OAuth credentials to `.env`**

   ```
   HUBSPOT_CLIENT_ID=<your_client_id>
   HUBSPOT_CLIENT_SECRET=<your_client_secret>
   HUBSPOT_REDIRECT_URI=http://localhost:4000/api/hubspot/oauth/callback
   PORT=4000
   ```

5. **Start the backend** (in one terminal)

   ```bash
   npm run dev:server
   ```

   Output: `🚀 HubSpot Wix Integration backend running on http://localhost:4000`

6. **Start the frontend** (in another terminal)

   ```bash
   npm run dev
   ```

   Output: `Local: http://localhost:5173`

7. **Open the dashboard**
   - Visit `http://localhost:5173`
   - Click "Connect HubSpot"
   - Authorize with your HubSpot account
   - Configure form sync and field mapping
   - Test sync with "Send sample submission"

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Frontend (React + TypeScript)                  │
│  - OAuth Connect/Disconnect UI                                  │
│  - Field Mapping Configuration Table                            │
│  - Form Selection Checkboxes                                    │
│  - Activity Log Display                                         │
│  - Sample Form Submission Tester                                │
└─────────────┬──────────────────────────────────────────────────┘
              │
    API Calls │ /api/*
              │
┌─────────────▼──────────────────────────────────────────────────┐
│              Backend (Node.js + Express)                        │
│  - OAuth Token Management (Secure Storage, Auto-Refresh)       │
│  - HubSpot API Integration (Contacts, Properties, Webhooks)    │
│  - Sync State Tracking (Loop Prevention, Deduplication)        │
│  - Multi-Tenant Configuration (Per-Site Settings)              │
│  - Form Submission Handler (UTM Attribution)                   │
└─────────────┬──────────────────────────────────────────────────┘
              │
    HTTP      │ OAuth 2.0, REST
              │
┌─────────────▼──────────────────────────────────────────────────┐
│              HubSpot API                                         │
│  - CRM Contacts API                                             │
│  - Properties API                                               │
│  - Webhooks API                                                 │
│  - OAuth Token Endpoint                                         │
└──────────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Method    | Endpoint                       | Description                        |
| --------- | ------------------------------ | ---------------------------------- |
| GET       | `/api/hubspot/status`          | Check HubSpot connection status    |
| GET       | `/api/hubspot/oauth/start`     | Initiate OAuth flow                |
| GET       | `/api/hubspot/oauth/callback`  | OAuth callback handler             |
| POST      | `/api/hubspot/disconnect`      | Revoke HubSpot connection          |
| POST      | `/api/sync/contact`            | Sync single contact to HubSpot     |
| POST      | `/api/sync/form-submission`    | Capture form submission with UTM   |
| GET       | `/api/sync/activity`           | Retrieve sync history (last 20)    |
| GET\|POST | `/api/settings/mapping`        | Get/save field mapping config      |
| GET\|POST | `/api/settings/forms`          | Get/save form selection config     |
| POST      | `/api/webhook/hubspot/contact` | Webhook for HubSpot contact events |

## Data Models

### Sync Config (Per Site)

```json
{
  "siteId": "demo-site",
  "oauth": {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": 1712517600000,
    "scopes": ["crm.objects.contacts.read", ...]
  },
  "fieldMapping": {
    "email": "email",
    "firstName": "firstname",
    "lastName": "lastname",
    "company": "company",
    "customField": "custom_property"
  },
  "syncDirection": "bi-directional",
  "conflictResolution": "last-updated-wins"
}
```

### Sync Log Entry

```json
{
  "siteId": "demo-site",
  "contactId": "jane.doe@example.com",
  "externalId": "601",
  "source": "wix",
  "operation": "create|update|form_submission",
  "syncId": "uuid-string",
  "timestamp": 1712347200000,
  "status": "success"
}
```

## Loop Prevention Strategy

1. **Sync Correlation ID** - Each sync operation gets a unique `syncId`
2. **Source Tracking** - Track which system initiated change (wix|hubspot)
3. **Deduplication Window** - 5-second window to skip webhook events from our own writes
4. **Idempotency** - Compare values before updating; skip if identical
5. **Sync State Log** - TTL of 30 days; allows replay detection

## Testing Credentials

For demo testing without real HubSpot account:

### Test Site

- **Site ID**: `demo-site`
- **Email**: `test@example.com`
- **First Name**: `Demo`
- **Last Name**: `User`

### Mock HubSpot Flow

1. Click "Connect HubSpot" → You'll see the OAuth flow would trigger here
2. In `.env`, set test mode:
   ```
   HUBSPOT_TEST_MODE=false  # Set to true to skip real API calls
   ```
3. Run "Send sample submission" → See sync log update

### Real HubSpot Setup

1. Create HubSpot app: https://developers.hubspot.com/docs/api/creating-an-app
2. Get OAuth credentials:
   - Client ID
   - Client Secret
   - Scopes: `crm.objects.contacts.read`, `crm.objects.contacts.write`, `forms`, `automation`
3. Add credentials to `.env`
4. Test with your own HubSpot account

## File Structure

```
Wix App/
├── .env                          # Environment variables (not in git)
├── .env.example                  # Template for .env
├── API_PLAN.md                   # Detailed API and architecture plan
├── README.md                     # This file
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript config
├── vite.config.ts                # Vite build config
│
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Dashboard UI component
│   └── index.css                 # Styles
│
├── server/
│   ├── index.js                  # Express backend server
│   └── data/
│       ├── storage.json          # Site configs (JSON file storage)
│       └── sync_log.json         # Sync operation history
│
└── dist/                         # Build output (generated)
```

## Development & Scripts

```bash
# Frontend development
npm run dev                    # Start Vite dev server (port 5173)

# Backend development
npm run dev:server            # Start Node backend (port 4000)

# Production build
npm run build                 # TypeScript + Vite build

# Preview production build
npm run preview               # Serve dist/ locally
```

## Error Handling

- **Network errors**: Exponential backoff (3 retries)
- **Rate limit (429)**: Check `Retry-After` header
- **Invalid token (401)**: Auto-refresh or prompt reconnect
- **Conflicts**: Apply `conflictResolution` rule
- **Webhooks**: Dedup window prevents infinite loops

## Security

✅ OAuth 2.0 with secure token storage  
✅ No API keys in frontend  
✅ HTTPS recommended for production  
✅ CORS enabled for local development  
✅ Webhook signature validation (placeholder)  
✅ Never log tokens or PII

## Next Steps

1. **Wix Integration**: Use Wix CLI/App Framework to deploy this as an official Wix app
2. **Database**: Replace JSON file storage with PostgreSQL/MongoDB
3. **Queue System**: Add BullMQ/Redis for reliable sync queuing
4. **Monitoring**: Implement error tracking (Sentry) and analytics
5. **Testing**: Add unit tests + integration tests
6. **Webhook Registration**: Auto-register HubSpot webhooks on connect

## Support

For issues or questions:

- Check `API_PLAN.md` for detailed architecture
- Review sync logs in the dashboard
- Check backend console for error messages

## License

MIT
