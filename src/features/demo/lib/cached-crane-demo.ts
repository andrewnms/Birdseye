import { getCachedCranePlan } from "../../lesson/lib/cached-crane-plan";
import type { LessonStep } from "../../lesson/lib/plan";
import { advanceLesson, startLesson, type LessonSession } from "../../lesson/lib/session";

export type ActiveCachedCraneDemoSnapshot = {
  status: "active";
  goal: string;
  totalSteps: number;
  currentStep: LessonStep;
};

export type CompletedCachedCraneDemoSnapshot = {
  status: "complete";
  goal: string;
  totalSteps: number;
  completionMessage: string;
};

export type CachedCraneDemoSnapshot =
  | ActiveCachedCraneDemoSnapshot
  | CompletedCachedCraneDemoSnapshot;

export type CachedCraneDemo = {
  snapshot(): CachedCraneDemoSnapshot;
  advance(): CachedCraneDemoSnapshot;
};

function toSnapshot(session: LessonSession): CachedCraneDemoSnapshot {
  const plan = session.status === "active" ? session.plan : getCachedCranePlan();

  if (session.status === "complete") {
    return {
      status: "complete",
      goal: plan.goal,
      totalSteps: plan.steps.length,
      completionMessage: "You made a paper crane.",
    };
  }

  return {
    status: "active",
    goal: plan.goal,
    totalSteps: plan.steps.length,
    currentStep: session.currentStep,
  };
}

export function createCachedCraneDemo(): CachedCraneDemo {
  let session: LessonSession = startLesson(getCachedCranePlan());

  return {
    snapshot: () => toSnapshot(session),
    advance: () => {
      session = advanceLesson(session);
      return toSnapshot(session);
    },
  };
}
