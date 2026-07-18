import dotenv from "dotenv";

import { createServerApp } from "./app";
import { readServerConfig } from "./config";
import { createPlanner } from "./planner";
import { createRealtimeClientSecretMinter } from "./realtime-client-secret";
import { createVisionAnalyzer } from "./vision";
import { createVoiceService } from "./voice";

dotenv.config({ path: ".env.local", quiet: true });

const config = readServerConfig(process.env);
const app = createServerApp({
  clientSecretMinter: createRealtimeClientSecretMinter({
    apiKey: config.apiKey,
    model: config.model,
    voice: config.voice,
  }),
  planner: createPlanner({
    apiKey: config.apiKey,
    model: config.plannerModel,
  }),
  visionAnalyzer: createVisionAnalyzer({
    apiKey: config.apiKey,
    model: config.visionModel,
  }),
  voiceService: createVoiceService({ apiKey: config.apiKey }),
});

app.listen(config.port, config.host, () => {
  console.info(`Birdseye local server listening on http://${config.host}:${config.port}`);
});
