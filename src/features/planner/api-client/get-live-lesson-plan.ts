import {
  type LessonPlan,
  validateLessonPlan,
} from "../../lesson/lib/plan";

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

type GetLiveLessonPlanOptions = {
  baseUrl: string;
  fetcher?: Fetcher;
  signal?: AbortSignal;
};

function plannerUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/planner`;
}

export async function getLiveLessonPlan(
  goal: string,
  { baseUrl, fetcher = fetch, signal }: GetLiveLessonPlanOptions,
): Promise<LessonPlan> {
  const response = await fetcher(plannerUrl(baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal }),
    signal,
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "the planner could not create a lesson";

    throw new Error(message);
  }

  const result = validateLessonPlan(payload);

  if (!result.ok) {
    throw new Error(`the planner returned an invalid lesson: ${result.error}`);
  }

  return result.value;
}
