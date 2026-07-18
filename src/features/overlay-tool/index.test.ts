import { normalizeRealtimeOverlay } from "./";

describe("normalizeRealtimeOverlay", () => {
  it("turns a render_overlay function call's JSON arguments into spatial primitives", () => {
    expect(
      normalizeRealtimeOverlay(
        JSON.stringify({
          overlay: [
            { type: "crease_line", from: [0, 0], to: [1, 1] },
            { type: "label", at: [0.5, 0.1], text: "  Match these corners  " },
          ],
        }),
      ),
    ).toEqual([
      { type: "crease_line", from: [0, 0], to: [1, 1] },
      { type: "label", at: [0.5, 0.1], text: "Match these corners" },
    ]);
  });

  it("preserves every primitive the spatial renderer supports", () => {
    const primitiveTypes = normalizeRealtimeOverlay(
      JSON.stringify({
        overlay: [
          { type: "arrow", from: [0, 0], to: [1, 1] },
          { type: "crease_line", from: [0, 1], to: [1, 0] },
          { type: "dot", at: [0.5, 0.5] },
          { type: "fold_curve", from: [0.2, 0.5], to: [0.8, 0.5] },
          { type: "label", at: [0.5, 0.1], text: "Fold here" },
        ],
      }),
    ).map((primitive) => primitive.type);

    expect(primitiveTypes).toEqual([
      "arrow",
      "crease_line",
      "dot",
      "fold_curve",
      "label",
    ]);
  });

  it("keeps valid primitives when a tool call includes malformed or unknown siblings", () => {
    expect(
      normalizeRealtimeOverlay(
        JSON.stringify({
          overlay: [
            { type: "arrow", from: [0, 0], to: [1, 1] },
            { type: "wireframe", at: [0.5, 0.5] },
            { type: "dot", at: [-0.1, 0.5] },
            { type: "label", at: [0.5, 0.5], text: "   " },
          ],
        }),
      ),
    ).toEqual([{ type: "arrow", from: [0, 0], to: [1, 1] }]);
  });

  it("returns an empty overlay instead of throwing for malformed tool-call arguments", () => {
    expect(normalizeRealtimeOverlay("{not valid JSON")).toEqual([]);
    expect(normalizeRealtimeOverlay(JSON.stringify({ overlay: "arrow" }))).toEqual([]);
  });
});
