import { analyzeCameraFrame } from "./analyze-camera-frame";

describe("analyzeCameraFrame", () => {
  it("sends one current camera frame to the private vision endpoint and keeps only safe annotations", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          observation: "the folded edge is visible near the center.",
          overlay: [
            { type: "label", at: [0.5, 0.5], text: "fold here" },
            { type: "unknown", at: [0.5, 0.5] },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(
      analyzeCameraFrame(
        {
          goal: "fold a paper crane",
          step: { n: 3, say: "Fold the top corner down." },
          imageDataUrl: "data:image/jpeg;base64,frame-data",
        },
        { baseUrl: "http://192.168.1.20:3000", fetcher },
      ),
    ).resolves.toEqual({
      observation: "the folded edge is visible near the center.",
      overlay: [{ type: "label", at: [0.5, 0.5], text: "fold here" }],
    });

    expect(fetcher).toHaveBeenCalledWith(
      "http://192.168.1.20:3000/vision/analyze",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: "fold a paper crane",
          step: { n: 3, say: "Fold the top corner down." },
          imageDataUrl: "data:image/jpeg;base64,frame-data",
        }),
      }),
    );
  });

  it("fails safely when the vision response is malformed", async () => {
    await expect(
      analyzeCameraFrame(
        {
          goal: "prepare dinner",
          step: { n: 1, say: "Set ingredients on the counter." },
          imageDataUrl: "data:image/jpeg;base64,frame-data",
        },
        {
          baseUrl: "http://192.168.1.20:3000",
          fetcher: jest.fn().mockResolvedValue(
            new Response(JSON.stringify({ observation: 12, overlay: [] }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
          ),
        },
      ),
    ).rejects.toThrow("the vision service returned an invalid analysis");
  });
});
