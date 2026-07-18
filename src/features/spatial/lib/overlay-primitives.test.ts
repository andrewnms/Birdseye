import { parseSpatialOverlayPrimitives } from "./overlay-primitives";

describe("spatial overlay primitives", () => {
  it("accepts every annotation the planner can send to the visual layer", () => {
    expect(
      parseSpatialOverlayPrimitives([
        { type: "arrow", from: [0, 0], to: [1, 1] },
        { type: "crease_line", from: [0, 1], to: [1, 0] },
        { type: "dot", at: [0.5, 0.5] },
        { type: "fold_curve", from: [0.1, 0.5], to: [0.9, 0.5] },
        { type: "label", at: [0.5, 0.1], text: "align this edge" },
      ]),
    ).toEqual([
      { type: "arrow", from: [0, 0], to: [1, 1] },
      { type: "crease_line", from: [0, 1], to: [1, 0] },
      { type: "dot", at: [0.5, 0.5] },
      { type: "fold_curve", from: [0.1, 0.5], to: [0.9, 0.5] },
      { type: "label", at: [0.5, 0.1], text: "align this edge" },
    ]);
  });

  it("skips malformed and unknown annotations without dropping valid siblings", () => {
    expect(
      parseSpatialOverlayPrimitives([
        { type: "arrow", from: [0, 0], to: [1, 1] },
        { type: "arrow", from: [-1, 0], to: [1, 1] },
        { type: "wireframe", at: [0.5, 0.5] },
        { type: "label", at: [0.5, 0.5], text: "   " },
        null,
      ]),
    ).toEqual([{ type: "arrow", from: [0, 0], to: [1, 1] }]);
  });
});
