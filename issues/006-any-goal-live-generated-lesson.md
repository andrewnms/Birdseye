# Any goal → live-generated lesson

## Parent

PRD.md — "Locked Architecture > Planner / Executor split" (off-script path).

## What to build

The generalization proof: user states any real-world goal (typed or spoken), the local server calls the Planner model to generate a lesson plan in the same JSON contract, the app shows a visible "planning…" state during generation, then the identical Executor step loop from the cached path runs the fresh plan. One code path, cache in front for the hero.

Planner output must validate against the plan contract before the session starts; a plan that fails validation surfaces a retry, not a broken session.

## Acceptance criteria

- [ ] Entering a novel goal (not origami) produces a runnable multi-step lesson with voice + overlays
- [ ] "Planning…" state visible while the Planner generates; no frozen/blank screen
- [ ] Generated plan validates against the contract; invalid plan → user-visible retry, no crash
- [ ] Same step loop code serves cached and live plans (no forked session logic)
- [ ] Demoable twice in a row with two different goals
- [ ] `npx tsc --noEmit` passes

## User stories

- #1 (enter a goal), #2 (clarifying questions — minimal viable: planner may ask one), #13 (adapts beyond one demo), #15 (judge sees multiple domains)

## Blocked by

- 005-cached-crane-plan-runs-start-to-finish
