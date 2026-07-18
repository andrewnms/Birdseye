type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export type VoiceClipInput = {
  audioBase64: string;
  mimeType?: string;
};

export type VoiceQuestionInput = VoiceClipInput & {
  goal: string;
  step: {
    n: number;
    say: string;
  };
  observation?: string;
};

export type VoiceReply = {
  transcript: string;
  reply: string;
  replyAudioBase64: string;
};

type VoiceRequestOptions = {
  baseUrl: string;
  fetcher?: Fetcher;
  signal?: AbortSignal;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseError(payload: unknown, fallback: string): string {
  return isRecord(payload) && typeof payload.error === "string"
    ? payload.error
    : fallback;
}

async function postJson(
  path: string,
  body: unknown,
  { baseUrl, fetcher = fetch, signal }: VoiceRequestOptions,
  fallbackError: string,
): Promise<unknown> {
  const response = await fetcher(`${baseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(responseError(payload, fallbackError));
  }

  return payload;
}

/** Turns one recorded clip into text through the private local server. */
export async function transcribeVoiceClip(
  input: VoiceClipInput,
  options: VoiceRequestOptions,
): Promise<string> {
  const payload = await postJson(
    "/voice/transcribe",
    input,
    options,
    "the voice service could not transcribe the clip",
  );

  if (!isRecord(payload) || typeof payload.transcript !== "string" || !payload.transcript) {
    throw new Error("the voice service returned an invalid transcript");
  }

  return payload.transcript;
}

/** Synthesizes one step narration into mp3 audio through the private server. */
export async function narrateText(
  text: string,
  options: VoiceRequestOptions,
): Promise<string> {
  const payload = await postJson(
    "/voice/narrate",
    { text },
    options,
    "the voice service could not narrate this step",
  );

  if (!isRecord(payload) || typeof payload.audioBase64 !== "string" || !payload.audioBase64) {
    throw new Error("the voice service returned invalid narration audio");
  }

  return payload.audioBase64;
}

/** Asks the tutor one spoken question and returns its text plus mp3 audio. */
export async function askVoiceQuestion(
  input: VoiceQuestionInput,
  options: VoiceRequestOptions,
): Promise<VoiceReply> {
  const payload = await postJson(
    "/voice/chat",
    input,
    options,
    "the voice service could not answer the question",
  );

  if (
    !isRecord(payload) ||
    typeof payload.transcript !== "string" ||
    typeof payload.reply !== "string" ||
    typeof payload.replyAudioBase64 !== "string"
  ) {
    throw new Error("the voice service returned an invalid reply");
  }

  return {
    transcript: payload.transcript,
    reply: payload.reply,
    replyAudioBase64: payload.replyAudioBase64,
  };
}
