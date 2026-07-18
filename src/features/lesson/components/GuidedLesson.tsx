import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CameraStage } from "../../camera/components/CameraStage";
import { parseWireframeModel } from "../../model-preview";
import {
  createRealtimeSession,
  type CreateRealtimeSessionOptions,
  type RealtimeSession,
} from "../../realtime/session/create-realtime-session";
import { SpatialOverlay } from "../../spatial/client";
import type { SpatialOverlayPrimitive } from "../../spatial";
import type { LessonPlan } from "../lib/plan";
import { advanceLesson, startLesson, type LessonSession } from "../lib/session";

type RealtimeSessionFactory = (
  options: CreateRealtimeSessionOptions,
) => Promise<RealtimeSession>;

export type GuidedLessonProps = {
  plan: LessonPlan;
  tokenServerUrl?: string;
  onExit?(): void;
  /** Injectable for deterministic tests and platform-specific narration. */
  narrate?(message: string): void;
  createSession?: RealtimeSessionFactory;
};

type VoiceMode = "connecting" | "realtime" | "fallback";

function createStepPrompt(plan: LessonPlan, stepIndex: number): string {
  const step = plan.steps[stepIndex];

  if (!step) {
    return "The lesson is complete. Congratulate the learner briefly.";
  }

  return [
    "Guide the learner through exactly this precomputed physical-learning step.",
    `Step ${step.n} of ${plan.steps.length}.`,
    `Say: ${step.say}`,
    `Then call render_overlay with exactly this JSON overlay: ${JSON.stringify(step.overlay)}.`,
    "If the learner clearly says done, call advance_lesson_step exactly once.",
    "Never invent geometry or claim you can see the learner's work.",
  ].join(" ");
}

function defaultNarrate(message: string): void {
  Speech.stop();
  Speech.speak(message);
}

/**
 * One executor for cached and live lesson plans. It binds every current step
 * to one narration, one overlay payload, and one completion transition.
 */
