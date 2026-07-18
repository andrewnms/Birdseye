import {
  parseSpatialOverlayPrimitives,
  type SpatialOverlayPrimitive,
} from "../../spatial";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Converts untrusted `render_overlay` function-call arguments into the
 * primitive vocabulary accepted by the spatial renderer.
 *
 * The Realtime data channel can send malformed tool-call arguments. This
 * adapter deliberately treats those as an empty overlay, keeping the lesson
 * session alive while preserving valid sibling primitives.
 */
export function normalizeRealtimeOverlay(
  argumentsJson: unknown,
): SpatialOverlayPrimitive[] {
  if (typeof argumentsJson !== "string") {
    return [];
  }

  let argumentsValue: unknown;

  try {
    argumentsValue = JSON.parse(argumentsJson);
  } catch {
    return [];
  }

  if (!isRecord(argumentsValue) || !Array.isArray(argumentsValue.overlay)) {
    return [];
  }

  return parseSpatialOverlayPrimitives(argumentsValue.overlay);
}
