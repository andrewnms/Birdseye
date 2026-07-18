jest.mock("react-native-webrtc", () => ({
  mediaDevices: {},
  RTCPeerConnection: jest.fn(),
  registerGlobals: jest.fn(),
}));

import { createRealtimeSession } from "./create-realtime-session";

type Listener = (event: { data?: unknown }) => void;

function createDataChannel() {
  const listeners = new Map<string, Listener>();

  return {
    send: jest.fn(),
    close: jest.fn(),
    addEventListener: jest.fn((type: string, listener: Listener) => {
      listeners.set(type, listener);
    }),
    emit(type: string, event: { data?: unknown } = {}) {
      listeners.get(type)?.(event);
    },
  };
}

describe("createRealtimeSession", () => {
  it("connects the microphone and configures overlay and voice-step tools with an ephemeral client secret", async () => {
    const channel = createDataChannel();
    const audioTrack = { stop: jest.fn() };
    const microphone = { getAudioTracks: () => [audioTrack] };
    const peer = {
      createDataChannel: jest.fn(() => channel),
      createOffer: jest.fn().mockResolvedValue({ type: "offer", sdp: "offer-sdp" }),
      setLocalDescription: jest.fn().mockResolvedValue(undefined),
      setRemoteDescription: jest.fn().mockResolvedValue(undefined),
      addTrack: jest.fn(),
      close: jest.fn(),
    };
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ value: "ek_test_only" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response("answer-sdp", { status: 200 }));
    const webrtc = {
      registerGlobals: jest.fn(),
      createPeerConnection: jest.fn(() => peer),
      getUserMedia: jest.fn().mockResolvedValue(microphone),
    };

    await createRealtimeSession({
      tokenServerUrl: "http://192.168.1.20:3000",
      onOverlay: jest.fn(),
      fetcher,
      webrtc,
    });

    expect(webrtc.registerGlobals).toHaveBeenCalledTimes(1);
    expect(webrtc.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(peer.addTrack).toHaveBeenCalledWith(audioTrack, microphone);
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://192.168.1.20:3000/realtime/client-secret",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://api.openai.com/v1/realtime/calls",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer ek_test_only",
          "Content-Type": "application/sdp",
        },
        body: "offer-sdp",
      }),
    );
    expect(peer.setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "answer-sdp",
    });

    channel.emit("open");

    expect(channel.send).toHaveBeenCalledWith(
      expect.stringContaining('"name":"render_overlay"'),
    );
    expect(channel.send).toHaveBeenCalledWith(
      expect.stringContaining('"name":"advance_lesson_step"'),
    );
  });

  it("delivers valid render_overlay primitives once and acknowledges the tool call", async () => {
    const channel = createDataChannel();
    const audioTrack = { stop: jest.fn() };
    const microphone = { getAudioTracks: () => [audioTrack] };
    const peer = {
      createDataChannel: jest.fn(() => channel),
      createOffer: jest.fn().mockResolvedValue({ type: "offer", sdp: "offer-sdp" }),
      setLocalDescription: jest.fn().mockResolvedValue(undefined),
      setRemoteDescription: jest.fn().mockResolvedValue(undefined),
      addTrack: jest.fn(),
      close: jest.fn(),
    };
    const onOverlay = jest.fn();

    await createRealtimeSession({
      tokenServerUrl: "http://192.168.1.20:3000",
      onOverlay,
      fetcher: jest
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ value: "ek_test_only" }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response("answer-sdp", { status: 200 })),
      webrtc: {
        registerGlobals: jest.fn(),
        createPeerConnection: jest.fn(() => peer),
        getUserMedia: jest.fn().mockResolvedValue(microphone),
      },
    });

    channel.emit("open");
    const renderEvent = {
      type: "response.function_call_arguments.done",
      name: "render_overlay",
      call_id: "call_123",
      arguments: JSON.stringify({
        overlay: [
          { type: "arrow", from: [0, 0], to: [1, 1] },
          { type: "crease_line", from: [0, 1], to: [1, 0] },
          { type: "dot", at: [0.5, 0.5] },
          { type: "fold_curve", from: [0, 0.5], to: [1, 0.5] },
          { type: "label", at: [0.5, 0.4], text: "center" },
          { type: "unknown", at: [0.5, 0.4] },
        ],
      }),
    };

    channel.emit("message", { data: JSON.stringify(renderEvent) });
    channel.emit("message", { data: JSON.stringify(renderEvent) });

    expect(onOverlay).toHaveBeenCalledTimes(1);
    expect(onOverlay).toHaveBeenCalledWith([
      { type: "arrow", from: [0, 0], to: [1, 1] },
      { type: "crease_line", from: [0, 1], to: [1, 0] },
      { type: "dot", at: [0.5, 0.5] },
      { type: "fold_curve", from: [0, 0.5], to: [1, 0.5] },
      { type: "label", at: [0.5, 0.4], text: "center" },
    ]);

    const sentEvents = channel.send.mock.calls.map(([message]) => JSON.parse(message));
    expect(sentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "conversation.item.create",
          item: expect.objectContaining({
            type: "function_call_output",
            call_id: "call_123",
          }),
        }),
        { type: "response.create" },
      ]),
    );
  });

  it("advances exactly once when the guide receives a spoken done turn", async () => {
    const channel = createDataChannel();
    const audioTrack = { stop: jest.fn() };
    const microphone = { getAudioTracks: () => [audioTrack] };
    const peer = {
      createDataChannel: jest.fn(() => channel),
      createOffer: jest.fn().mockResolvedValue({ type: "offer", sdp: "offer-sdp" }),
      setLocalDescription: jest.fn().mockResolvedValue(undefined),
      setRemoteDescription: jest.fn().mockResolvedValue(undefined),
      addTrack: jest.fn(),
      close: jest.fn(),
    };
    const onAdvance = jest.fn();

    await createRealtimeSession({
      tokenServerUrl: "http://192.168.1.20:3000",
      onOverlay: jest.fn(),
      onAdvance,
      fetcher: jest
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ value: "ek_test_only" }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response("answer-sdp", { status: 200 })),
      webrtc: {
        registerGlobals: jest.fn(),
        createPeerConnection: jest.fn(() => peer),
        getUserMedia: jest.fn().mockResolvedValue(microphone),
      },
    });

    channel.emit("open");
    const advanceEvent = {
      type: "response.function_call_arguments.done",
      name: "advance_lesson_step",
      call_id: "call_done",
      arguments: "{}",
    };

    channel.emit("message", { data: JSON.stringify(advanceEvent) });
    channel.emit("message", { data: JSON.stringify(advanceEvent) });

    expect(onAdvance).toHaveBeenCalledTimes(1);
    const sentEvents = channel.send.mock.calls.map(([message]) => JSON.parse(message));
    expect(sentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "conversation.item.create",
          item: expect.objectContaining({
            type: "function_call_output",
            call_id: "call_done",
          }),
        }),
      ]),
    );
  });

  it("sends typed guidance requests and step completion as user turns", async () => {
    const channel = createDataChannel();
    const audioTrack = { stop: jest.fn() };
    const microphone = { getAudioTracks: () => [audioTrack] };
    const peer = {
      createDataChannel: jest.fn(() => channel),
      createOffer: jest.fn().mockResolvedValue({ type: "offer", sdp: "offer-sdp" }),
      setLocalDescription: jest.fn().mockResolvedValue(undefined),
      setRemoteDescription: jest.fn().mockResolvedValue(undefined),
      addTrack: jest.fn(),
      close: jest.fn(),
    };
    const session = await createRealtimeSession({
      tokenServerUrl: "http://192.168.1.20:3000",
      onOverlay: jest.fn(),
      fetcher: jest
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ value: "ek_test_only" }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response("answer-sdp", { status: 200 })),
      webrtc: {
        registerGlobals: jest.fn(),
        createPeerConnection: jest.fn(() => peer),
        getUserMedia: jest.fn().mockResolvedValue(microphone),
      },
    });

    channel.emit("open");
    session.sendText("show me the next safe step");
    session.completeStep();

    const sentEvents = channel.send.mock.calls.map(([message]) => JSON.parse(message));
    expect(sentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "conversation.item.create",
          item: expect.objectContaining({
            role: "user",
            content: [{ type: "input_text", text: "show me the next safe step" }],
          }),
        }),
        expect.objectContaining({
          type: "conversation.item.create",
          item: expect.objectContaining({
            role: "user",
            content: [{ type: "input_text", text: "done" }],
          }),
        }),
      ]),
    );
    expect(sentEvents.filter((event) => event.type === "response.create")).toHaveLength(2);
  });

  it("queues a user turn until the data channel is ready", async () => {
    const channel = createDataChannel();
    const audioTrack = { stop: jest.fn() };
    const microphone = { getAudioTracks: () => [audioTrack] };
    const peer = {
      createDataChannel: jest.fn(() => channel),
      createOffer: jest.fn().mockResolvedValue({ type: "offer", sdp: "offer-sdp" }),
      setLocalDescription: jest.fn().mockResolvedValue(undefined),
      setRemoteDescription: jest.fn().mockResolvedValue(undefined),
      addTrack: jest.fn(),
      close: jest.fn(),
    };
    const session = await createRealtimeSession({
      tokenServerUrl: "http://192.168.1.20:3000",
      onOverlay: jest.fn(),
      fetcher: jest
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ value: "ek_test_only" }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response("answer-sdp", { status: 200 })),
      webrtc: {
        registerGlobals: jest.fn(),
        createPeerConnection: jest.fn(() => peer),
        getUserMedia: jest.fn().mockResolvedValue(microphone),
      },
    });

    expect(() => session.sendText("start the lesson")).not.toThrow();
    expect(channel.send).not.toHaveBeenCalled();

    channel.emit("open");

    const sentEvents = channel.send.mock.calls.map(([message]) => JSON.parse(message));
    expect(sentEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "conversation.item.create",
          item: expect.objectContaining({
            content: [{ type: "input_text", text: "start the lesson" }],
          }),
        }),
        { type: "response.create" },
      ]),
    );
  });
});
