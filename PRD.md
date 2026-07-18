# PRD: Applied Real-World Learning App

## Problem Statement
People can generate learning plans with ChatGPT, YouTube, and courses, but they still have to stitch resources together themselves, stay motivated alone, and translate abstract instructions into real-world action. Existing tools explain things, but they do not reliably help users complete real-world tasks with feedback and accountability.

## Solution
A mobile learning product for applied, real-world education using live camera, spatial annotations, and voice guidance. Users state a goal, the app guides them step by step in context, overlays instructions on real-world objects, and checks whether each step was completed. For the hackathon demo, the scoped use case is origami in Expo using OpenAI Realtime API plus positional/spatial overlays.

## User Stories
1. As a learner, I want to enter a real-world goal, so that I can get tailored guidance.
2. As a learner, I want the app to ask clarifying questions, so that the plan matches my actual constraints.
3. As a learner, I want voice guidance, so that I can learn hands-free.
4. As a learner, I want camera-based instruction overlays, so that I can see what to do in physical space.
5. As a learner, I want annotations anchored to objects, so that guidance stays aligned as I move.
6. As a learner, I want step-by-step progression, so that I can focus on one action at a time.
7. As a learner, I want the app to verify completed steps, so that I know I'm doing it correctly.
8. As a learner, I want a saved learning path, so that I can return later.
9. As a learner, I want short, actionable lessons, so that I can make progress quickly.
10. As a learner, I want the app to feel more engaging than chat, so that I stay motivated.
11. As a learner, I want accountability nudges, so that I follow through.
12. As a learner, I want a visual dashboard of my plan, so that I can understand the full process.
13. As a learner, I want the app to adapt to different goals, so that it works beyond one demo.
14. As a hackathon judge, I want to see a live use case, so that I believe the product works.
15. As a hackathon judge, I want to see multiple example domains, so that I know it's not narrowly scripted.
16. As a product team member, I want a fallback recorded demo, so that we can still present if live reliability fails.
17. As a future learner, I want social/community learning features, so that I can learn alongside others.
18. As a future learner, I want matched peers or shared paths, so that learning feels collaborative.
19. As a creator, I want the AI expert persona to feel consistent, so that the product is memorable.
20. As a learner, I want "applied learning" focused on solving the task, so that I get outcomes, not just explanations.

## Implementation Decisions
- Primary product direction: applied learning in the real world, not generic curriculum chat.
- Core differentiator: spatial interaction with the real world, not just camera-aware conversation.
- Hackathon scope reduced to a single strong demo: origami.
- Tech direction discussed:
  - React Native with Expo
  - OpenAI Realtime API for voice + generation
  - Spatial/positional awareness via open-source library
  - Three.js-style simple overlays/annotations
- 3D textured model generation is out of scope for the demo.
- Demo should use simple wireframe/pen-style annotations only.
- User flow:
  1. User starts with a goal
  2. Camera opens
  3. AI provides voice guidance
  4. Spatial overlays show the next step
  5. App checks progress and advances
- Product should eventually support pre-qualification/grilling questions like "Do you have an oven?" before generating plans.
- Product positioning should emphasize "learning made simple in the real world" / "applied learning."
- The AI persona/branding should feel character-based and memorable.

## Locked Architecture (grilling session, 2026-07-18)

### Win condition
A judge folds a real origami model by following the app's voice guidance and on-screen 3D annotations, tapping or saying "done" to advance each step. Voice is load-bearing, overlays are the wow factor, verification is self-reported (tap/voice) — no live vision-based fold detection.

### Planner / Executor split
- **Planner** (strong reasoning model, e.g. GPT-5.x/Codex-class): runs per goal, outputs the full lesson as JSON — ordered steps, narration text, overlay primitives with normalized coordinates. Rough wireframe 3D model generation (vertex/face JSON) is a stretch goal, only after the core loop works.
- **Executor** (`gpt-realtime` over WebRTC): narrates each step and fires a `render_overlay` tool call with the pre-computed geometry in the same turn, so voice and visuals cannot desync. Handles "done → next step". Never invents geometry live.
- Contract between them is one JSON shape:
  ```json
  { "goal": "...", "steps": [ { "n": 1, "say": "...", "overlay": [ { "type": "arrow", "from": [0,0], "to": [1,1] } ] } ] }
  ```
- Overlay primitive vocabulary: `arrow`, `crease_line`, `dot`, `fold_curve`, `label`. Positions in normalized [0,1] coordinates.
- Hero demo (origami) uses a pre-generated cached plan (deterministic on stage); off-script goals generate live with a visible "planning…" state.

### Spatial anchoring
Gyro-only anchoring (the Pokémon Go trick): `expo-sensors` DeviceMotion quaternion drives the three.js camera; annotations sit at fixed world directions rendered via `expo-gl` + `@react-three/fiber/native`. Rotation sticks, walking drifts — acceptable for a tabletop demo. No ARKit/ARCore/ViroReact.

### Stack
- Expo SDK 57 + TypeScript, custom dev build (`expo-dev-client`) — Expo Go does not support these native modules.
- `expo-camera` (feed + permissions), `expo-gl`/`@react-three/fiber`/`three` (3D annotations), `expo-sensors` (gyro), `react-native-webrtc` (Realtime API transport).
- Local Express token server on the dev Mac: mints ephemeral Realtime client secrets (`POST /v1/realtime/client_secrets`) and hosts the Planner call. OpenAI API key never ships in the app. Phone reaches it over LAN; hotspot fallback if venue Wi-Fi isolates devices.

### Known constraints (accepted)
- Realtime API is audio-first; live video/vision input is immature — hence self-reported step completion.
- Annotations are placed against a canonical aligned square, not tracked to the physical paper; the user aligns their paper to an on-screen frame.
- OpenAI Agents SDK does not run in React Native; the WebRTC client is hand-rolled (`registerGlobals()`, audio-mode setup). Reference: thorwebdev/expo-webrtc-openai-realtime.
- Expo SDK 57 requires React Native's New Architecture. The current React Native Directory metadata marks `react-native-webrtc` as untested there, so a physical-device Realtime check is mandatory before any claim of production readiness.

## Testing Decisions
- Good tests should validate user-visible behavior, not internal implementation.
- Highest-value seam: end-to-end behavior of goal → camera guidance → overlay step progression.
- Preferred tests:
  - Goal input produces a guided session
  - Voice step and visual step remain synchronized
  - Spatial annotation appears anchored for the demo scenario
  - Completing a step advances to the next instruction
  - Origami demo flow works start to finish
- Demo reliability should be validated with a recorded fallback.
- If broader implementation proceeds later, test seams should stay high-value and behavior-focused.
