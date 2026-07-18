import { NativeModules } from "react-native";

import type { OverlayPrimitive } from "../../lesson/lib/plan";
import { normalizeRealtimeOverlay } from "../../overlay-tool";
import { createRealtimeCall } from "../api-client/create-realtime-call";
import { getRealtimeClientSecret } from "../api-client/get-realtime-client-secret";

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export type RealtimeOverlayPrimitive = OverlayPrimitive;

export type RealtimeEvent = Record<string, unknown>;

type DataChannelEvent = {
  data?: unknown;
};

type RealtimeDataChannel = {
  addEventListener(
    type: "open" | "message",
    listener: (event: DataChannelEvent) => void,
  ): void;
  send(data: string): void;
  close(): void;
};

type RealtimeTrack = {
  stop(): void;
};

type RealtimeMicrophoneStream = {
  getAudioTracks(): RealtimeTrack[];
};

type RealtimePeerConnection = {
  createDataChannel(label: string): RealtimeDataChannel;
  createOffer(): Promise<{ sdp?: string | null }>;
  setLocalDescription(description: { type: "offer"; sdp: string }): Promise<void>;
  setRemoteDescription(description: { type: "answer"; sdp: string }): Promise<void>;
  addTrack(track: RealtimeTrack, stream: RealtimeMicrophoneStream): unknown;
  close(): void;
};

export type RealtimeWebRtcAdapter = {
  registerGlobals(): void;
  createPeerConnection(): RealtimePeerConnection;
  getUserMedia(constraints: {
    audio: true;
    video: false;
  }): Promise<RealtimeMicrophoneStream>;
};

export type CreateRealtimeSessionOptions = {
  tokenServerUrl: string;
  onOverlay: (overlay: RealtimeOverlayPrimitive[]) => void;
  /** Called only after the guide has interpreted a learner's spoken completion. */
  onAdvance?: () => void;
  onEvent?: (event: RealtimeEvent) => void;
  fetcher?: Fetcher;
  signal?: AbortSignal;
  webrtc?: RealtimeWebRtcAdapter;
};

export type RealtimeSession = {
  sendText(text: string): void;
  completeStep(): void;
  close(): void;
};

const renderOverlayTool = {
  type: "function",
  name: "render_overlay",
  description:
    "Render the precomputed overlay primitives for the current physical-learning step. Never invent geometry. Use only coordinates normalized from 0 to 1 against the on-screen alignment square.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["overlay"],
    properties: {
      overlay: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: true,
          required: ["type"],
          properties: {
            type: {
              type: "string",
              enum: ["arrow", "crease_line", "dot", "fold_curve", "label"],
            },
          },
        },
      },
    },
  },
} as const;

const advanceLessonStepTool = {
  type: "function",
  name: "advance_lesson_step",
  description:
    "Advance exactly one lesson step after the learner clearly says they are done. Do not call this for questions, uncertainty, or narration.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
} as const;

type NativeWebRtcExports = {
  mediaDevices: {
    getUserMedia(constraints: {
      audio: true;
      video: false;
    }): Promise<RealtimeMicrophoneStream>;
  };
  RTCPeerConnection: new () => RealtimePeerConnection;
  registerGlobals(): void;
};

/**
 * Expo Go does not include react-native-webrtc. Avoid evaluating its entry
 * module until its native WebRTCModule is confirmed, so camera annotations
 * remain available there with device-speech guidance.
 */
function nativeWebRtcAdapter(): RealtimeWebRtcAdapter | null {
  if (!("WebRTCModule" in NativeModules)) {
    return null;
  }

  const native = require("react-native-webrtc") as NativeWebRtcExports;

  return {
    registerGlobals: native.registerGlobals,
    createPeerConnection: () => new native.RTCPeerConnection(),
    getUserMedia: (constraints) => native.mediaDevices.getUserMedia(constraints),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRealtimeEvent(value: unknown): RealtimeEvent | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const event: unknown = JSON.parse(value);
    return isRecord(event) && typeof event.type === "string" ? event : null;
  } catch {
    return null;
  }
}

type FunctionCall = {
  callId: string;
  argumentsJson: string;
};

function extractFunctionCall(
  event: RealtimeEvent,
  toolName: "render_overlay" | "advance_lesson_step",
): FunctionCall | null {
  if (
    event.type === "response.function_call_arguments.done" &&
    event.name === toolName &&
    typeof event.call_id === "string" &&
    typeof event.arguments === "string"
  ) {
    return { callId: event.call_id, argumentsJson: event.arguments };
  }

  if (
    event.type === "response.output_item.done" &&
    isRecord(event.item) &&
    event.item.type === "function_call" &&
    event.item.name === toolName &&
    typeof event.item.call_id === "string" &&
    typeof event.item.arguments === "string"
  ) {
    return { callId: event.item.call_id, argumentsJson: event.item.arguments };
  }

  return null;
}

