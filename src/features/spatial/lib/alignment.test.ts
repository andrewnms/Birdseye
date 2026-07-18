import { normalizedPointToScreenPoint } from "./alignment";

describe("alignment-square coordinates", () => {
  it("lands planner coordinates on the matching visible square corners", () => {
    const square = { x: 40, y: 120, size: 240 };

    expect(normalizedPointToScreenPoint([0, 0], square)).toEqual({ x: 40, y: 120 });
    expect(normalizedPointToScreenPoint([1, 0], square)).toEqual({ x: 280, y: 120 });
    expect(normalizedPointToScreenPoint([0, 1], square)).toEqual({ x: 40, y: 360 });
    expect(normalizedPointToScreenPoint([1, 1], square)).toEqual({ x: 280, y: 360 });
  });
});
