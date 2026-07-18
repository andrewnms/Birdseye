# Gyro-anchored arrow floats in space

## Parent

PRD.md — "Locked Architecture > Spatial anchoring".

## What to build

A hardcoded red 3D arrow rendered over the live camera feed that stays fixed in world space as the phone rotates (the Pokémon Go trick). DeviceMotion quaternion drives the three.js camera orientation; the arrow sits at a fixed world direction rendered via expo-gl/expo-three on a transparent GL view over the camera.

No paper tracking, no ARKit. Rotation sticks; walking drifts (accepted in PRD).

## Acceptance criteria

- [ ] Red arrow appears floating over the camera feed
- [ ] Rotating the phone left/right/up/down keeps the arrow visually pinned to the same real-world direction
- [ ] GL view is transparent — camera feed visible everywhere except the arrow
- [ ] Sensor updates render smoothly (no visible stutter at normal hand motion)
- [ ] `npx tsc --noEmit` passes

## User stories

- #4 (camera-based instruction overlays)
- #5 (annotations anchored, stay aligned as I move)

## Blocked by

- 001-dev-build-boots-with-live-camera