function toUserTextEvent(text: string): RealtimeEvent {
  return {
    type: "conversation.item.create",
    item: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text }],
    },
  };
}

function toFunctionResultEvent(
  callId: string,
  output: Record<string, unknown>,
): RealtimeEvent {
  return {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: callId,
      output: JSON.stringify(output),
    },
  };
}

function releaseMicrophone(stream: RealtimeMicrophoneStream | null): void {
  stream?.getAudioTracks().forEach((track) => track.stop());
}

export async function createRealtimeSession({
  tokenServerUrl,
  onOverlay,
  onAdvance,
  onEvent,
  fetcher,
  signal,
  webrtc,
}: CreateRealtimeSessionOptions): Promise<RealtimeSession> {
  const adapter = webrtc ?? nativeWebRtcAdapter();

  if (!adapter) {
    throw new Error("live voice requires a birdseye development build");
  }

  let microphone: RealtimeMicrophoneStream | null = null;
  let peer: RealtimePeerConnection | null = null;
  let channel: RealtimeDataChannel | null = null;
  let isOpen = false;
  let isClosed = false;
  const completedToolCalls = new Set<string>();
  const queuedEvents: RealtimeEvent[] = [];

  const send = (event: RealtimeEvent): void => {
    if (isClosed) {
      throw new Error("the Realtime session is closed");
    }

    if (!channel) {
      throw new Error("the Realtime session could not create a data channel");
    }

    if (!isOpen) {
      queuedEvents.push(event);
      return;
    }

    channel.send(JSON.stringify(event));
  };

  const close = (): void => {
    if (isClosed) {
      return;
    }

    isClosed = true;
    queuedEvents.length = 0;
    channel?.close();
    peer?.close();
    releaseMicrophone(microphone);
  };

  try {
    adapter.registerGlobals();
    microphone = await adapter.getUserMedia({ audio: true, video: false });
    peer = adapter.createPeerConnection();
    const [audioTrack] = microphone.getAudioTracks();

    if (!audioTrack) {
      throw new Error("the microphone did not provide an audio track");
    }

    peer.addTrack(audioTrack, microphone);
    channel = peer.createDataChannel("oai-events");

    channel.addEventListener("open", () => {
      if (isClosed || !channel) {
        return;
      }

      isOpen = true;
      channel.send(
        JSON.stringify({
          type: "session.update",
          session: {
            tools: [renderOverlayTool, advanceLessonStepTool],
            tool_choice: "auto",
          },
        }),
      );
      queuedEvents.splice(0).forEach((event) => {
        channel?.send(JSON.stringify(event));
      });
    });

    channel.addEventListener("message", (message) => {
      if (isClosed) {
        return;
      }

      const event = parseRealtimeEvent(message.data);

      if (!event) {
        return;
      }

      onEvent?.(event);
      const renderOverlayCall = extractFunctionCall(event, "render_overlay");
      const advanceLessonCall = extractFunctionCall(event, "advance_lesson_step");

      if (!renderOverlayCall && !advanceLessonCall) {
        return;
      }

      const functionCall = renderOverlayCall ?? advanceLessonCall;

      if (!functionCall || completedToolCalls.has(functionCall.callId)) {
        return;
      }

      completedToolCalls.add(functionCall.callId);

      if (advanceLessonCall) {
        onAdvance?.();

        try {
          send(
            toFunctionResultEvent(functionCall.callId, {
              status: "advanced",
            }),
          );
          send({ type: "response.create" });
        } catch {
          // A closing channel needs no tool result because the server cannot receive it.
        }
        return;
      }

      const overlay = normalizeRealtimeOverlay(functionCall.argumentsJson);

      if (overlay.length > 0) {
        onOverlay(overlay);
      }

      try {
        send(
          toFunctionResultEvent(functionCall.callId, {
            status: overlay.length > 0 ? "rendered" : "skipped",
            rendered_primitives: overlay.length,
          }),
        );
        send({ type: "response.create" });
      } catch {
        // A closing channel needs no tool result because the server cannot receive it.
      }
    });

    const clientSecret = await getRealtimeClientSecret({
      baseUrl: tokenServerUrl,
      fetcher,
      signal,
    });
    const offer = await peer.createOffer();

    if (!offer.sdp) {
      throw new Error("the phone could not create a WebRTC offer");
    }

    await peer.setLocalDescription({ type: "offer", sdp: offer.sdp });
    const answerSdp = await createRealtimeCall({
      clientSecret,
      offerSdp: offer.sdp,
      fetcher,
      signal,
    });
    await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });

    return {
      sendText(text: string): void {
        const normalizedText = text.trim();

        if (!normalizedText) {
          throw new Error("enter a message before sending it to the guide");
        }

        send(toUserTextEvent(normalizedText));
        send({ type: "response.create" });
      },
      completeStep(): void {
        send(toUserTextEvent("done"));
        send({ type: "response.create" });
      },
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}
