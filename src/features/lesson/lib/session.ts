import type { LessonPlan, LessonStep } from "./plan";

export type ActiveLessonSession = {
  status: "active";
  plan: LessonPlan;
  stepIndex: number;
  currentStep: LessonStep;
};

export type CompletedLessonSession = {
  status: "complete";
};

export type LessonSession = ActiveLessonSession | CompletedLessonSession;

export function startLesson(plan: LessonPlan): ActiveLessonSession {
  const [currentStep] = plan.steps;

  if (!currentStep) {
    throw new Error("cannot start a lesson without steps");
  }

  return {
    status: "active",
    plan,
    stepIndex: 0,
    currentStep,
  };
}

export function advanceLesson(session: LessonSession): LessonSession {
  if (session.status === "complete") {
    return session;
  }

  const nextStepIndex = session.stepIndex + 1;
  const nextStep = session.plan.steps[nextStepIndex];

  if (!nextStep) {
    return { status: "complete" };
  }

  return {
    status: "active",
    plan: session.plan,
    stepIndex: nextStepIndex,
    currentStep: nextStep,
  };
}
