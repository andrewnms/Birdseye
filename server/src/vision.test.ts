import { createVisionAnalyzer } from "./vision";

const imageDataUrl = "data:image/jpeg;base64,aGVsbG8=";

describe("vision analyzer", () => {
  it("uses the server-only key to turn a live frame into validated generic guidance", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            observation: "The connector is aligned with the board pads.",
            overlay: [
              {
                type: "arrow",
                from: [0.2, 0.5],
                to: [0.5, 0.5],
              },
            ],
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const analyzer = createVisionAnalyzer({
      apiKey: "server-only-key",
      fetcher,
    });

    await expect(
      analyzer.analyze({
        goal: "solder a pcb connector",
        step: { n: 3, say: "Align the connector with the pads." },
        imageDataUrl,
      }),
    ).resolves.toEqual({
      observation: "The connector is aligned with the board pads.",
      overlay: [
        {
          type: "arrow",
          from: [0.2, 0.5],
          to: [0.5, 0.5],
        },
      ],
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer server-only-key",
          "Content-Type": "application/json",
        }),
      }),
    );

    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(
      expect.objectContaining({
        model: "gpt-5.6",
        store: false,
        text: expect.objectContaining({
          format: expect.objectContaining({
            name: "live_frame_observation",
            strict: true,
            type: "json_schema",
          }),
        }),
        input: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.arrayContaining([
              expect.objectContaining({
                type: "input_image",
                image_url: imageDataUrl,
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  it("rejects a model overlay that leaves normalized camera coordinates", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            observation: "Move the pot handle away from the edge.",
            overlay: [
              {
                type: "arrow",
                from: [-0.1, 0.5],
                to: [0.5, 0.5],
              },
            ],
          }),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const analyzer = createVisionAnalyzer({ apiKey: "server-only-key", fetcher });

    await expect(
      analyzer.analyze({
        goal: "saute vegetables",
        step: { n: 2, say: "Keep the pot handle pointed inward." },
        imageDataUrl,
      }),
    ).rejects.toThrow("the vision model returned invalid observation data");
  });
});
