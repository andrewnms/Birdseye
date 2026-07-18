import { getLiveLessonPlan } from "./get-live-lesson-plan";

describe("getLiveLessonPlan", () => {
  it("posts a learner goal to the local planner and returns a validated runnable plan", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          goal: "make a paper boat",
          steps: [
            {
              n: 1,
              say: "Fold the paper in half.",
              overlay: [
                { type: "crease_line", from: [0, 0.5], to: [1, 0.5] },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      getLiveLessonPlan("make a paper boat", {
        baseUrl: "http://192.168.1.4:3000",
        fetcher,
      }),
    ).resolves.toMatchObject({
      goal: "make a paper boat",
      steps: [{ n: 1 }],
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://192.168.1.4:3000/planner",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: "make a paper boat" }),
      }),
    );
  });
});
