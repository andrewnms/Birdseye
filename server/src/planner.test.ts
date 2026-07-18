import { createPlanner } from "./planner";

describe("planner", () => {
  it("turns any practical goal into a validated lesson plan", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            goal: "assemble a simple pcb",
            model: null,
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

    const request = fetcher.mock.calls[0]?.[1];
    const body = request?.body;
    const payload = typeof body === "string" ? JSON.parse(body) : null;

    expect(payload?.text.format.schema.properties.model).toEqual(
      expect.objectContaining({ anyOf: expect.any(Array) }),
    );
    expect(payload?.text.format.schema.properties.steps.items.properties.overlay.items).toEqual(
      expect.objectContaining({ anyOf: expect.any(Array) }),
    );
    expect(payload?.input[0]).toEqual(
      expect.objectContaining({
        role: "developer",
        content: expect.stringContaining("Use the same language as the learner's goal."),
      }),
    );
  });

  it("keeps upstream detail on the server without ever including the API key", async () => {
    const planner = createPlanner({
      apiKey: "server-only-key",
      model: "gpt-5.6",
      fetcher: jest.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: "invalid response format" } }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ),
    });

    await expect(planner.create("prepare dinner")).rejects.toThrow(
      "the planner upstream request failed with 400: invalid response format",
    );
    await expect(planner.create("prepare dinner")).rejects.not.toThrow(
      "server-only-key",
    );
  });
});