function GuidedLessonRun({
  plan,
  tokenServerUrl,
  onExit,
  narrate = defaultNarrate,
  createSession = createRealtimeSession,
}: GuidedLessonProps) {
  const [lesson, setLesson] = useState<LessonSession>(() => startLesson(plan));
  const [toolOverlay, setToolOverlay] = useState<SpatialOverlayPrimitive[] | null>(
    null,
  );
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(
    tokenServerUrl ? "connecting" : "fallback",
  );
  const [connectionRevision, setConnectionRevision] = useState(0);
  const realtimeSessionRef = useRef<RealtimeSession | null>(null);
  const pendingTapAdvanceRef = useRef(false);

  const advance = useCallback((fromVoice = false) => {
    if (fromVoice && pendingTapAdvanceRef.current) {
      pendingTapAdvanceRef.current = false;
      return;
    }

    setToolOverlay(null);
    setLesson((current) => advanceLesson(current));
  }, []);

  useEffect(() => {
    if (!tokenServerUrl) {
      return undefined;
    }

    let active = true;
    const controller = new AbortController();

    void createSession({
      tokenServerUrl,
      signal: controller.signal,
      onOverlay: setToolOverlay,
      onAdvance: () => advance(true),
    })
      .then((session) => {
        if (!active) {
          session.close();
          return;
        }

        realtimeSessionRef.current = session;
        setVoiceMode("realtime");
        setConnectionRevision((current) => current + 1);
      })
      .catch(() => {
        if (active) {
          setVoiceMode("fallback");
        }
      });

    return () => {
      active = false;
      controller.abort();
      realtimeSessionRef.current?.close();
      realtimeSessionRef.current = null;
    };
  }, [advance, createSession, tokenServerUrl]);

  useEffect(() => {
    if (lesson.status === "complete") {
      return;
    }

    if (voiceMode === "realtime" && realtimeSessionRef.current) {
      try {
        realtimeSessionRef.current.sendText(
          createStepPrompt(lesson.plan, lesson.stepIndex),
        );
      } catch {
        queueMicrotask(() => setVoiceMode("fallback"));
      }
      return;
    }

    if (voiceMode === "fallback") {
      narrate(lesson.currentStep.say);
    }
  }, [connectionRevision, lesson, narrate, voiceMode]);

  useEffect(
    () => () => {
      Speech.stop();
    },
    [],
  );

  const handleNext = useCallback(() => {
    pendingTapAdvanceRef.current = true;
    try {
      realtimeSessionRef.current?.completeStep();
    } catch {
      // Tapping remains a reliable local control if the voice session closes.
    }
    advance();
  }, [advance]);

  const wireframe = useMemo(() => parseWireframeModel(plan.model), [plan.model]);

  if (lesson.status === "complete") {
    return (
      <CameraStage>
        <View accessibilityLabel="Lesson complete" style={styles.completionScreen}>
          <Text style={styles.completionTitle}>lesson complete</Text>
          <Text style={styles.completionCopy}>you finished {plan.goal}.</Text>
          {onExit ? (
            <Pressable
              accessibilityLabel="Back to lessons"
              accessibilityRole="button"
              onPress={onExit}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>back to lessons</Text>
            </Pressable>
          ) : null}
        </View>
      </CameraStage>
    );
  }

  const displayedOverlay = toolOverlay ?? lesson.currentStep.overlay;

  return (
    <CameraStage>
      <SpatialOverlay primitives={displayedOverlay} wireframe={wireframe} />
      <View pointerEvents="box-none" style={styles.chrome}>
        <View style={styles.topBar}>
          <View style={styles.goalPill}>
            <Text numberOfLines={1} style={styles.goalText}>
              {plan.goal}
            </Text>
          </View>
          {onExit ? (
            <Pressable
              accessibilityLabel="Back to lessons"
              accessibilityRole="button"
              onPress={onExit}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>close</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.bottomCard}>
          <View style={styles.stepRow}>
            <Text style={styles.stepText}>
              Step {lesson.currentStep.n} of {lesson.plan.steps.length}
            </Text>
            <Text style={styles.voiceText}>
              {voiceMode === "realtime" ? "live voice" : "device voice"}
            </Text>
          </View>
          <Text style={styles.narration}>{lesson.currentStep.say}</Text>
          <Pressable
            accessibilityLabel="Next step"
            accessibilityRole="button"
            onPress={handleNext}
            style={styles.nextButton}
          >
            <Text style={styles.nextButtonText}>next</Text>
          </Pressable>
          <Text style={styles.hint}>say “done” or tap next when you are ready.</Text>
        </View>
      </View>
    </CameraStage>
  );
}

/**
 * Re-mounting an executor when a planner hands us a distinct plan prevents a
 * previous step, voice session, or tool overlay from leaking into the new run.
 */
export function GuidedLesson(props: GuidedLessonProps) {
  const lessonKey = `${props.tokenServerUrl ?? "fallback"}:${JSON.stringify(props.plan)}`;

  return <GuidedLessonRun key={lessonKey} {...props} />;
}

const styles = StyleSheet.create({
  chrome: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
    padding: 20,
    paddingBottom: 28,
  },
  topBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  goalPill: {
    backgroundColor: "rgba(8, 15, 24, 0.76)",
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  goalText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "rgba(8, 15, 24, 0.76)",
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  closeButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  bottomCard: {
    backgroundColor: "rgba(8, 15, 24, 0.9)",
    borderColor: "rgba(255, 255, 255, 0.16)",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
    padding: 18,
  },
  stepRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepText: {
    color: "#d0d5dd",
    fontSize: 14,
    fontWeight: "700",
  },
  voiceText: {
    color: "#8bd6b4",
    fontSize: 13,
    fontWeight: "700",
  },
  narration: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },
  nextButton: {
    alignItems: "center",
    backgroundColor: "#d8ff69",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  nextButtonText: {
    color: "#102109",
    fontSize: 16,
    fontWeight: "800",
  },
  hint: {
    color: "#d0d5dd",
    fontSize: 13,
    textAlign: "center",
  },
  completionScreen: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    backgroundColor: "rgba(8, 15, 24, 0.72)",
    gap: 14,
    justifyContent: "center",
    padding: 32,
  },
  completionTitle: {
    color: "#d8ff69",
    fontSize: 30,
    fontWeight: "800",
  },
  completionCopy: {
    color: "#ffffff",
    fontSize: 18,
    textAlign: "center",
  },
  secondaryButton: {
    borderColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
