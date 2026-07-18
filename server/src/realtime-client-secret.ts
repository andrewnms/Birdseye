type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export type RealtimeClientSecret = {
  value: string;
  expires_at?: number;
};

type RealtimeClientSecretMinterOptions = {
  apiKey: string;
  model?: string;
  voice?: string;
  safetyIdentifier?: string;
  fetcher?: Fetcher;
};

export type RealtimeClientSecretMinter = {
  mint(): Promise<RealtimeClientSecret>;
};

const clientSecretsUrl = "https://api.openai.com/v1/realtime/client_secrets";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseClientSecret(payload: unknown): RealtimeClientSecret {
  if (!isRecord(payload) || typeof payload.value !== "string" || !payload.value) {
    throw new Error("OpenAI returned an invalid realtime client secret");
  }

  if (payload.expires_at !== undefined && typeof payload.expires_at !== "number") {
    throw new Error("OpenAI returned an invalid realtime client secret");
  }

  return payload.expires_at === undefined
    ? { value: payload.value }
    : { value: payload.value, expires_at: payload.expires_at };
}

export function createRealtimeClientSecretMinter({
  apiKey,
  model = "gpt-realtime-2.1",
  voice = "marin",
  safetyIdentifier,
  fetcher = fetch,
}: RealtimeClientSecretMinterOptions): RealtimeClientSecretMinter {
  if (!apiKey.trim()) {
    throw new Error("OPENAI_API_KEY is required to mint realtime client secrets");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (safetyIdentifier?.trim()) {
    headers["OpenAI-Safety-Identifier"] = safetyIdentifier;
  }

  return {
    async mint(): Promise<RealtimeClientSecret> {
      const response = await fetcher(clientSecretsUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          session: {
            type: "realtime",
            model,
            audio: {
              output: {
                voice,
              },
            },
          },
        }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error("OpenAI could not mint a realtime client secret");
      }

      return parseClientSecret(payload);
    },
  };
}
