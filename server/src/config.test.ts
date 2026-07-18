import { readServerConfig } from "./config";

describe("server configuration", () => {
  it("requires the OpenAI API key from the server environment", () => {
    expect(() => readServerConfig({})).toThrow(
      "OPENAI_API_KEY is required to start the local server",
    );
  });

  it("uses explicit local server and realtime session settings", () => {
    expect(
      readServerConfig({
        OPENAI_API_KEY: "server-only-key",
        OPENAI_REALTIME_MODEL: "gpt-realtime-test",
        OPENAI_REALTIME_VOICE: "cedar",
        PORT: "4010",
      }),
    ).toEqual({
      apiKey: "server-only-key",
      host: "0.0.0.0",
      model: "gpt-realtime-test",
      port: 4010,
      voice: "cedar",
    });
  });
});
