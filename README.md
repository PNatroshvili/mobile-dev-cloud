# Mobile Dev Cloud

Cloud development workspace for React Native / Expo applications.

## Goal

GitHub repository -> cloud workspace -> backend + Expo runtime -> live browser preview.

## MVP

- Next.js dashboard
- GitHub repository/branch selection
- Secure workspace configuration
- Expo Web preview foundation
- Backend/runtime orchestration foundation
- Live status and logs
- Free-tier friendly deployment architecture

## Roadmap

1. Dashboard and workspace model
2. GitHub integration
3. Runtime orchestration
4. Live Expo preview
5. Terminal and logs
6. Android cloud emulator
7. Build artifacts


## Current implementation

- Next.js + TypeScript control plane
- GitHub OAuth with encrypted HTTP-only sessions
- Repository and branch API endpoints
- Workspace start API
- Docker foundation for PostgreSQL, Redis and Mailpit
- Workspace runtime Docker image
- GitHub Actions CI for typecheck, lint and build
- Architecture and setup documentation

## Runtime direction

The next runtime layer uses GitHub Actions as the first free compute pool, with Expo/Metro and the LUKMA backend running on an ephemeral Linux workspace. The browser preview is exposed through a temporary tunnel. A GitHub App is the preferred way to grant short-lived access to private LUKMA repositories.

See docs/ARCHITECTURE.md and docs/SETUP.md.
