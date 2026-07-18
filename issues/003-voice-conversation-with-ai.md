# Voice conversation with AI

## Parent

PRD.md — "Locked Architecture > Stack" (token server, Realtime transport).

## What to build

Spoken two-way conversation with gpt-realtime from the phone. A local Express server holds the OpenAI API key and mints ephemeral client secrets (`POST /v1/realtime/client_secrets`); the app fetches a secret over LAN, opens a WebRTC peer connection (react-native-webrtc, `registerGlobals()`, audio-mode setup), streams mic audio up and plays model audio back. Reference implementation: thorwebdev/expo-webrtc-openai-realtime.

The OpenAI API key must never appear in app code or the bundle.

## Acceptance criteria

- [ ] Speaking a question aloud gets a spoken answer from the model on the phone
- [ ] API key lives only in the server process (env var); grep of app source and bundle finds no key
- [ ] Token endpoint reachable from the phone over LAN (works on hotspot too)
- [ ] Session survives at least 2 minutes of back-and-forth without dropping
- [ ] Server start + app connect documented in a README section (two commands max)
- [ ] `npx tsc --noEmit` passes

## User stories

- #3 (voice guidance, hands-free)

## Blocked by

- 001-dev-build-boots-with-live-camera

(Parallel with 002 — different layers.)
