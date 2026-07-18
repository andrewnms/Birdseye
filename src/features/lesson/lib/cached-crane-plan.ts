import type { LessonPlan } from "./plan";

const cachedCranePlan: LessonPlan = {
  goal: "paper crane",
  steps: [
    {
      n: 1,
      say: "Place the paper in the square. Fold the bottom left corner to the top right corner, then crease it firmly.",
      overlay: [
        { type: "crease_line", from: [0, 1], to: [1, 0] },
        { type: "label", at: [0.5, 0.46], text: "first diagonal" },
      ],
    },
    {
      n: 2,
      say: "Open the paper. Now fold the bottom right corner to the top left corner and make the second diagonal crease.",
      overlay: [
        { type: "arrow", from: [1, 1], to: [0, 0] },
        { type: "crease_line", from: [1, 1], to: [0, 0] },
      ],
    },
    {
      n: 3,
      say: "Open the paper again. Bring the left and right corners together so the paper collapses into a triangle.",
      overlay: [
        { type: "fold_curve", from: [0.08, 0.5], to: [0.5, 0.5] },
        { type: "fold_curve", from: [0.92, 0.5], to: [0.5, 0.5] },
        { type: "dot", at: [0.5, 0.5] },
      ],
    },
    {
      n: 4,
      say: "With the triangle point facing up, fold the lower left flap to the center line.",
      overlay: [
        { type: "arrow", from: [0.19, 0.82], to: [0.5, 0.38] },
        { type: "crease_line", from: [0.19, 0.82], to: [0.5, 0.38] },
      ],
    },
    {
      n: 5,
      say: "Repeat that fold with the lower right flap, meeting the same center line.",
      overlay: [
        { type: "arrow", from: [0.81, 0.82], to: [0.5, 0.38] },
        { type: "crease_line", from: [0.81, 0.82], to: [0.5, 0.38] },
        { type: "label", at: [0.5, 0.32], text: "center line" },
      ],
    },
    {
      n: 6,
      say: "Pull the two wing points gently apart and shape the neck. You made a paper crane.",
      overlay: [
        { type: "arrow", from: [0.5, 0.47], to: [0.18, 0.66] },
        { type: "arrow", from: [0.5, 0.47], to: [0.82, 0.66] },
        { type: "dot", at: [0.5, 0.47] },
      ],
    },
  ],
};

export function getCachedCranePlan(): LessonPlan {
  return cachedCranePlan;
}
