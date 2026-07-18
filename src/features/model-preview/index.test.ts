import { parseWireframeModel } from "./index";

describe("planner wireframe model", () => {
  it("turns a valid planner model into line segments a Three overlay can render", () => {
    expect(
      parseWireframeModel({
        vertices: [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ],
        faces: [[0, 1, 2]],
      }),
    ).toEqual({
      positions: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
      segmentCount: 3,
    });
  });

  it("leaves the scene unchanged when a plan has no optional model", () => {
    expect(parseWireframeModel(undefined)).toBeNull();
  });

  it("fails soft instead of sending a collinear face to the live scene", () => {
    expect(
      parseWireframeModel({
        vertices: [
          [0, 0, 0],
          [1, 0, 0],
          [2, 0, 0],
        ],
        faces: [[0, 1, 2]],
      }),
    ).toBeNull();
  });

  it("returns no preview for malformed vertices or face references without throwing", () => {
    expect(() =>
      parseWireframeModel({
        vertices: [
          [0, 0, 0],
          [1, Number.NaN, 0],
          [0, 1, 0],
        ],
        faces: [[0, 1, 9]],
      }),
    ).not.toThrow();

    expect(
      parseWireframeModel({
        vertices: [
          [0, 0, 0],
          [1, Number.NaN, 0],
          [0, 1, 0],
        ],
        faces: [[0, 1, 9]],
      }),
    ).toBeNull();
  });

  it("preserves a valid polygon face as one closed wireframe outline", () => {
    expect(
      parseWireframeModel({
        vertices: [
          [0, 0, 0],
          [1, 0, 0],
          [1, 1, 0],
          [0, 1, 0],
        ],
        faces: [[0, 1, 2, 3]],
      }),
    ).toMatchObject({ segmentCount: 4 });
  });
});
