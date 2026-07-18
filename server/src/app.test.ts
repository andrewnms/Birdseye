import type { AddressInfo } from "node:net";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import type { Express } from "express";

import { createServerApp } from "./app";
import type { LessonPlan } from "../../src/features/lesson/lib/plan";
import type { RealtimeClientSecretMinter } from "./realtime-client-secret";

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
): Express {
  return createServerApp({ clientSecretMinter, planner });
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
});
