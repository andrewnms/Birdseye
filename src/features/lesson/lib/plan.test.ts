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

  it("preserves an optional local wireframe candidate without making it required", () => {
    const result = validateLessonPlan({
      goal: "identify a pcb footprint",
      model: {
        vertices: [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
        ],
        faces: [[0, 1, 2]],
      },
      steps: [
        {
          n: 1,
          say: "Set the board inside the square.",
          overlay: [{ type: "dot", at: [0.5, 0.5] }],
        },
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          model: expect.objectContaining({ vertices: expect.any(Array) }),
        }),
      }),
    );
  });
});
