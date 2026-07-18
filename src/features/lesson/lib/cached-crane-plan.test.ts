import { getCachedCranePlan } from "./cached-crane-plan";
import { validateLessonPlan } from "./plan";

describe("cached crane plan", () => {
  it("provides a complete runnable lesson that exercises every overlay primitive", () => {
    const plan = getCachedCranePlan();
    const primitiveTypes = new Set(
      plan.steps.flatMap((step) => step.overlay.map((primitive) => primitive.type)),
    );

    expect(validateLessonPlan(plan)).toEqual({ ok: true, value: plan });
    expect(plan.steps).toHaveLength(6);
    expect(primitiveTypes).toEqual(
      new Set(["arrow", "crease_line", "dot", "fold_curve", "label"]),
    );
  });
});
