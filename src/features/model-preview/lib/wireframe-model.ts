export type WireframeGeometry = Readonly<{
  /**
   * Consecutive xyz pairs for `THREE.LineSegments`.
   *
   * A renderer can pass this directly to a Three `BufferGeometry` position
   * attribute with an item size of three.
   */
  positions: readonly number[];
  segmentCount: number;
}>;

type Vertex = readonly [number, number, number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toVertex(value: unknown): Vertex | null {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every(
      (coordinate) =>
        typeof coordinate === "number" && Number.isFinite(coordinate),
    )
  ) {
    return null;
  }

  return [value[0], value[1], value[2]];
}

function toFace(value: unknown, vertexCount: number): number[] | null {
  if (
    !Array.isArray(value) ||
    value.length < 3 ||
    !value.every(
      (index) =>
        typeof index === "number" &&
        Number.isInteger(index) &&
        index >= 0 &&
        index < vertexCount,
    )
  ) {
    return null;
  }

  return [...value];
}

function subtract(a: Vertex, b: Vertex): Vertex {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function squaredLength([x, y, z]: Vertex): number {
  return x * x + y * y + z * z;
}

function cross(a: Vertex, b: Vertex): Vertex {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function isNonDegenerateFace(face: readonly number[], vertices: readonly Vertex[]): boolean {
  const points = face.map((index) => vertices[index]);
  const maxEdgeLengthSquared = points.reduce((largest, point, index) => {
    const next = points[(index + 1) % points.length];
    return Math.max(largest, squaredLength(subtract(next, point)));
  }, 0);

  if (maxEdgeLengthSquared === 0) {
    return false;
  }

  const origin = points[0];

  for (let index = 1; index < points.length - 1; index += 1) {
    const first = subtract(points[index], origin);
    const second = subtract(points[index + 1], origin);
    const crossLengthSquared = squaredLength(cross(first, second));

    // Compare against the face's own scale so a valid miniature model is not
    // rejected merely because it uses small coordinate values.
    if (crossLengthSquared / (maxEdgeLengthSquared * maxEdgeLengthSquared) > 1e-12) {
      return true;
    }
  }

  return false;
}

function appendEdge(
  positions: number[],
  seenEdges: Set<string>,
  startIndex: number,
  endIndex: number,
  vertices: readonly Vertex[],
): void {
  const edgeKey =
    startIndex < endIndex
      ? `${startIndex}:${endIndex}`
      : `${endIndex}:${startIndex}`;

  if (seenEdges.has(edgeKey)) {
    return;
  }

  seenEdges.add(edgeKey);
  positions.push(...vertices[startIndex], ...vertices[endIndex]);
}

/**
 * Converts an optional planner model into safe, unindexed line-segment data.
 * Any malformed or degenerate candidate returns `null`, leaving the caller to
 * render no preview instead of risking the live GL scene.
 */
export function parseWireframeModel(value: unknown): WireframeGeometry | null {
  try {
    if (!isRecord(value) || !Array.isArray(value.vertices) || !Array.isArray(value.faces)) {
      return null;
    }

    const vertices: Vertex[] = [];

    for (const candidate of value.vertices) {
      const vertex = toVertex(candidate);

      if (!vertex) {
        return null;
      }

      vertices.push(vertex);
    }

    if (vertices.length < 3) {
      return null;
    }

    const faces: number[][] = [];

    for (const candidate of value.faces) {
      const face = toFace(candidate, vertices.length);

      if (!face || new Set(face).size !== face.length || !isNonDegenerateFace(face, vertices)) {
        return null;
      }

      faces.push(face);
    }

    if (faces.length === 0) {
      return null;
    }

    const positions: number[] = [];
    const seenEdges = new Set<string>();

    for (const face of faces) {
      face.forEach((startIndex, index) => {
        appendEdge(
          positions,
          seenEdges,
          startIndex,
          face[(index + 1) % face.length],
          vertices,
        );
      });
    }

    return positions.length > 0
      ? { positions, segmentCount: positions.length / 6 }
      : null;
  } catch {
    return null;
  }
}
