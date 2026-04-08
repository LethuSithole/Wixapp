# GitHub Actions Workflows

This directory contains GitHub Actions workflows for the Wix HubSpot Integration project.

## Available Workflows

### 🔄 CI (`ci.yml`)

- **Triggers**: Push/PR to main/master
- **Purpose**: Build and test the application
- **Features**:
  - Multi-Node.js version testing (18.x, 20.x)
  - TypeScript type checking
  - Build verification
  - Backend health check

### 🚀 Deploy to Railway (`deploy-railway.yml`)

- **Triggers**: Push to main/master or manual
- **Purpose**: Deploy full-stack app to Railway
- **Requirements**:
  - `RAILWAY_TOKEN` secret in GitHub

### 🌐 Deploy Frontend to Vercel (`deploy-vercel.yml`)

- **Triggers**: Push to main/master or manual
- **Purpose**: Deploy frontend to Vercel
- **Requirements**:
  - `VERCEL_TOKEN` secret
  - `VERCEL_ORG_ID` secret
  - `VERCEL_PROJECT_ID` secret

### 🧹 Code Quality (`code-quality.yml`)

- **Triggers**: Push/PR to main/master
- **Purpose**: Lint and format code
- **Features**:
  - TypeScript type checking
  - ESLint (when configured)
  - Prettier (when configured)

### 🔒 Security Checks (`security.yml`)

- **Triggers**: Push/PR + weekly schedule
- **Purpose**: Security scanning and vulnerability checks
- **Features**:
  - npm audit
  - Snyk security scan (when configured)
  - Secret detection in code

### 🧪 Test Suite (`test.yml`)

- **Triggers**: Push/PR to main/master
- **Purpose**: Run automated tests
- **Features**:
  - Test execution
  - Coverage reporting
  - Codecov integration

### 📦 Dependency Updates (`dependency-updates.yml`)

- **Triggers**: Monthly schedule or manual
- **Purpose**: Keep dependencies updated
- **Features**:
  - Automated dependency updates
  - PR creation for updates
  - Build verification

### 🏷️ Release (`release.yml`)

- **Triggers**: Git tag push (v*.*.\*)
- **Purpose**: Create GitHub releases
- **Features**:
  - Release creation
  - Asset upload
  - Release notes template

## Setup Instructions

### 1. Required GitHub Secrets

Add these secrets in your repository Settings → Secrets → Actions:

#### For Railway Deployment:

```
RAILWAY_TOKEN=your_railway_token
```

#### For Vercel Deployment:

```
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_org_id
VERCEL_PROJECT_ID=your_project_id
```

#### For HubSpot Integration (if needed in CI):

```
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret
```

### 2. Getting Tokens

#### Railway Token:

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Get token: `railway tokens create`

#### Vercel Tokens:

1. Go to Vercel Dashboard → Settings → Tokens
2. Create a new token
3. Get Org ID and Project ID from your project settings

### 3. Enable/Disable Workflows

To disable a workflow, rename the file extension from `.yml` to `.yml.disabled`

### 4. Manual Triggers

Workflows with `workflow_dispatch` can be triggered manually from the Actions tab.

## Workflow Status Badges

Add these badges to your README:

```markdown
![CI](https://github.com/LethuSithole/Wixapp/workflows/CI/badge.svg)
![Code Quality](https://github.com/LethuSithole/Wixapp/workflows/Code%20Quality/badge.svg)
![Security](https://github.com/LethuSithole/Wixapp/workflows/Security%20Checks/badge.svg)
```

## Troubleshooting

### Workflow Fails

1. Check the Actions tab for detailed logs
2. Verify all required secrets are set
3. Ensure Node.js version compatibility
4. Check for syntax errors in workflow files

### Deployment Issues

1. Verify tokens are correct and have proper permissions
2. Check deployment platform quotas/limits
3. Ensure environment variables are set in deployment platform

### Dependency Updates

- Reviews PRs created by dependency updates workflow
- Test thoroughly before merging
- Update version numbers in package.json if needed
