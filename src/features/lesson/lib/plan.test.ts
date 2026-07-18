import { validateLessonPlan } from "./plan";

describe("validateLessonPlan", () => {
  it("accepts a complete lesson that the executor can run", () => {
    const result = validateLessonPlan({
      goal: "paper crane",
      steps: [
        {
          n: 1,
          say: "Fold the square corner to corner.",
          overlay: [
            {
              type: "crease_line",
              from: [0, 0],
              to: [1, 1],
            },
          ],
        },
      ],
    });

    expect(result).toEqual({
      ok: true,
      value: {
        goal: "paper crane",
        steps: [
          {
            n: 1,
            say: "Fold the square corner to corner.",
            overlay: [
              {
                type: "crease_line",
                from: [0, 0],
                to: [1, 1],
              },
            ],
          },
        ],
      },
    });
  });
});
