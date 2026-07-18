import {
  normalizedPointToScreenPoint,
  type AlignmentSquare,
  type ScreenPoint,
} from "./alignment";
import type { NormalizedPoint } from "./overlay-primitives";

export type SpatialOverlayAnchorMode = "world" | "screen";

type ResolveLabelScreenPointOptions = {
  anchorMode: SpatialOverlayAnchorMode;
  point: NormalizedPoint;
  square: AlignmentSquare;
  projectWorldPoint: () => ScreenPoint | null;
};

/**
 * Screen-locked annotations deliberately bypass camera projection. Their
 * normalized coordinates represent pixels in the current camera image, which
 * is what vision-derived annotations need while the phone is moving.
 */
export function resolveLabelScreenPoint({
  anchorMode,
  point,
  square,
  projectWorldPoint,
}: ResolveLabelScreenPointOptions): ScreenPoint | null {
  return anchorMode === "screen"
    ? normalizedPointToScreenPoint(point, square)
    : projectWorldPoint();
}
