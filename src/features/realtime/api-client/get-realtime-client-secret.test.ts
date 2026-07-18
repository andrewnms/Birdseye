import { getRealtimeClientSecret } from "./get-realtime-client-secret";

describe("getRealtimeClientSecret", () => {
  it("gets an ephemeral Realtime secret from the local server without exposing the API key", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ value: "ek_test_only" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      getRealtimeClientSecret({
        baseUrl: "http://192.168.1.20:3000",
        fetcher,
      }),
    ).resolves.toBe("ek_test_only");

    expect(fetcher).toHaveBeenCalledWith(
      "http://192.168.1.20:3000/realtime/client-secret",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
