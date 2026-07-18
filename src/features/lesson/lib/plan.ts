export type NormalizedPoint = readonly [number, number];

export type OverlayPrimitive =
  | {
      type: "arrow" | "crease_line" | "fold_curve";
      from: NormalizedPoint;
      to: NormalizedPoint;
    }
  | {
      type: "dot";
      at: NormalizedPoint;
    }
  | {
      type: "label";
      at: NormalizedPoint;
      text: string;
    };

export type LessonStep = {
  n: number;
  say: string;
  overlay: OverlayPrimitive[];
};

export type LessonPlan = {
  goal: string;
  steps: LessonStep[];
  /**
   * Optional planner-provided local shape. The renderer validates it again
   * before it reaches the live GL scene, so a lesson still runs without one.
   */
  model?: unknown;
};

export type PlanValidationResult =
  | { ok: true; value: LessonPlan }
  | { ok: false; error: string };

const directionalPrimitiveTypes = new Set([
  "arrow",
  "crease_line",
  "fold_curve",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNormalizedPoint(value: unknown): value is NormalizedPoint {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(
      (coordinate) =>
        typeof coordinate === "number" &&
        Number.isFinite(coordinate) &&
        coordinate >= 0 &&
        coordinate <= 1,
    )
  );
}

function parsePrimitive(value: unknown): OverlayPrimitive | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  if (directionalPrimitiveTypes.has(value.type)) {
    if (!isNormalizedPoint(value.from) || !isNormalizedPoint(value.to)) {
      return null;
    }

    return {
      type: value.type as "arrow" | "crease_line" | "fold_curve",
      from: value.from,
      to: value.to,
    };
  }

  if (value.type === "dot" && isNormalizedPoint(value.at)) {
    return { type: "dot", at: value.at };
  }

  if (
    value.type === "label" &&
    isNormalizedPoint(value.at) &&
    typeof value.text === "string" &&
    value.text.trim().length > 0
  ) {
    return { type: "label", at: value.at, text: value.text.trim() };
  }

  return null;
}

export function validateLessonPlan(value: unknown): PlanValidationResult {
  if (!isRecord(value) || typeof value.goal !== "string" || value.goal.trim() === "") {
    return { ok: false, error: "a lesson plan needs a goal" };
  }

  if (!Array.isArray(value.steps) || value.steps.length === 0) {
    return { ok: false, error: "a lesson plan needs at least one step" };
  }

  const steps: LessonStep[] = [];

  for (const [index, candidate] of value.steps.entries()) {
    if (!isRecord(candidate)) {
      return { ok: false, error: `step ${index + 1} is invalid` };
    }

    if (candidate.n !== index + 1) {
      return { ok: false, error: `step ${index + 1} has the wrong sequence number` };
    }

    if (typeof candidate.say !== "string" || candidate.say.trim() === "") {
      return { ok: false, error: `step ${index + 1} needs narration` };
    }

    if (!Array.isArray(candidate.overlay) || candidate.overlay.length === 0) {
      return { ok: false, error: `step ${index + 1} needs an overlay` };
    }

    const overlay: OverlayPrimitive[] = [];

    for (const primitive of candidate.overlay) {
      const parsed = parsePrimitive(primitive);

      if (!parsed) {
        return { ok: false, error: `step ${index + 1} has an invalid overlay primitive` };
      }

      overlay.push(parsed);
    }

    steps.push({
      n: candidate.n,
      say: candidate.say.trim(),
      overlay,
    });
  }

  const plan: LessonPlan = {
    goal: value.goal.trim(),
    steps,
  };

  if ("model" in value && value.model !== null && value.model !== undefined) {
    plan.model = value.model;
  }

  return { ok: true, value: plan };
}
