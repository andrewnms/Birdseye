type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

type GetRealtimeClientSecretOptions = {
  baseUrl: string;
  fetcher?: Fetcher;
  signal?: AbortSignal;
};

function clientSecretUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/realtime/client-secret`;
}

function errorMessage(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return "the Realtime token server could not mint a client secret";
}

export async function getRealtimeClientSecret({
  baseUrl,
  fetcher = fetch,
  signal,
}: GetRealtimeClientSecretOptions): Promise<string> {
  const response = await fetcher(clientSecretUrl(baseUrl), {
    method: "POST",
    signal,
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(errorMessage(payload));
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("value" in payload) ||
    typeof payload.value !== "string" ||
    payload.value.trim() === ""
  ) {
    throw new Error("the Realtime token server returned an invalid client secret");
  }

  return payload.value;
}
