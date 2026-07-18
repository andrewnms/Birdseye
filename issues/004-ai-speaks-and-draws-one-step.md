# AI speaks and draws one step

## Parent

PRD.md — "Locked Architecture > Planner / Executor split".

## What to build

Wire the Realtime session to the AR view: define a `render_overlay` tool the model calls over the data channel; the app renders the received primitives as gyro-anchored 3D annotations while the model narrates the same step aloud. One hardcoded lesson step is enough — the point is the tool-call → render pipeline working end to end.

Overlay primitive vocabulary and coordinate convention come from the PRD contract (decision-rich shape, from the grilling session):

```json
{ "overlay": [ { "type": "crease_line", "from": [0, 0], "to": [1, 1] },
               { "type": "arrow",       "from": [1, 0], "to": [0, 1] } ] }
```

Types: `arrow`, `crease_line`, `dot`, `fold_curve`, `label`. Positions normalized [0,1] against the on-screen alignment square. Voice and visual fire in the same model turn so they cannot desync.

## Acceptance criteria

- [ ] Asking the AI for the step produces spoken narration AND the matching overlay appears in the AR view
- [ ] All five primitive types render correctly from a tool-call payload
- [ ] Overlay coordinates map to the alignment square (corners land on corners)
- [ ] Malformed/unknown primitive in a payload is skipped without crashing the session
- [ ] `npx tsc --noEmit` passes

## User stories

- #6 (step-by-step, one action at a time)
- #20 (applied learning — outcomes, not explanations)

## Blocked by

- 002-gyro-anchored-arrow-floats-in-space
- 003-voice-conversation-with-ai
