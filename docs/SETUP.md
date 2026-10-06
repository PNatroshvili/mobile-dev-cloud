# Mobile Dev Cloud Setup

## Local control plane
1. Copy .env.example to .env.
2. Create a GitHub OAuth App.
3. Set the callback URL to /api/auth/github/callback.
4. Generate a random SESSION_SECRET with at least 32 characters.
5. Run npm install and npm run dev.

## Free-tier deployment target
The control plane is designed for a Vercel Hobby deployment. Vercel lists Hobby at $0/month and supports Git-based deployment.

## Workspace runtime
The runtime is intentionally separated from the Next.js control plane. The free-first runner uses a standard GitHub Actions Linux runner and a short-lived Cloudflare Quick Tunnel for the browser preview.

The public mobile-dev-cloud repository can use GitHub-hosted standard runners without consuming private-repository Actions minutes for the control-plane CI. The runtime workflow itself checks out the selected private LUKMA repositories, so the GitHub App installation and repository access described below are required.

## Private LUKMA repositories
LUKMA mobile and API are private. The runtime workflow does not accept personal access tokens through inputs and does not contain a PAT fallback.

Required setup:
1. Create a GitHub App owned by the GitHub account or organization that owns the LUKMA repositories.
2. Grant the App **Contents: Read-only** permission.
3. Install the App only on:
   - `PNatroshvili/lukma-mobile`
   - `PNatroshvili/lukma-api`
4. Add these repository secrets to `PNatroshvili/mobile-dev-cloud`:
   - `MOBILE_DEV_CLOUD_APP_ID`
   - `MOBILE_DEV_CLOUD_APP_PRIVATE_KEY`
5. Never put the private key in source code, workflow inputs, or client-side environment variables.

The workflow mints a short-lived installation token with `actions/create-github-app-token@v2` and uses that token only for the private repository checkouts.

## Starting a workspace manually
Until the control plane has a workflow-dispatch integration, the runtime can be tested from **GitHub → Actions → Mobile Workspace → Run workflow**.

Use:
- `mobile_repo`: `PNatroshvili/lukma-mobile`
- `mobile_ref`: `feature/home-discovery-foundation`
- `api_repo`: `PNatroshvili/lukma-api`
- `api_ref`: `feat/auth-api`
- `session_minutes`: `30`

A successful run starts the API, creates a temporary API tunnel, starts Expo Web, creates a temporary preview tunnel, aligns API CORS to that preview origin, and keeps the workspace alive for the requested session.

## Runtime limitations
An Android emulator requires KVM and considerably more CPU/RAM than the browser control plane. The browser Expo preview is the first target; native Android streaming is a separate runtime stage.

## Security
Never commit .env files, GitHub tokens, OAuth client secrets, emulator credentials, or production database secrets. Keep the GitHub App installation restricted to the two required private repositories and keep its repository permission read-only.
