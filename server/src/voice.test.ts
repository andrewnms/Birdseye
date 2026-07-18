import { createVoiceService, parseVoiceChatRequest, parseVoiceClip } from "./voice";

const audioBase64 = "aGVsbG8=";

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("voice clip parsing", () => {
  it("accepts a bounded m4a clip and defaults the mime type", () => {
    expect(parseVoiceClip({ audioBase64 })).toEqual({
      audioBase64,
      mimeType: "audio/m4a",
    });
  });

  it("rejects unsupported payloads", () => {
    expect(parseVoiceClip(null)).toBeNull();
    expect(parseVoiceClip({ audioBase64: "not base64!!" })).toBeNull();
    expect(parseVoiceClip({ audioBase64, mimeType: "video/mp4" })).toBeNull();
    expect(
      parseVoiceClip({ audioBase64: "A".repeat(600_004) }),
    ).toBeNull();
  });
});

describe("voice chat request parsing", () => {
  it("requires the lesson context alongside the clip", () => {
    expect(
      parseVoiceChatRequest({
        audioBase64,
        goal: "fold an origami crane",
        step: { n: 2, say: "Fold the paper in half." },
        observation: "The paper is folded diagonally.",
      }),
    ).toEqual({
      audioBase64,
      mimeType: "audio/m4a",
      goal: "fold an origami crane",
      step: { n: 2, say: "Fold the paper in half." },
      observation: "The paper is folded diagonally.",
    });

    expect(parseVoiceChatRequest({ audioBase64, goal: "", step: { n: 2, say: "x" } })).toBeNull();
    expect(parseVoiceChatRequest({ audioBase64, goal: "goal", step: { n: 0, say: "x" } })).toBeNull();
  });
});

describe("voice service", () => {
  it("transcribes a clip with the server-only key", async () => {
    const fetcher = jest.fn().mockResolvedValue(jsonResponse({ text: " fold it here " }));
    const service = createVoiceService({ apiKey: "server-only-key", fetcher });

    await expect(service.transcribe({ audioBase64, mimeType: "audio/m4a" })).resolves.toBe(
      "fold it here",
    );

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect(init.headers).toEqual({ Authorization: "Bearer server-only-key" });
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get("model")).toBe("gpt-4o-mini-transcribe");
  });

  it("answers a lesson question and returns synthesized speech", async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ text: "which corner do I fold?" }))
      .mockResolvedValueOnce(jsonResponse({ output_text: "Fold the top right corner." }))
      .mockResolvedValueOnce(
        new Response(Buffer.from("mp3-bytes"), {
          status: 200,
          headers: { "Content-Type": "audio/mpeg" },
        }),
      );
    const service = createVoiceService({ apiKey: "server-only-key", fetcher });

    await expect(
      service.chat({
        audioBase64,
        mimeType: "audio/m4a",
        goal: "fold an origami crane",
        step: { n: 2, say: "Fold the paper in half." },
        observation: "The paper is on the table.",
      }),
    ).resolves.toEqual({
      transcript: "which corner do I fold?",
      reply: "Fold the top right corner.",
      replyAudioBase64: Buffer.from("mp3-bytes").toString("base64"),
    });

    const chatBody = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(chatBody.model).toBe("gpt-5.6");
    expect(chatBody.input[1].content).toContain("which corner do I fold?");
    expect(chatBody.input[1].content).toContain("Camera observation: The paper is on the table.");

    const speechBody = JSON.parse(fetcher.mock.calls[2][1].body);
    expect(speechBody).toEqual(
      expect.objectContaining({
        model: "gpt-4o-mini-tts",
        voice: "coral",
        input: "Fold the top right corner.",
      }),
    );
  });

  it("surfaces transcription failures without inventing speech", async () => {
    const fetcher = jest.fn().mockResolvedValue(new Response("{}", { status: 400 }));
    const service = createVoiceService({ apiKey: "server-only-key", fetcher });

    await expect(service.transcribe({ audioBase64, mimeType: "audio/m4a" })).rejects.toThrow(
      "the transcription request failed",
    );
  });
});
