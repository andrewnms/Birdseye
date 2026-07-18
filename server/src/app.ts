import cors from "cors";
import express from "express";

import type { LessonPlan } from "../../src/features/lesson/lib/plan";
import type { RealtimeClientSecretMinter } from "./realtime-client-secret";
import {
  parseVisionAnalysisRequest,
  parseVisionObservation,
  type VisionAnalyzer,
} from "./vision";
import {
  parseNarrationText,
  parseVoiceChatRequest,
  parseVoiceClip,
  type VoiceService,
} from "./voice";

type ServerOptions = {
  clientSecretMinter: RealtimeClientSecretMinter;
  planner: {
    create(goal: string): Promise<LessonPlan>;
  };
  visionAnalyzer: VisionAnalyzer;
  voiceService: VoiceService;
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

export function createServerApp({
  clientSecretMinter,
  planner,
  visionAnalyzer,
  voiceService,
}: ServerOptions) {
  const app = express();
  const clientSecretAttempts = new Map<string, { count: number; expiresAt: number }>();

  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const startedAt = Date.now();
    response.on("finish", () => {
      console.log(
        `${request.method} ${request.path} ${response.statusCode} ${Date.now() - startedAt}ms`,
      );
    });
    next();
  });
  app.use(express.json({ limit: "800kb" }));
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
    } catch (error) {
      console.error(
        "Birdseye planner request failed:",
        error instanceof Error ? error.message : "unknown server error",
      );
      response.status(502).json({ error: "Unable to create a lesson right now." });
    }
  });
  app.post("/vision/analyze", async (request, response) => {
    const analysisRequest = parseVisionAnalysisRequest(request.body);

    if (!analysisRequest) {
      response
        .status(400)
        .json({ error: "A valid JPEG or PNG camera frame under 768 KB is required." });
      return;
    }

    try {
      const observation = parseVisionObservation(
        await visionAnalyzer.analyze(analysisRequest),
      );

      if (!observation) {
        throw new Error("the vision analyzer returned invalid observation data");
      }

      response.set("Cache-Control", "no-store");
      response.json(observation);
    } catch (error) {
      console.error(
        "Birdseye vision request failed:",
        error instanceof Error ? error.message : "unknown server error",
      );
      response.status(502).json({ error: "Unable to analyze the camera frame right now." });
    }
  });
  app.post("/voice/transcribe", async (request, response) => {
    const clip = parseVoiceClip(request.body);

    if (!clip) {
      response.status(400).json({ error: "A valid bounded voice clip is required." });
      return;
    }

    try {
      const transcript = await voiceService.transcribe(clip);
      response.set("Cache-Control", "no-store");
      response.json({ transcript });
    } catch (error) {
      console.error(
        "Birdseye voice transcription failed:",
        error instanceof Error ? error.message : "unknown server error",
      );
      response.status(502).json({ error: "Unable to transcribe the voice clip right now." });
    }
  });
  app.post("/voice/narrate", async (request, response) => {
    const text = parseNarrationText(
      typeof request.body === "object" && request.body !== null
        ? (request.body as Record<string, unknown>).text
        : null,
    );

    if (!text) {
      response.status(400).json({ error: "Narration text up to 1000 characters is required." });
      return;
    }

    try {
      const audioBase64 = await voiceService.narrate(text);
      response.set("Cache-Control", "no-store");
      response.json({ audioBase64 });
    } catch (error) {
      console.error(
        "Birdseye narration failed:",
        error instanceof Error ? error.message : "unknown server error",
      );
      response.status(502).json({ error: "Unable to narrate this step right now." });
    }
  });
  app.post("/voice/chat", async (request, response) => {
    const chatRequest = parseVoiceChatRequest(request.body);

    if (!chatRequest) {
      response
        .status(400)
        .json({ error: "A valid voice clip with its lesson context is required." });
      return;
    }

    try {
      const reply = await voiceService.chat(chatRequest);
      response.set("Cache-Control", "no-store");
      response.json(reply);
    } catch (error) {
      console.error(
        "Birdseye voice chat failed:",
        error instanceof Error ? error.message : "unknown server error",
      );
      response.status(502).json({ error: "Unable to answer the voice question right now." });
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
