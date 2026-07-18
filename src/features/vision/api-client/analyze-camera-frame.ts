import type { OverlayPrimitive } from "../../lesson/lib/plan";
import { normalizeRealtimeOverlay } from "../../overlay-tool";

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export type CameraFrameAnalysis = {
  observation: string;
  overlay: OverlayPrimitive[];
};

type AnalyzeCameraFrameInput = {
  goal: string;
  step: {
    n: number;
    say: string;
  };
  imageDataUrl: string;
};

type AnalyzeCameraFrameOptions = {
  baseUrl: string;
  fetcher?: Fetcher;
  signal?: AbortSignal;
};

function visionUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/vision/analyze`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseError(payload: unknown): string {
  return isRecord(payload) && typeof payload.error === "string"
    ? payload.error
    : "the vision service could not analyze the camera frame";
}

/**
 * Sends a single compressed frame, not a video recording. The server keeps the
 * API key private and returns only observations plus normalized annotations.
 */
export async function analyzeCameraFrame(
  input: AnalyzeCameraFrameInput,
  { baseUrl, fetcher = fetch, signal }: AnalyzeCameraFrameOptions,
): Promise<CameraFrameAnalysis> {
  const response = await fetcher(visionUrl(baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseError(payload));
  }

  if (
    !isRecord(payload) ||
    typeof payload.observation !== "string" ||
    !Array.isArray(payload.overlay)
  ) {
    throw new Error("the vision service returned an invalid analysis");
  }

  return {
    observation: payload.observation,
    overlay: normalizeRealtimeOverlay(JSON.stringify({ overlay: payload.overlay })),
  };
}
