import {
  type LessonPlan,
  validateLessonPlan,
} from "../../src/features/lesson/lib/plan";

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

type PlannerOptions = {
  apiKey: string;
  model: string;
  fetcher?: Fetcher;
};

type Planner = {
  create(goal: string): Promise<LessonPlan>;
};

const normalizedPointSchema = {
  type: "array",
  minItems: 2,
  maxItems: 2,
  items: { type: "number", minimum: 0, maximum: 1 },
} as const;

const overlayPrimitiveSchema = {
  anyOf: [
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "from", "to"],
      properties: {
        type: { const: "arrow" },
        from: normalizedPointSchema,
        to: normalizedPointSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "from", "to"],
      properties: {
        type: { const: "crease_line" },
        from: normalizedPointSchema,
        to: normalizedPointSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "from", "to"],
      properties: {
        type: { const: "fold_curve" },
        from: normalizedPointSchema,
        to: normalizedPointSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "at"],
      properties: {
        type: { const: "dot" },
        at: normalizedPointSchema,
      },
    },
    {
      type: "object",
      additionalProperties: false,
      required: ["type", "at", "text"],
      properties: {
        type: { const: "label" },
        at: normalizedPointSchema,
        text: { type: "string" },
      },
    },
  ],
} as const;

const optionalWireframeSchema = {
  anyOf: [
    { type: "null" },
    {
      type: "object",
      additionalProperties: false,
      required: ["vertices", "faces"],
      properties: {
        vertices: {
          type: "array",
          minItems: 3,
          maxItems: 64,
          items: {
            type: "array",
            minItems: 3,
            maxItems: 3,
            items: { type: "number" },
          },
        },
        faces: {
          type: "array",
          minItems: 1,
          maxItems: 96,
          items: {
            type: "array",
            minItems: 3,
            maxItems: 12,
            items: { type: "integer", minimum: 0 },
          },
        },
      },
    },
  ],
} as const;

const lessonPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: ["goal", "model", "steps"],
  properties: {
    goal: { type: "string" },
    model: optionalWireframeSchema,
    steps: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["n", "say", "overlay"],
        properties: {
          n: { type: "integer", minimum: 1 },
          say: { type: "string" },
          overlay: {
            type: "array",
            minItems: 1,
            items: overlayPrimitiveSchema,
          },
        },
      },
    },
  },
};

const plannerInstructions = `You create concise, safe, real-world learning lessons.
The learner aligns their work surface inside a visible square. You do not claim to track objects or verify physical completion.
Produce 2 to 8 sequential steps for the stated goal. Each step contains short spoken narration and at least one overlay primitive.
Use normalized coordinates from 0 to 1 inside the square. arrow, crease_line, and fold_curve require from and to points. dot requires at. label requires at and text.
Always return model. Use null unless a small rough local wireframe materially helps the learner. A model has local xyz vertices and polygon faces with zero-based indices. Keep language direct, flag safety-critical steps in the narration, and make every instruction physically actionable.`;

function outputText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  if ("output_text" in payload && typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!("output" in payload) || !Array.isArray(payload.output)) {
    return null;
  }

  for (const item of payload.output) {
    if (typeof item !== "object" || item === null || !("content" in item)) {
      continue;
    }

    if (!Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (
        typeof content === "object" &&
        content !== null &&
        "type" in content &&
        content.type === "output_text" &&
        "text" in content &&
        typeof content.text === "string"
      ) {
        return content.text;
      }
    }
  }

  return null;
}

export function createPlanner({
  apiKey,
  model,
  fetcher = fetch,
}: PlannerOptions): Planner {
  return {
    async create(goal: string): Promise<LessonPlan> {
      const normalizedGoal = goal.trim();

      if (!normalizedGoal) {
        throw new Error("enter a goal before starting a lesson");
      }

      const response = await fetcher("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: [
            { role: "developer", content: plannerInstructions },
            { role: "user", content: normalizedGoal },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "lesson_plan",
              strict: true,
              schema: lessonPlanSchema,
            },
          },
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error("the planner request failed");
      }

      const text = outputText(payload);

      if (!text) {
        throw new Error("the planner returned no lesson");
      }

      let candidate: unknown;

      try {
        candidate = JSON.parse(text);
      } catch {
        throw new Error("the planner returned malformed lesson data");
      }

      const result = validateLessonPlan(candidate);

      if (!result.ok) {
        throw new Error(`the planner returned an invalid lesson: ${result.error}`);
      }

      return result.value;
    },
  };
}
