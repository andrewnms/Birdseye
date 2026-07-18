type Environment = Record<string, string | undefined>;

export type ServerConfig = {
  apiKey: string;
  host: "0.0.0.0";
  model: string;
  plannerModel: string;
  port: number;
  voice: string;
};

export function readServerConfig(environment: Environment): ServerConfig {
  const apiKey = environment.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to start the local server");
  }

  const parsedPort = Number(environment.PORT?.trim() ?? "3000");

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return {
    apiKey,
    host: "0.0.0.0",
    model: environment.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime-2.1",
    plannerModel: environment.OPENAI_PLANNER_MODEL?.trim() || "gpt-5.6",
    port: parsedPort,
    voice: environment.OPENAI_REALTIME_VOICE?.trim() || "marin",
  };
}
