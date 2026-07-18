import { createRealtimeClientSecretMinter } from "./realtime-client-secret";

describe("realtime client secret minter", () => {
  it("mints an ephemeral secret using the server-only API key", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          value: "ek_live_example",
          expires_at: 1_800_000_000,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const minter = createRealtimeClientSecretMinter({
      apiKey: "server-only-key",
      fetcher,
    });

    await expect(minter.mint()).resolves.toEqual({
      value: "ek_live_example",
      expires_at: 1_800_000_000,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/client_secrets",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer server-only-key",
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});
