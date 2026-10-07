# Workspace Runtime Contract v1

## Purpose

This document defines the stable contract between the GitHub Actions runtime and the Next.js control plane.

The control plane must treat GitHub Actions as the source of truth for runtime state. It must never infer readiness only from elapsed time or from a single tunnel URL.

## Lifecycle

A workspace follows this lifecycle:

`queued` → `starting` → `backend` → `api_tunnel` → optional `android_build` → optional `android_stream` → `metro` → `expo` → `preview` → `verifying` → `ready`

Terminal states:

- `ready`: all required runtime checks passed and the keep-alive stage started.
- `failed`: a required stage failed.
- `cancelled`: the GitHub Actions run was cancelled.
- `stopping`: the control plane requested cancellation; the final GitHub state is authoritative.

## Runtime markers

The workflow emits machine-readable markers using the form:

`Stage: <stage>`

Important markers:

- `Stage: Android emulator ready`
- `Stage: Android browser stream ready`
- `Stage: LUKMA Android app installed`
- `Stage: LUKMA Android app running`
- `Stage: Expo Web ready`
- `Stage: Creating preview tunnel`
- `Stage: Aligning API CORS`
- `Stage: Verifying runtime`
- `Stage: Workspace ready`

The parser must tolerate missing intermediate markers because GitHub may expose partially indexed logs while a run is active.

## URLs

Runtime URLs are discovered only from workflow markers:

- `API: https://<temporary>.trycloudflare.com`
- `Preview: https://<temporary>.trycloudflare.com`
- `Android: https://<temporary>.trycloudflare.com/?token=<ephemeral-token>`

Android stream tokens are credentials. They may be used to construct the authenticated browser URL, but must never appear in dashboard logs or error messages.

## Readiness

A workspace is not `ready` merely because:

- a process was started;
- a tunnel URL was allocated;
- an emulator booted;
- an APK was built.

Readiness requires the workflow's runtime endpoint verification to pass and the keep-alive stage to start.

## Ownership

Every control-plane request for a run must verify:

`run.actor.login === session.login`

No run ID supplied by the browser is trusted without this check.

## Workspace lifetime

The supported lifetime is 5–60 minutes. The default is 15 minutes.

The control plane and workflow must use the same default. The runtime normalizes invalid values instead of sleeping indefinitely.

## Security

- GitHub access tokens stay server-side.
- GitHub App credentials are repository secrets.
- No PAT fallback is permitted.
- Android stream tokens are generated per workspace.
- Runtime logs are redacted before being returned to the browser.
- Cleanup runs with `if: always()`.

## Reliability rules

Every external runtime dependency must have:

1. bounded startup timeout;
2. retry where readiness can be transient;
3. explicit failure output;
4. cleanup on both success and failure.

Tunnel URLs are not considered reachable until an HTTP request succeeds.

## Developer controls

The control plane will expose:

- status;
- live logs;
- stop;
- restart;
- Android Live;
- Web Preview;
- API endpoint.

Stop and restart are always authorized against the authenticated GitHub account before any GitHub Actions mutation is made.
