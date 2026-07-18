import { isRecord, outputText } from "./responses-output";

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export type VoiceClip = {
  audioBase64: string;
  mimeType: string;
};

export type VoiceChatRequest = VoiceClip & {
  goal: string;
  step: {
    n: number;
    say: string;
  };
  observation?: string;
};

export type VoiceChatReply = {
  transcript: string;
  reply: string;
  replyAudioBase64: string;
};

type VoiceServiceOptions = {
  apiKey: string;
  fetcher?: Fetcher;
  transcribeModel?: string;
  chatModel?: string;
  ttsModel?: string;
  ttsVoice?: string;
};

export type VoiceService = {
  transcribe(clip: VoiceClip): Promise<string>;
  chat(request: VoiceChatRequest): Promise<VoiceChatReply>;
  narrate(text: string): Promise<string>;
};

export const maxNarrationLength = 1_000;

export function parseNarrationText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text && text.length <= maxNarrationLength ? text : null;
}

const transcriptionsUrl = "https://api.openai.com/v1/audio/transcriptions";
const responsesUrl = "https://api.openai.com/v1/responses";
const speechUrl = "https://api.openai.com/v1/audio/speech";

export const maxAudioBase64Length = 600_000;

const allowedMimeTypes = new Set(["audio/m4a", "audio/mp4", "audio/mpeg", "audio/wav"]);

const chatInstructions = `You are a hands-on tutor speaking out loud to a learner mid-task.
Use the supplied goal, current step, and camera observation as context.
Answer the learner's question in plain spoken language, at most 60 words.
Never claim you can see anything beyond the supplied observation. Do not use markdown.`;

function isBase64(value: string): boolean {
  return (
    value.length > 0 &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(value)
  );
}

export function parseVoiceClip(value: unknown): VoiceClip | null {
  if (!isRecord(value) || typeof value.audioBase64 !== "string") {
    return null;
  }

  const mimeType =
    typeof value.mimeType === "string" ? value.mimeType.trim() : "audio/m4a";

  if (
    !allowedMimeTypes.has(mimeType) ||
    value.audioBase64.length > maxAudioBase64Length ||
    !isBase64(value.audioBase64)
  ) {
    return null;
  }

  return { audioBase64: value.audioBase64, mimeType };
}

export function parseVoiceChatRequest(value: unknown): VoiceChatRequest | null {
  const clip = parseVoiceClip(value);

  if (!clip || !isRecord(value) || !isRecord(value.step)) {
    return null;
  }

  const goal = typeof value.goal === "string" ? value.goal.trim() : "";
  const stepNumber = value.step.n;
  const stepNarration =
    typeof value.step.say === "string" ? value.step.say.trim() : "";
  const observation =
    typeof value.observation === "string" ? value.observation.trim() : "";

  if (
    !goal ||
    goal.length > 500 ||
    typeof stepNumber !== "number" ||
    !Number.isInteger(stepNumber) ||
    stepNumber < 1 ||
    !stepNarration ||
    stepNarration.length > 1_000 ||
    observation.length > 1_000
  ) {
    return null;
  }

  return {
    ...clip,
    goal,
    step: { n: stepNumber, say: stepNarration },
    ...(observation ? { observation } : {}),
  };
}

export function createVoiceService({
  apiKey,
  fetcher = fetch,
  transcribeModel = "gpt-4o-mini-transcribe",
  chatModel = "gpt-5.6",
  ttsModel = "gpt-4o-mini-tts",
  ttsVoice = "coral",
}: VoiceServiceOptions): VoiceService {
  if (!apiKey.trim()) {
    throw new Error("OPENAI_API_KEY is required to handle voice requests");
  }

  async function transcribe(clip: VoiceClip): Promise<string> {
    const parsed = parseVoiceClip(clip);

    if (!parsed) {
      throw new Error("invalid voice clip");
    }

    const form = new FormData();
    form.append(
      "file",
      new Blob([Buffer.from(parsed.audioBase64, "base64")], { type: parsed.mimeType }),
      "clip.m4a",
    );
    form.append("model", transcribeModel);

    const response = await fetcher(transcriptionsUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error("the transcription request failed");
    }

    const transcript =
      isRecord(payload) && typeof payload.text === "string"
        ? payload.text.trim()
        : "";

    if (!transcript) {
      throw new Error("the transcription returned no speech");
    }

    return transcript;
  }

  async function chat(request: VoiceChatRequest): Promise<VoiceChatReply> {
    const validated = parseVoiceChatRequest(request);

    if (!validated) {
      throw new Error("invalid voice chat request");
    }

    const transcript = await transcribe(validated);

    const context = [
      `Goal: ${validated.goal}`,
      `Current step ${validated.step.n}: ${validated.step.say}`,
      validated.observation ? `Camera observation: ${validated.observation}` : null,
      `Learner said: ${transcript}`,
    ]
      .filter(Boolean)
      .join("\n");

    const chatResponse = await fetcher(responsesUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: chatModel,
        store: false,
        reasoning: { effort: "none" },
        input: [
          { role: "developer", content: chatInstructions },
          { role: "user", content: context },
        ],
      }),
    });
    const chatPayload: unknown = await chatResponse.json().catch(() => null);

    if (!chatResponse.ok) {
      throw new Error("the voice chat request failed");
    }

    const reply = outputText(chatPayload)?.trim();

    if (!reply) {
      throw new Error("the voice chat returned no reply");
    }

    return { transcript, reply, replyAudioBase64: await synthesize(reply) };
  }

  async function synthesize(text: string): Promise<string> {
    const speechResponse = await fetcher(speechUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ttsModel,
        voice: ttsVoice,
        input: text,
        response_format: "mp3",
      }),
    });

    if (!speechResponse.ok) {
      throw new Error("the speech synthesis failed");
    }

    return Buffer.from(await speechResponse.arrayBuffer()).toString("base64");
  }

  async function narrate(text: string): Promise<string> {
    const parsed = parseNarrationText(text);

    if (!parsed) {
      throw new Error("invalid narration text");
    }

    return synthesize(parsed);
  }

  return { transcribe, chat, narrate };
}
