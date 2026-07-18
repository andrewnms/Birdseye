# Cached crane plan runs start to finish

## Parent

PRD.md — "Locked Architecture > Planner / Executor split" (hero demo path).

## What to build

The full hero demo loop from a pre-generated, cached lesson plan. A planner-produced JSON plan for the origami model (generated once ahead of time, committed to the repo) feeds the Executor: for each step the model narrates and fires `render_overlay` with that step's pre-computed geometry; the learner says "done" (or taps) to advance; the final step ends the session with a completion message.

Plan contract (from the grilling session):

```json
{ "goal": "paper crane",
  "steps": [ { "n": 1, "say": "Fold the square corner to corner.",
               "overlay": [ { "type": "crease_line", "from": [0,0], "to": [1,1] } ] } ] }
```

This slice is the win condition: a judge folds real paper start to finish following voice + overlays.

## Acceptance criteria

- [ ] Starting the origami session begins at step 1 with voice + overlay
- [ ] Saying "done" (and tapping a Next button) advances exactly one step; overlay swaps to the new step
- [ ] Voice narration and displayed overlay always correspond to the same step number
- [ ] Final step ends with a spoken completion; session closes cleanly
- [ ] Full run-through completes on device without touching the laptop (except server running)
- [ ] Screen-recorded fallback video of one clean run committed/stored per PRD testing decisions
- [ ] `npx tsc --noEmit` passes

## User stories

- #6, #7 (verify via self-report), #9, #14 (live judge demo), #16 (recorded fallback)

## Blocked by

- 004-ai-speaks-and-draws-one-step
