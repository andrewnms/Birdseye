# Dev build boots with live camera

## Parent

PRD.md — "Locked Architecture" section.

## What to build

Get the custom dev build running on a physical phone with a full-screen live camera feed. Run prebuild, build the dev client, and replace the placeholder App screen with a camera view. Camera and microphone permission prompts must appear with the Birdseye usage strings and the feed must render after granting.

This is the tracer bullet through the native layer: if this works, every native module (camera, gl, webrtc, sensors) is compiled and loadable.

## Acceptance criteria

- [ ] `npx expo prebuild` succeeds and the dev build installs on a physical device
- [ ] App launches to a full-screen live camera feed (no Expo Go)
- [ ] Camera + microphone permission prompts show the Birdseye usage strings on first launch
- [ ] Denying then re-granting permission in Settings recovers without a crash
- [ ] `npx tsc --noEmit` passes

## User stories

- #14 (judge sees a live use case — foundation)

## Blocked by

None - can start immediately
