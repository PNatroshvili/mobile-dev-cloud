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

### Completed

1. Dashboard and workspace model
2. GitHub OAuth and repository/branch selection
3. Secure GitHub App access to private LUKMA repositories
4. Ephemeral GitHub Actions workspace runtime
5. Backend + Postgres/PostGIS + Redis + MinIO + Mailpit startup
6. Expo Web live preview through Cloudflare Quick Tunnel
7. Runtime status, logs, recovery, stop, and restart controls
8. Android 35 emulator with KVM acceleration
9. Real LUKMA Android build/install/run verification
10. Authenticated browser Android streaming with serve-emu
11. Runtime readiness verification and cleanup

### Next

12. End-to-end Dashboard control testing against a deployed control plane
13. Terminal/input controls and richer runtime logs
14. Workspace UX polish and error/recovery states
15. Production deployment and environment validation
16. Build artifacts and downloadable APK/AAB workflow
17. Usage limits, quotas, concurrency and abuse protection
18. Persistent workspace history and project-level settings


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
