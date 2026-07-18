import { createPlanner } from "./planner";

describe("planner", () => {
  it("turns any practical goal into a validated lesson plan", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            goal: "assemble a simple pcb",
            steps: [
              {
                n: 1,
                say: "Place the board inside the alignment square.",
                overlay: [
                  { type: "label", at: [0.5, 0.5], text: "pcb" },
                ],
              },
            ],
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const planner = createPlanner({
      apiKey: "test-key",
      model: "gpt-5.6",
      fetcher,
    });

    await expect(planner.create("assemble a simple pcb")).resolves.toMatchObject({
      goal: "assemble a simple pcb",
      steps: [{ n: 1 }],
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      }),
    );
  });
});
