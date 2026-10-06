# Mobile Dev Cloud Architecture

## Goal
Turn a GitHub-hosted React Native / Expo project into a browser-accessible development workspace.

## Core flow
1. Authenticate with GitHub.
2. Select a repository and branch.
3. Create a workspace definition.
4. Workspace runner checks out the selected commit.
5. Start backend dependencies and Expo/Metro in an isolated runtime.
6. Expose preview traffic through a secure tunnel.
7. File changes trigger Fast Refresh.
8. Later, attach an Android emulator stream to the same workspace.

## Control plane
- Next.js App Router
- TypeScript
- GitHub OAuth
- GitHub repository and branch APIs
- PostgreSQL for durable workspace metadata
- Redis for workspace state, events, and queues

## Runtime plane
The runtime is intentionally separate from Vercel serverless functions because Expo Metro, terminals, and backend processes are long-running.

The workspace runner will manage Git checkout, Node and Expo dependencies, process lifecycle, port allocation, WebSocket terminal, logs, health checks, and preview tunneling.

Docker is the first runtime abstraction. It can later move to a VM or container service without changing the dashboard contract.

## Preview modes
### Expo Web
Lowest-cost preview. Start Expo Web inside the workspace and expose it to the browser.

### Android Emulator
A Linux runtime will run Android Emulator with hardware acceleration where available. Emulator display and input are streamed to the browser. This is the resource-heavy part and is intentionally isolated from the free control plane.

The workspace API exposes a stable runtime capability contract for backend, API tunnel, Expo, preview, and Android. Android remains explicitly `false` until an emulator-capable runner and browser streaming transport are attached, so the dashboard never implies native Android readiness prematurely.

## Security
- GitHub tokens never enter browser JavaScript.
- OAuth state is validated.
- Sessions use HTTP-only encrypted cookies.
- Workspace processes are isolated from the control plane.
- Secrets live in environment configuration, never repository files.
- No destructive dependency or CI shortcuts are used.