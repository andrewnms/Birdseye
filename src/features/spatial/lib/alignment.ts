import { MathUtils, PerspectiveCamera, Vector3 } from "three";

import type { NormalizedPoint } from "./overlay-primitives";

export type AlignmentSquare = {
  x: number;
  y: number;
  size: number;
};

export type ViewportSize = {
  width: number;
  height: number;
};

export type ScreenPoint = {
  x: number;
  y: number;
};

export function createCenteredAlignmentSquare(
  { width, height }: ViewportSize,
  coverage = 0.72,
): AlignmentSquare {
  const size = Math.max(0, Math.min(width, height) * coverage);

  return {
    x: (width - size) / 2,
    y: (height - size) / 2,
    size,
  };
}

/** Maps planner coordinates to the visible camera-alignment square. */
export function normalizedPointToScreenPoint(
  [x, y]: NormalizedPoint,
  square: AlignmentSquare,
): ScreenPoint {
  return {
    x: square.x + x * square.size,
    y: square.y + y * square.size,
  };
}

/**
 * Places a point from the visible alignment square on the initial world-space
 * plane in front of the camera. The camera later rotates around that plane.
 */
export function normalizedPointToWorldPoint(
  point: NormalizedPoint,
  square: AlignmentSquare,
  viewport: ViewportSize,
  distance: number,
  cameraFovDegrees: number,
): Vector3 {
  const screenPoint = normalizedPointToScreenPoint(point, square);
  const frustumHeight =
    2 * distance * Math.tan(MathUtils.degToRad(cameraFovDegrees) / 2);
  const frustumWidth = frustumHeight * (viewport.width / viewport.height);

  return new Vector3(
    (screenPoint.x / viewport.width - 0.5) * frustumWidth,
    (0.5 - screenPoint.y / viewport.height) * frustumHeight,
    -distance,
  );
}

/**
 * Projects a world-locked label to its native React Native label layer. A
 * label behind the camera or outside the viewport is omitted by the caller.
 */
export function worldPointToScreenPoint(
  point: Vector3,
  camera: PerspectiveCamera,
  viewport: ViewportSize,
): ScreenPoint | null {
  const projected = point.clone().project(camera);

  if (
    projected.z < -1 ||
    projected.z > 1 ||
    projected.x < -1 ||
    projected.x > 1 ||
    projected.y < -1 ||
    projected.y > 1
  ) {
    return null;
  }

  return {
    x: ((projected.x + 1) / 2) * viewport.width,
    y: ((1 - projected.y) / 2) * viewport.height,
  };
}
