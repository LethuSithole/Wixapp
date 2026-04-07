# Deployment & GitHub Setup

## GitHub Repository

### Create a New Repository

1. Go to [GitHub](https://github.com)
2. Click "New repository"
3. Name: `wix-hubspot-integration`
4. Description: "Secure bi-directional contact sync between Wix and HubSpot"
5. Visibility: Public (or Private if preferred)
6. Click "Create repository"

### Push to GitHub

After creating the repo on GitHub, run:

```bash
cd "c:\Users\Lethukuthula\Desktop\Wix App"

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/wix-hubspot-integration.git

# Rename branch and push
git branch -M main
git push -u origin main
```

**Expected Output:**

```
Enumerating objects: 16, done.
...
 * [new branch]      main -> main
Branch 'main' is set to track remote branch 'main' from 'origin'.
```

### Repository Contents

After pushing, your GitHub repo will include:

```
wix-hubspot-integration/
├── README.md                              # Project overview & setup
├── API_PLAN.md                            # Detailed API + architecture design
├── TESTING.md                             # Test scenarios & verification guide
├── DEPLOYMENT.md                          # This file
│
├── .env.example                           # Template (commited)
├── .gitignore                             # Git ignore rules
├── package.json                           # Dependencies
│
├── src/
│   ├── App.tsx                            # React dashboard UI
│   ├── main.tsx                           # Entry point
│   └── index.css                          # Styles
│
├── server/
│   ├── index.js                           # Express backend
│   └── data/
│       ├── storage.json                   # Site configs
│       └── sync_log.json                  # Sync history
│
├── dist/                                  # Build artifacts (generated)
└── node_modules/                          # Dependencies (ignored)
```

---

## Test Account Setup

### For Testing Without Real HubSpot

**Site ID:**

```
demo-site
```

**Sample Contact:**

```
Email:       jane.doe@example.com
First Name:  Jane
Last Name:   Doe
Company:     Wix App
Custom:      HubSpot sync demo
```

**Steps:**

1. Start backend: `npm run dev:server`
2. Start frontend: `npm run dev`
3. Visit `http://localhost:5173`
4. Button "Connect HubSpot" is clickable but doesn't require real creds for UI testing
5. Fill mapping and select forms
6. Click "Send sample submission" to test sync UI flow

### For Production Testing (Real HubSpot)

**Create HubSpot Developer Account:**

1. Go to [HubSpot Developers](https://developers.hubspot.com)
2. Sign up / Log in
3. Create a new app

**Get OAuth Credentials:**

1. In app settings, go to "Auth"
2. Copy `Client ID` and `Client Secret`
3. Set redirect URI: `http://localhost:4000/api/hubspot/oauth/callback`
4. Add scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `forms`
   - `automation`

**Update `.env`:**

```bash
cp .env.example .env
```

Edit `.env`:

```
HUBSPOT_CLIENT_ID=<your_client_id>
HUBSPOT_CLIENT_SECRET=<your_client_secret>
HUBSPOT_REDIRECT_URI=http://localhost:4000/api/hubspot/oauth/callback
PORT=4000
```

**Test the Integration:**

1. Start backend: `npm run dev:server`
2. Start frontend: `npm run dev`
3. Click "Connect HubSpot" → You'll be redirected to HubSpot's OAuth screen
4. Authorize the app
5. Map fields and select forms
6. Send sample submission
7. Check HubSpot Contacts → Contact created with UTC properties

---

## Test Username & Credentials

### Demo Testing

- **Site ID**: `demo-site`
- **No login required** - All features testable with UI simulation
- **Backend Mock Data**: Pre-populated sample contact at `jane.doe@example.com`

### Real Integration Testing

**Test User Email (for HubSpot):**

```
YOUR_EMAIL@example.com
```

**HubSpot Test Account:**

- Create free trial at [HubSpot](https://www.hubspot.com/free)
- Or use existing HubSpot account

**Test Contacts:**

```
✓ jane.doe@example.com (will be created on first sync)
✓ test.user@example.com (secondary test)
✓ utm.test@example.com (for UTM tracking test)
```

### OAuth Flow Credentials

**Do NOT commit real credentials to GitHub.** Instead:

1. `.env.example` → Template with placeholder values
2. `.env` → Local file with real credentials (ignored by git)
3. GitHub Secrets (for CI/CD) → Use repository secrets

**Example `.env`:**

```bash
# Development
HUBSPOT_CLIENT_ID=your_dev_client_id
HUBSPOT_CLIENT_SECRET=your_dev_client_secret
HUBSPOT_REDIRECT_URI=http://localhost:4000/api/hubspot/oauth/callback
PORT=4000

# Optional: Test mode (bypass real API)
HUBSPOT_TEST_MODE=false
```

**For GitHub Actions CI/CD (if added):**

1. Go to repo Settings → Secrets → Actions
2. Add:
   - `HUBSPOT_CLIENT_ID`
   - `HUBSPOT_CLIENT_SECRET`
   - `HUBSPOT_REDIRECT_URI`

---

## Build & Deployment

### Local Development

```bash
# Terminal 1: Backend
npm run dev:server
# Output: 🚀 HubSpot Wix Integration backend running on http://localhost:4000

# Terminal 2: Frontend
npm run dev
# Output: Local: http://localhost:5173
```

### Production Build

```bash
npm run build
# Output: dist/ folder with optimized assets

npm run preview
# Serve production build locally at http://localhost:4173
```

### Deploy to Cloud

**Option 1: Railway (Recommended for Node + React)**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
railway init

# Deploy
railway up
```

**Option 2: Vercel (For Frontend)**

```bash
# Deploy frontend (dist/) to Vercel
vercel deploy
```

Then deploy backend separately to Railway/Heroku.

**Option 3: Docker**

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 4000 5173
CMD ["npm", "run", "dev:server"]
```

---

## Continuous Integration (Optional)

### GitHub Actions Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm test # if tests are added
```

---

## Security Checklist

Before sharing repo publicly:

- [ ] `.env` is in `.gitignore` (credentials not committed)
- [ ] No API keys in source code
- [ ] CORS is configured securely
- [ ] Webhook signatures validated
- [ ] Secrets stored in environment variables
- [ ] HTTPS enforced in production
- [ ] Rate limiting enabled
- [ ] Error messages don't expose sensitive info

---

## Documentation Links

**In This Repo:**

- [README.md](./README.md) - Quick start & overview
- [API_PLAN.md](./API_PLAN.md) - Detailed architecture & API design
- [TESTING.md](./TESTING.md) - Test scenarios & verification

**External:**

- [HubSpot API Docs](https://developers.hubspot.com/docs/api/overview)
- [Wix App Framework](https://dev.wix.com/docs)
- [React Docs](https://react.dev)
- [Express.js Docs](https://expressjs.com)

---

## Troubleshooting Deployment

### Issue: Port 4000 already in use

```bash
# Kill process on port 4000
lsof -ti:4000 | xargs kill -9
```

### Issue: CORS errors

- Ensure backend is running on `http://localhost:4000`
- Frontend proxy in `vite.config.ts` is correct

### Issue: OAuth callback fails

- Check `HUBSPOT_REDIRECT_URI` in `.env`
- Must match exactly in HubSpot app settings
- Include port number: `http://localhost:4000/api/hubspot/oauth/callback`

### Issue: Build fails

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

---

## Next Steps

1. **Push to GitHub** → Follow "Create a New Repository" section above
2. **Add Collaborators** → GitHub repo Settings → Collaborators
3. **Set up CI/CD** → Add GitHub Actions workflow (optional)
4. **Deploy to Production** → Choose cloud provider (Railway/Vercel/AWS)
5. **Set up Monitoring** → Monitor backend logs and error rates
6. **Document API** → Generate API docs with Swagger/OpenAPI (optional)

---

## Questions?

Refer to:

- Project README for overview
- API_PLAN.md for architectural details
- TESTING.md for verification steps
- Inline code comments for implementation details
