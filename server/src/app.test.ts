import type { AddressInfo } from "node:net";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import type { Express } from "express";

import { createServerApp } from "./app";
import type { LessonPlan } from "../../src/features/lesson/lib/plan";
import type { RealtimeClientSecretMinter } from "./realtime-client-secret";
import type { VisionAnalyzer } from "./vision";
import type { VoiceService } from "./voice";

type Planner = {
  create(goal: string): Promise<LessonPlan>;
};

type AppResponse = {
  body: string;
  headers: IncomingHttpHeaders;
  status: number;
};

type AppRequest = {
  body?: string;
  headers?: Record<string, string>;
  method?: string;
};

function createTestApp(
  clientSecretMinter: RealtimeClientSecretMinter = { mint: jest.fn() },
  planner: Planner = { create: jest.fn() },
  visionAnalyzer: VisionAnalyzer = { analyze: jest.fn() },
  voiceService: VoiceService = { transcribe: jest.fn(), chat: jest.fn(), narrate: jest.fn() },
): Express {
  return createServerApp({ clientSecretMinter, planner, visionAnalyzer, voiceService });
}

async function requestApp(app: Express, path: string, init?: AppRequest): Promise<AppResponse> {
  const server = app.listen(0, "127.0.0.1");

  await new Promise<void>((resolve) => server.once("listening", resolve));

  try {
    const { port } = server.address() as AddressInfo;

    return await new Promise<AppResponse>((resolve, reject) => {
      const request = httpRequest(
        {
          host: "127.0.0.1",
          port,
          path,
          method: init?.method ?? "GET",
          headers: init?.headers,
        },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => {
            body += chunk;
          });
          response.on("end", () => {
            resolve({ body, headers: response.headers, status: response.statusCode ?? 0 });
          });
        },
      );

      request.on("error", reject);
      request.end(init?.body);
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

describe("local server", () => {
  it("reports that the local server is healthy", async () => {
    const response = await requestApp(createTestApp(), "/health");

    expect(JSON.parse(response.body)).toEqual({ status: "ok" });
    expect(response.status).toBe(200);
  });

  it("returns a short-lived client secret without caching it", async () => {
    const mint = jest.fn().mockResolvedValue({
      value: "ek_live_example",
      expires_at: 1_800_000_000,
    });
    const response = await requestApp(
      createTestApp({ mint }),
      "/realtime/client-secret",
      { method: "POST" },
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      value: "ek_live_example",
      expires_at: 1_800_000_000,
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it("does not expose upstream failure details to a LAN client", async () => {
    const response = await requestApp(
      createTestApp({
        mint: jest.fn().mockRejectedValue(new Error("Authorization: Bearer server-only-key")),
      }),
      "/realtime/client-secret",
      { method: "POST" },
    );

    expect(response.status).toBe(502);
    expect(JSON.parse(response.body)).toEqual({
      error: "Unable to create a realtime client secret.",
    });
    expect(response.body).not.toContain("server-only-key");
  });

  it("allows browser requests from a private LAN development origin", async () => {
    const response = await requestApp(
      createTestApp(),
      "/health",
      { headers: { Origin: "http://192.168.1.42:8081" } },
    );

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://192.168.1.42:8081",
    );
  });

  it("rate limits minting to reduce the impact of an exposed LAN server", async () => {
    const mint = jest.fn().mockResolvedValue({ value: "ek_live_example" });
    const minter = { mint };
    const app = createTestApp(minter);

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await requestApp(
        app,
        "/realtime/client-secret",
        { method: "POST" },
      );
      expect(response.status).toBe(200);
    }

    const response = await requestApp(
      app,
      "/realtime/client-secret",
      { method: "POST" },
    );

    expect(response.status).toBe(429);
    expect(JSON.parse(response.body)).toEqual({
      error: "Too many realtime client-secret requests. Try again shortly.",
    });
    expect(mint).toHaveBeenCalledTimes(12);
  });

  it("turns a practical learner goal into a validated lesson without exposing server configuration", async () => {
    const planner = {
      create: jest.fn().mockResolvedValue({
        goal: "assemble a pcb",
        steps: [
          {
            n: 1,
            say: "Place the board in the square.",
            overlay: [{ type: "label", at: [0.5, 0.5], text: "pcb" }],
          },
        ],
      }),
    };
    const response = await requestApp(createTestApp({ mint: jest.fn() }, planner), "/planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: "assemble a pcb" }),
    });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ goal: "assemble a pcb" });
    expect(planner.create).toHaveBeenCalledWith("assemble a pcb");
  });

  it("turns one bounded camera frame into generic visual guidance", async () => {
    const analyze = jest.fn().mockResolvedValue({
      observation: "The connector is aligned with the board pads.",
      overlay: [{ type: "dot", at: [0.5, 0.5] }],
    });
    const response = await requestApp(
      createTestApp({ mint: jest.fn() }, { create: jest.fn() }, { analyze }),
      "/vision/analyze",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: "solder a pcb connector",
          step: { n: 3, say: "Align the connector with the pads." },
          imageDataUrl: "data:image/jpeg;base64,aGVsbG8=",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      observation: "The connector is aligned with the board pads.",
      overlay: [{ type: "dot", at: [0.5, 0.5] }],
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(analyze).toHaveBeenCalledWith({
      goal: "solder a pcb connector",
      step: { n: 3, say: "Align the connector with the pads." },
      imageDataUrl: "data:image/jpeg;base64,aGVsbG8=",
    });
  });

  it("rejects a non-JPEG or PNG frame before it reaches the vision model", async () => {
    const analyze = jest.fn();
    const response = await requestApp(
      createTestApp({ mint: jest.fn() }, { create: jest.fn() }, { analyze }),
      "/vision/analyze",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: "prepare a cutting board",
          step: { n: 1, say: "Place the board on a stable surface." },
          imageDataUrl: "data:image/gif;base64,R0lGODlh",
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: "A valid JPEG or PNG camera frame under 768 KB is required.",
    });
    expect(analyze).not.toHaveBeenCalled();
  });

  it("accepts a bounded frame larger than normal lesson payloads", async () => {
    const analyze = jest.fn().mockResolvedValue({
      observation: "The board is centered in the work area.",
      overlay: [],
    });
    const imageDataUrl = `data:image/png;base64,${"A".repeat(20 * 1024)}`;
    const response = await requestApp(
      createTestApp({ mint: jest.fn() }, { create: jest.fn() }, { analyze }),
      "/vision/analyze",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: "prepare a cutting board",
          step: { n: 1, say: "Place the board on a stable surface." },
          imageDataUrl,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(analyze).toHaveBeenCalledWith(
      expect.objectContaining({ imageDataUrl }),
    );
  });

  it("rejects a frame at or above the 768 KB data-url cap before analysis", async () => {
    const analyze = jest.fn();
    const imageDataUrl = `data:image/png;base64,${"A".repeat(196_608 * 4)}`;
    const response = await requestApp(
      createTestApp({ mint: jest.fn() }, { create: jest.fn() }, { analyze }),
      "/vision/analyze",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: "prepare a cutting board",
          step: { n: 1, say: "Place the board on a stable surface." },
          imageDataUrl,
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      error: "A valid JPEG or PNG camera frame under 768 KB is required.",
    });
    expect(analyze).not.toHaveBeenCalled();
  });

  it("does not return an invalid observation when an analyzer adapter misbehaves", async () => {
    const response = await requestApp(
      createTestApp(
        { mint: jest.fn() },
        { create: jest.fn() },
        {
          analyze: jest.fn().mockResolvedValue({
            observation: "The pot handle is visible.",
            overlay: [{ type: "dot", at: [1.2, 0.5] }],
          }),
        },
      ),
      "/vision/analyze",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: "saute vegetables",
          step: { n: 2, say: "Keep the pot handle pointed inward." },
          imageDataUrl: "data:image/jpeg;base64,aGVsbG8=",
        }),
      },
    );

    expect(response.status).toBe(502);
    expect(JSON.parse(response.body)).toEqual({
      error: "Unable to analyze the camera frame right now.",
    });
  });
});
