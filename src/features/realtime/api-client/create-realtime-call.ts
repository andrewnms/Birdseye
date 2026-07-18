type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

type CreateRealtimeCallOptions = {
  clientSecret: string;
  offerSdp: string;
  fetcher?: Fetcher;
  signal?: AbortSignal;
};

const realtimeCallsUrl = "https://api.openai.com/v1/realtime/calls";

export async function createRealtimeCall({
  clientSecret,
  offerSdp,
  fetcher = fetch,
  signal,
}: CreateRealtimeCallOptions): Promise<string> {
  const response = await fetcher(realtimeCallsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clientSecret}`,
      "Content-Type": "application/sdp",
    },
    body: offerSdp,
    signal,
  });
  const answerSdp = await response.text();

  if (!response.ok) {
    throw new Error(answerSdp || "the Realtime service rejected the connection");
  }

  if (!answerSdp.trim()) {
    throw new Error("the Realtime service returned an empty session answer");
  }

  return answerSdp;
}
