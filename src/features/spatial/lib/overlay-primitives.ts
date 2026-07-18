export type NormalizedPoint = readonly [number, number];

export type SpatialOverlayPrimitive =
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

const directionalTypes = new Set(["arrow", "crease_line", "fold_curve"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNormalizedPoint(value: unknown): NormalizedPoint | null {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every(
      (coordinate) =>
        typeof coordinate === "number" &&
        Number.isFinite(coordinate) &&
        coordinate >= 0 &&
        coordinate <= 1,
    )
  ) {
    return null;
  }

  return [value[0], value[1]];
}

function parseSpatialOverlayPrimitive(value: unknown): SpatialOverlayPrimitive | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  if (directionalTypes.has(value.type)) {
    const from = toNormalizedPoint(value.from);
    const to = toNormalizedPoint(value.to);

    if (!from || !to) {
      return null;
    }

    return {
      type: value.type as "arrow" | "crease_line" | "fold_curve",
      from,
      to,
    };
  }

  if (value.type === "dot") {
    const at = toNormalizedPoint(value.at);
    return at ? { type: "dot", at } : null;
  }

  if (value.type === "label") {
    const at = toNormalizedPoint(value.at);
    const text = typeof value.text === "string" ? value.text.trim() : "";

    return at && text ? { type: "label", at, text } : null;
  }

  return null;
}

/**
 * Narrows untrusted planner or Realtime tool-call payloads to annotations the
 * renderer understands. Invalid entries are deliberately skipped so one bad
 * primitive cannot end an otherwise valid spoken lesson step.
 */
export function parseSpatialOverlayPrimitives(
  values: readonly unknown[],
): SpatialOverlayPrimitive[] {
  return values.flatMap((value) => {
    const primitive = parseSpatialOverlayPrimitive(value);
    return primitive ? [primitive] : [];
  });
}
