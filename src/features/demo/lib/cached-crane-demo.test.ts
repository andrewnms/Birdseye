import { createCachedCraneDemo } from "./cached-crane-demo";

describe("cached crane demo", () => {
  it("starts with the first cached crane instruction ready to present", () => {
    const demo = createCachedCraneDemo();

    expect(demo.snapshot()).toMatchObject({
      status: "active",
      goal: "paper crane",
      totalSteps: 6,
      currentStep: {
        n: 1,
        say: "Place the paper in the square. Fold the bottom left corner to the top right corner, then crease it firmly.",
      },
    });
  });

  it("advances exactly one step while keeping narration and overlay together", () => {
    const demo = createCachedCraneDemo();

    const next = demo.advance();

    expect(next).toEqual({
      status: "active",
      goal: "paper crane",
      totalSteps: 6,
      currentStep: {
        n: 2,
        say: "Open the paper. Now fold the bottom right corner to the top left corner and make the second diagonal crease.",
        overlay: [
          { type: "arrow", from: [1, 1], to: [0, 0] },
          { type: "crease_line", from: [1, 1], to: [0, 0] },
        ],
      },
    });
    expect(demo.snapshot()).toEqual(next);
  });

  it("ends the final instruction with a completion message", () => {
    const demo = createCachedCraneDemo();

    for (let step = 0; step < 6; step += 1) {
      demo.advance();
    }

    expect(demo.snapshot()).toEqual({
      status: "complete",
      goal: "paper crane",
      totalSteps: 6,
      completionMessage: "You made a paper crane.",
    });
  });
});
