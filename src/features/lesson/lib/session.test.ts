import type { LessonPlan } from "./plan";
import { advanceLesson, startLesson } from "./session";

const plan: LessonPlan = {
  goal: "paper crane",
  steps: [
    {
      n: 1,
      say: "Fold the square corner to corner.",
      overlay: [{ type: "crease_line", from: [0, 0], to: [1, 1] }],
    },
    {
      n: 2,
      say: "Fold the top corner down.",
      overlay: [{ type: "arrow", from: [0.5, 0], to: [0.5, 0.7] }],
    },
  ],
};

describe("lesson session", () => {
  it("shows one matching narration and overlay at a time until the lesson completes", () => {
    const first = startLesson(plan);

    expect(first).toMatchObject({
      status: "active",
      currentStep: plan.steps[0],
    });

    const second = advanceLesson(first);

    expect(second).toMatchObject({
      status: "active",
      currentStep: plan.steps[1],
    });

    expect(advanceLesson(second)).toEqual({ status: "complete" });
  });
});
