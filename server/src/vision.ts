import {
  parseSpatialOverlayPrimitives,
  type SpatialOverlayPrimitive,
} from "../../src/features/spatial/lib/overlay-primitives";
import { overlayPrimitiveSchema } from "./overlay-schema";
import { isRecord, outputText } from "./responses-output";

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export type VisionAnalysisRequest = {
  goal: string;
  imageDataUrl: string;
  step: {
    n: number;
    say: string;
  };
};

export type VisionObservation = {
  observation: string;
  overlay: SpatialOverlayPrimitive[];
};

type VisionAnalyzerOptions = {
  apiKey: string;
  fetcher?: Fetcher;
  model?: string;
};

export type VisionAnalyzer = {
  analyze(request: VisionAnalysisRequest): Promise<VisionObservation>;
};

const responsesUrl = "https://api.openai.com/v1/responses";

export const maxImageDataUrlBytes = 768 * 1024;

const observationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["observation", "overlay"],
  properties: {
    observation: { type: "string" },
    overlay: {
      type: "array",
      maxItems: 4,
      items: overlayPrimitiveSchema,
    },
  },
} as const;

const visionInstructions = `You inspect one live camera frame for a learner doing a practical task.
Use the supplied goal and current step as context, but base your response only on visibly supported evidence in the frame. This may be origami, electronics, cooking, carpentry, woodworking, or another hands-on activity.
Return one concise observation in the learner's language. Do not claim that a task is correct, complete, safe, measured, or tracked unless that is clearly visible. Do not identify people or infer personal traits.
Return zero to four overlays only when their positions are visible and useful for the current step. Coordinates are normalized from 0 to 1 within the image. Use an empty overlay array when the frame is unclear or an overlay would be speculative.
Keep the observation practical and flag only clearly visible immediate hazards, such as contact with a hot surface, a sharp edge, exposed electricity, or unstable material.`;

function isBase64ImageDataUrl(value: string): boolean {
  const match = /^data:image\/(?:jpeg|png);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);

  return (
    match !== null &&
    match[1].length > 0 &&
    match[1].length % 4 === 0 &&
    Buffer.byteLength(value, "utf8") < maxImageDataUrlBytes
  );
}

export function parseVisionAnalysisRequest(value: unknown): VisionAnalysisRequest | null {
  if (!isRecord(value) || !isRecord(value.step)) {
    return null;
  }

  const step = value.step;
  const goal = typeof value.goal === "string" ? value.goal.trim() : "";
  const stepNumber = step.n;
  const stepNarration = typeof step.say === "string" ? step.say.trim() : "";

  if (
    !goal ||
    goal.length > 500 ||
    typeof stepNumber !== "number" ||
    !Number.isInteger(stepNumber) ||
    stepNumber < 1 ||
    !stepNarration ||
    stepNarration.length > 1_000 ||
    typeof value.imageDataUrl !== "string" ||
    !isBase64ImageDataUrl(value.imageDataUrl)
  ) {
    return null;
  }

  return {
    goal,
    imageDataUrl: value.imageDataUrl,
    step: { n: stepNumber, say: stepNarration },
  };
}

export function parseVisionObservation(candidate: unknown): VisionObservation | null {
  if (
    !isRecord(candidate) ||
    typeof candidate.observation !== "string" ||
    !Array.isArray(candidate.overlay)
  ) {
    return null;
  }

  const observation = candidate.observation.trim();

  if (!observation || observation.length > 400 || candidate.overlay.length > 4) {
    return null;
  }

  const overlay = parseSpatialOverlayPrimitives(candidate.overlay);

  if (overlay.length !== candidate.overlay.length) {
    return null;
  }

  return { observation, overlay };
}

export function createVisionAnalyzer({
  apiKey,
  fetcher = fetch,
  model = "gpt-5.6",
}: VisionAnalyzerOptions): VisionAnalyzer {
  if (!apiKey.trim()) {
    throw new Error("OPENAI_API_KEY is required to analyze live camera frames");
  }

  return {
    async analyze(request: VisionAnalysisRequest): Promise<VisionObservation> {
      const validatedRequest = parseVisionAnalysisRequest(request);

      if (!validatedRequest) {
        throw new Error("invalid live camera frame analysis request");
      }

      const response = await fetcher(responsesUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          store: false,
          input: [
            { role: "developer", content: visionInstructions },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `Goal: ${validatedRequest.goal}\nCurrent step ${validatedRequest.step.n}: ${validatedRequest.step.say}`,
                },
                { type: "input_image", image_url: validatedRequest.imageDataUrl },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "live_frame_observation",
              strict: true,
              schema: observationSchema,
            },
          },
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error("the vision analysis request failed");
      }

      const text = outputText(payload);

      if (!text) {
        throw new Error("the vision model returned no observation");
      }

      try {
        const observation = parseVisionObservation(JSON.parse(text));

        if (!observation) {
          throw new Error("the vision model returned invalid observation data");
        }

        return observation;
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error("the vision model returned malformed observation data");
        }

        throw error;
      }
    },
  };
}
