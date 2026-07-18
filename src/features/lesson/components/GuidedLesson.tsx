import { LinearGradient } from "expo-linear-gradient";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cardShadow, gradients, palette, radius } from "../../design/tokens";

import {
  CameraStage,
  type CameraStageRef,
} from "../../camera/components/CameraStage";
import { parseWireframeModel } from "../../model-preview";
import {
  createRealtimeSession,
  type CreateRealtimeSessionOptions,
  type RealtimeSession,
} from "../../realtime/session/create-realtime-session";
import { SpatialOverlay } from "../../spatial/client";
import type { SpatialOverlayPrimitive } from "../../spatial";
import {
  analyzeCameraFrame,
  type CameraFrameAnalysis,
} from "../../vision/client";
import { askVoiceQuestion, narrateText } from "../../voice/api-client/voice-api";
import {
  PushToTalkButton,
  type RecordedVoiceClip,
} from "../../voice/components/PushToTalkButton";
import { playVoiceReply, stopVoicePlayback } from "../../voice/lib/play-voice-reply";
import type { LessonPlan } from "../lib/plan";
import { advanceLesson, startLesson, type LessonSession } from "../lib/session";

type RealtimeSessionFactory = (
  options: CreateRealtimeSessionOptions,
) => Promise<RealtimeSession>;

type CameraFrameAnalyzer = typeof analyzeCameraFrame;

export type GuidedLessonProps = {
  plan: LessonPlan;
  tokenServerUrl?: string;
  onExit?(): void;
  /** Injectable for deterministic tests and platform-specific narration. */
  narrate?(message: string): void;
  createSession?: RealtimeSessionFactory;
  /** Samples the active CameraView through the private vision endpoint. */
  analyzeFrame?: CameraFrameAnalyzer;
  /** A conservative default keeps mobile heat and API use bounded. */
  visionPollIntervalMs?: number;
  /** Injectable for deterministic tests. */
  askQuestion?: typeof askVoiceQuestion;
  playReply?: (replyAudioBase64: string) => Promise<void>;
};

type VoiceMode = "connecting" | "realtime" | "fallback";

type VisionAnalysisSnapshot = {
  analysis: CameraFrameAnalysis;
  stepIndex: number;
};

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

/**
 * One executor for cached and live lesson plans. It binds every current step
 * to one narration, one overlay payload, and one completion transition.
 */
