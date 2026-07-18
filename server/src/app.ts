import cors from "cors";
import express from "express";

import type { LessonPlan } from "../../src/features/lesson/lib/plan";
import type { RealtimeClientSecretMinter } from "./realtime-client-secret";

type ServerOptions = {
  clientSecretMinter: RealtimeClientSecretMinter;
  planner: {
    create(goal: string): Promise<LessonPlan>;
  };
};

const clientSecretLimit = 12;
const clientSecretLimitWindowMs = 60_000;

function isPrivateLanHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]"
  ) {
    return true;
  }

  const octets = normalized.split(".").map(Number);

  const isIpv4 =
    octets.length === 4 &&
    octets.every(
      (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255,
    );

  if (isIpv4) {
    return (
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }

  return (
    normalized.startsWith("[fc") ||
    normalized.startsWith("[fd") ||
    normalized.startsWith("[fe80:")
  );
}

function isAllowedLanOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);

    return (url.protocol === "http:" || url.protocol === "https:") && isPrivateLanHostname(url.hostname);
  } catch {
    return false;
  }
}

function hasGoal(value: unknown): value is { goal: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "goal" in value &&
    typeof value.goal === "string"
  );
}

export function createServerApp({ clientSecretMinter, planner }: ServerOptions) {
  const app = express();
  const clientSecretAttempts = new Map<string, { count: number; expiresAt: number }>();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, origin && isAllowedLanOrigin(origin) ? origin : false);
      },
    }),
  );
  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.post("/planner", async (request, response) => {
    if (!hasGoal(request.body) || request.body.goal.trim() === "") {
      response.status(400).json({ error: "A practical goal is required." });
      return;
    }

    try {
      const plan = await planner.create(request.body.goal.trim());
      response.json(plan);
    } catch {
      response.status(502).json({ error: "Unable to create a lesson right now." });
    }
  });
  app.post("/realtime/client-secret", async (request, response) => {
    const key = request.ip ?? "unknown";
    const now = Date.now();
    const existing = clientSecretAttempts.get(key);
    const attempts =
      existing && existing.expiresAt > now
        ? existing
        : { count: 0, expiresAt: now + clientSecretLimitWindowMs };

    if (attempts.count >= clientSecretLimit) {
      response
        .set("Retry-After", String(Math.ceil((attempts.expiresAt - now) / 1_000)))
        .status(429)
        .json({ error: "Too many realtime client-secret requests. Try again shortly." });
      return;
    }

    attempts.count += 1;
    clientSecretAttempts.set(key, attempts);

    try {
      const clientSecret = await clientSecretMinter.mint();

      response.set("Cache-Control", "no-store");
      response.json(clientSecret);
    } catch {
      response.status(502).json({ error: "Unable to create a realtime client secret." });
    }
  });

  return app;
}
