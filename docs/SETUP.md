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
The runtime is intentionally separated from the Next.js control plane. The planned free-first runner uses a standard GitHub Actions Linux runner and a short-lived Cloudflare Tunnel for the browser preview.

GitHub-hosted standard runners are free and unlimited for public repositories. Private repositories consume the account's included Actions minutes. The mobile-dev-cloud repository is public, so its standard runner can be used as the free control-plane runtime.

## Private LUKMA repositories
LUKMA mobile and API are private. A runner token must therefore be authorized to read those repositories. Do not put a personal access token in workflow inputs or source code.

Preferred production solution: install a GitHub App with read access to the selected private repositories and mint short-lived installation tokens at runtime.

Fallback for a personal-only MVP: store a narrowly scoped GitHub token as a repository secret in mobile-dev-cloud. The token must only have the minimum repository access required.

## Runtime limitations
An Android emulator requires KVM and considerably more CPU/RAM than the browser control plane. The browser Expo preview is the first target; native Android streaming is a separate runtime stage.

## Security
Never commit .env files, GitHub tokens, OAuth client secrets, emulator credentials, or production database secrets.