function GuidedLessonRun({
  plan,
  tokenServerUrl,
  onExit,
  narrate,
  createSession = createRealtimeSession,
  analyzeFrame = analyzeCameraFrame,
  visionPollIntervalMs = 2_500,
  askQuestion = askVoiceQuestion,
  playReply = playVoiceReply,
}: GuidedLessonProps) {
  const insets = useSafeAreaInsets();
  const [lesson, setLesson] = useState<LessonSession>(() => startLesson(plan));
  const [toolOverlay, setToolOverlay] = useState<SpatialOverlayPrimitive[] | null>(
    null,
  );
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(
    tokenServerUrl ? "connecting" : "fallback",
  );
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [visionAnalysis, setVisionAnalysis] =
    useState<VisionAnalysisSnapshot | null>(null);
  const [voiceAnswer, setVoiceAnswer] = useState<string | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const cameraRef = useRef<CameraStageRef | null>(null);
  const realtimeSessionRef = useRef<RealtimeSession | null>(null);
  const pendingTapAdvanceRef = useRef(false);
  const visionRequestInFlightRef = useRef(false);
  const narrationStepRef = useRef(0);

  useEffect(() => {
    narrationStepRef.current = lesson.status === "complete" ? -1 : lesson.stepIndex;
  }, [lesson]);

  const advance = useCallback((fromVoice = false) => {
    if (fromVoice && pendingTapAdvanceRef.current) {
      pendingTapAdvanceRef.current = false;
      return;
    }

    setToolOverlay(null);
    setVoiceAnswer(null);
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
      if (narrate) {
        narrate(lesson.currentStep.say);
        return;
      }

      if (!tokenServerUrl) {
        return;
      }

      const requestedStep = lesson.stepIndex;
      void narrateText(lesson.currentStep.say, { baseUrl: tokenServerUrl })
        .then((audioBase64) => {
          if (narrationStepRef.current === requestedStep) {
            return playReply(audioBase64);
          }
        })
        .catch(() => {
          // The written step stays on screen if narration audio is unavailable.
        });
    }
  }, [connectionRevision, lesson, narrate, playReply, tokenServerUrl, voiceMode]);

  useEffect(
    () => () => {
      stopVoicePlayback();
    },
    [],
  );

  useEffect(() => {
    if (!tokenServerUrl || lesson.status === "complete") {
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    const intervalMs = Math.max(1_500, visionPollIntervalMs);

    const analyzeCurrentFrame = async () => {
      if (visionRequestInFlightRef.current) {
        return;
      }

      visionRequestInFlightRef.current = true;

      try {
        const frame = await cameraRef.current?.captureFrame();

        if (!frame || !active) {
          return;
        }

        const analysis = await analyzeFrame(
          {
            goal: lesson.plan.goal,
            step: {
              n: lesson.currentStep.n,
              say: lesson.currentStep.say,
            },
            imageDataUrl: `data:image/jpeg;base64,${frame.base64}`,
          },
          { baseUrl: tokenServerUrl, signal: controller.signal },
        );

        if (active) {
          setVisionAnalysis({ analysis, stepIndex: lesson.stepIndex });
        }
      } catch {
        // The static step overlay remains useful if a frame is unavailable.
      } finally {
        visionRequestInFlightRef.current = false;
      }
    };

    void analyzeCurrentFrame();
    const interval = setInterval(() => void analyzeCurrentFrame(), intervalMs);

    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [analyzeFrame, lesson, tokenServerUrl, visionPollIntervalMs]);

  const handleVoiceClip = useCallback(
    async (clip: RecordedVoiceClip) => {
      if (!tokenServerUrl || lesson.status === "complete") {
        return;
      }

      setVoiceBusy(true);

      try {
        const observation =
          visionAnalysis?.stepIndex === lesson.stepIndex
            ? visionAnalysis.analysis.observation
            : undefined;
        const answer = await askQuestion(
          {
            ...clip,
            goal: lesson.plan.goal,
            step: { n: lesson.currentStep.n, say: lesson.currentStep.say },
            ...(observation ? { observation } : {}),
          },
          { baseUrl: tokenServerUrl },
        );
        setVoiceAnswer(answer.reply);
        await playReply(answer.replyAudioBase64).catch(() => {
          // The written answer still lands if audio playback fails.
        });
      } catch (error) {
        setVoiceAnswer(
          error instanceof Error ? error.message : "the tutor could not answer. try again.",
        );
      } finally {
        setVoiceBusy(false);
      }
    },
    [askQuestion, lesson, playReply, tokenServerUrl, visionAnalysis],
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
      <View accessibilityLabel="Lesson complete" style={styles.completionScreen}>
        <View style={styles.successChip}>
          <View style={styles.successCheck}>
            <Text style={styles.successCheckMark}>✓</Text>
          </View>
          <Text style={styles.successChipText}>nice work!</Text>
        </View>
        <Text style={styles.completionTitle}>you did it</Text>
        <Text style={styles.completionCopy}>you finished {plan.goal}.</Text>
        {onExit ? (
          <Pressable
            accessibilityLabel="Back to lessons"
            accessibilityRole="button"
            onPress={onExit}
            style={styles.completionButton}
          >
            <LinearGradient {...gradients.brandSweep} style={styles.completionButtonFace}>
              <Text style={styles.completionButtonText}>learn something else →</Text>
            </LinearGradient>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const currentVisionAnalysis =
    visionAnalysis?.stepIndex === lesson.stepIndex
      ? visionAnalysis.analysis
      : null;
  const hasVisionOverlay = Boolean(currentVisionAnalysis?.overlay.length);
  const displayedOverlay = hasVisionOverlay
    ? currentVisionAnalysis?.overlay ?? []
    : toolOverlay ?? lesson.currentStep.overlay;

  const stepCount = lesson.plan.steps.length;

  return (
    <CameraStage ref={cameraRef}>
      <SpatialOverlay anchorMode="world" primitives={displayedOverlay} wireframe={wireframe} />
      <View pointerEvents="none" style={styles.scanFrame}>
        <View style={[styles.scanCorner, styles.scanTopLeft]} />
        <View style={[styles.scanCorner, styles.scanTopRight]} />
        <View style={[styles.scanCorner, styles.scanBottomLeft]} />
        <View style={[styles.scanCorner, styles.scanBottomRight]} />
      </View>
      <View
        pointerEvents="box-none"
        style={[
          styles.chrome,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 14 },
        ]}
      >
        <View pointerEvents="box-none" style={styles.topSection}>
          <View pointerEvents="box-none" style={styles.topRow}>
            {onExit ? (
              <Pressable
                accessibilityLabel="Back to lessons"
                accessibilityRole="button"
                onPress={onExit}
                style={styles.backButton}
              >
                <Text style={styles.backGlyph}>‹</Text>
              </Pressable>
            ) : null}
            <View style={styles.progressCard}>
              <View style={styles.progressHead}>
                <View style={styles.progressTitles}>
                  <Text numberOfLines={1} style={styles.progressTitle}>
                    {plan.goal}
                  </Text>
                  <Text style={styles.progressKicker}>your goal</Text>
                </View>
                <Text style={styles.voiceBadge}>
                  {voiceMode === "realtime" ? "live voice" : "push to talk"}
                </Text>
              </View>
              <View style={styles.track}>
                {lesson.plan.steps.map((step, index) => (
                  <Fragment key={step.n}>
                    <View
                      style={[
                        styles.trackDot,
                        index < lesson.stepIndex && styles.trackDotDone,
                        index === lesson.stepIndex && styles.trackDotActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.trackDotText,
                          index <= lesson.stepIndex && styles.trackDotTextOn,
                        ]}
                      >
                        {index < lesson.stepIndex ? "✓" : step.n}
                      </Text>
                    </View>
                    {index < stepCount - 1 ? (
                      <View
                        style={[
                          styles.trackSegment,
                          index < lesson.stepIndex && styles.trackSegmentDone,
                        ]}
                      />
                    ) : null}
                  </Fragment>
                ))}
              </View>
            </View>
          </View>
          {currentVisionAnalysis ? (
            <View style={styles.detectPill}>
              <View style={styles.detectDot} />
              <Text
                accessibilityLabel="Camera observation"
                style={styles.detectText}
              >
                {currentVisionAnalysis.observation}
              </Text>
            </View>
          ) : null}
        </View>
        <View pointerEvents="box-none" style={styles.bottomSection}>
          {voiceAnswer ? (
            <View style={styles.coachChip}>
              <Text accessibilityLabel="Tutor answer" style={styles.coachText}>
                {voiceAnswer}
              </Text>
            </View>
          ) : null}
          <View pointerEvents="box-none" style={styles.bottomRow}>
            <View style={styles.stepChip}>
              <View style={styles.stepLabelRow}>
                <Text style={styles.stepText}>
                  Step {lesson.currentStep.n} of {stepCount}
                </Text>
                <View style={styles.miniDots}>
                  {lesson.plan.steps.map((step, index) => (
                    <View
                      key={step.n}
                      style={[
                        styles.miniDot,
                        index <= lesson.stepIndex && styles.miniDotOn,
                      ]}
                    />
                  ))}
                </View>
              </View>
              <Text style={styles.narration}>{lesson.currentStep.say}</Text>
              <Pressable
                accessibilityLabel="Next step"
                accessibilityRole="button"
                onPress={handleNext}
                style={styles.doneButton}
              >
                <LinearGradient {...gradients.brandSweep} style={styles.doneButtonFace}>
                  <Text style={styles.doneButtonText}>done ✓</Text>
                </LinearGradient>
              </Pressable>
            </View>
            {tokenServerUrl ? (
              <PushToTalkButton
                busy={voiceBusy}
                onClip={(clip) => void handleVoiceClip(clip)}
                variant="mic"
              />
            ) : null}
          </View>
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

const scanCornerBase = {
  borderColor: palette.white,
  height: 26,
  position: "absolute" as const,
  width: 26,
};

const styles = StyleSheet.create({
  chrome: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingHorizontal: 14,
  },
  scanFrame: {
    alignSelf: "center",
    height: 240,
    position: "absolute",
    top: "50%",
    marginTop: -120,
    width: 240,
  },
  scanCorner: scanCornerBase,
  scanTopLeft: {
    borderLeftWidth: 3,
    borderTopLeftRadius: 9,
    borderTopWidth: 3,
    left: 0,
    top: 0,
  },
  scanTopRight: {
    borderRightWidth: 3,
    borderTopRightRadius: 9,
    borderTopWidth: 3,
    right: 0,
    top: 0,
  },
  scanBottomLeft: {
    borderBottomLeftRadius: 9,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    bottom: 0,
    left: 0,
  },
  scanBottomRight: {
    borderBottomRightRadius: 9,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    bottom: 0,
    right: 0,
  },
  topSection: {
    gap: 10,
  },
  topRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: "rgba(16, 26, 51, 0.5)",
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  backGlyph: {
    color: palette.white,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 22,
  },
  progressCard: {
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    borderRadius: 18,
    flex: 1,
    gap: 9,
    paddingHorizontal: 13,
    paddingVertical: 11,
    ...cardShadow,
  },
  progressHead: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  progressTitles: {
    flex: 1,
  },
  progressTitle: {
    color: palette.navy,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },
  progressKicker: {
    color: palette.softText,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  voiceBadge: {
    color: palette.teal,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  track: {
    alignItems: "center",
    flexDirection: "row",
  },
  trackDot: {
    alignItems: "center",
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 14,
    borderWidth: 2,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  trackDotDone: {
    backgroundColor: palette.success,
    borderColor: palette.success,
  },
  trackDotActive: {
    backgroundColor: palette.sky,
    borderColor: palette.sky,
  },
  trackDotText: {
    color: palette.softText,
    fontSize: 12,
    fontWeight: "800",
  },
  trackDotTextOn: {
    color: palette.white,
  },
  trackSegment: {
    backgroundColor: palette.line,
    borderRadius: 2,
    flex: 1,
    height: 3,
    marginHorizontal: 5,
  },
  trackSegmentDone: {
    backgroundColor: palette.success,
  },
  detectPill: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(16, 26, 51, 0.78)",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    maxWidth: "94%",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  detectDot: {
    backgroundColor: palette.signal,
    borderRadius: 4,
    height: 8,
    shadowColor: palette.signal,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    width: 8,
  },
  detectText: {
    color: palette.white,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  bottomSection: {
    gap: 10,
  },
  coachChip: {
    backgroundColor: palette.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...cardShadow,
  },
  coachText: {
    color: palette.navy,
    fontSize: 14.5,
    fontWeight: "600",
    lineHeight: 20,
  },
  bottomRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 10,
  },
  stepChip: {
    backgroundColor: palette.white,
    borderRadius: 16,
    flex: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...cardShadow,
  },
  stepLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  stepText: {
    color: palette.stepLabel,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  miniDots: {
    flexDirection: "row",
    gap: 5,
  },
  miniDot: {
    backgroundColor: palette.line,
    borderRadius: 3,
    height: 5.5,
    width: 5.5,
  },
  miniDotOn: {
    backgroundColor: palette.sky,
  },
  narration: {
    color: palette.navy,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 25,
  },
  doneButton: {
    borderRadius: 999,
    overflow: "hidden",
  },
  doneButtonFace: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
  },
  doneButtonText: {
    color: palette.white,
    fontSize: 14.5,
    fontWeight: "700",
  },
  completionScreen: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: palette.cloud,
    gap: 14,
    justifyContent: "center",
    padding: 28,
  },
  successChip: {
    alignItems: "center",
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    ...cardShadow,
  },
  successCheck: {
    alignItems: "center",
    backgroundColor: palette.success,
    borderRadius: 13,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  successCheckMark: {
    color: palette.white,
    fontSize: 14,
    fontWeight: "900",
  },
  successChipText: {
    color: palette.navy,
    fontSize: 15,
    fontWeight: "700",
  },
  completionTitle: {
    color: palette.navy,
    fontSize: 27,
    fontWeight: "800",
  },
  completionCopy: {
    color: palette.mutedText,
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
  },
  completionButton: {
    borderRadius: 999,
    marginTop: 8,
    overflow: "hidden",
    width: 250,
  },
  completionButtonFace: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 22,
  },
  completionButtonText: {
    color: palette.white,
    fontSize: 15.5,
    fontWeight: "700",
  },
});
