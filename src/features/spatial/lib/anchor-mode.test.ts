import { resolveLabelScreenPoint } from "./anchor-mode";

const square = { x: 40, y: 120, size: 240 };

describe("screen-locked annotation anchoring", () => {
  it("keeps a label at its normalized camera-frame coordinate without world projection", () => {
    expect(
      resolveLabelScreenPoint({
        anchorMode: "screen",
        point: [0.25, 0.75],
        square,
        projectWorldPoint: () => null,
      }),
    ).toEqual({ x: 100, y: 300 });
  });

  it("preserves world-projected label placement for the default anchor mode", () => {
    expect(
      resolveLabelScreenPoint({
        anchorMode: "world",
        point: [0.25, 0.75],
        square,
        projectWorldPoint: () => ({ x: 72, y: 184 }),
      }),
    ).toEqual({ x: 72, y: 184 });
  });
});
