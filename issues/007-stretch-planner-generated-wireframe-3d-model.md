# STRETCH: Planner-generated wireframe 3D model in AR

## Parent

PRD.md — "Locked Architecture > Planner / Executor split" (stretch goal). Do NOT start before 005 is demoable.

## What to build

The Planner additionally emits a rough untextured 3D model (vertex/face JSON) of the finished result; the app renders it as a ghosted wireframe mesh floating in the AR scene next to the working area — a preview of what the learner is building. Wireframe/pen aesthetic only; textured model generation stays out of scope per PRD.

## Acceptance criteria

- [ ] Plan JSON optionally carries a `model` field (vertices + faces); absence changes nothing
- [ ] Wireframe mesh renders gyro-anchored in the AR view, visually distinct from step annotations
- [ ] Degenerate geometry from the Planner fails soft (no mesh) rather than crashing the scene
- [ ] Core demo (005) still passes end to end with this enabled
- [ ] `npx tsc --noEmit` passes

## User stories

- #19 (memorable product character)

## Blocked by

- 005-cached-crane-plan-runs-start-to-finish
