import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { CameraStage } from "./src/features/camera/components/CameraStage";
import type { LessonPlan } from "./src/features/lesson/lib/plan";
import { GuidedLesson } from "./src/features/lesson/components/GuidedLesson";
import { getLiveLessonPlan } from "./src/features/planner/api-client/get-live-lesson-plan";
import {
  PushToTalkButton,
  type RecordedVoiceClip,
} from "./src/features/voice/components/PushToTalkButton";
import { transcribeVoiceClip } from "./src/features/voice/api-client/voice-api";

type LaunchState =
  | { phase: "idle" }
  | { phase: "transcribing" }
  | { phase: "planning"; goal: string }
  | { phase: "error"; message: string };

export default function App() {
  const tokenServerUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const [activePlan, setActivePlan] = useState<LessonPlan | null>(null);
  const [launch, setLaunch] = useState<LaunchState>({ phase: "idle" });

  const returnHome = useCallback(() => {
    setActivePlan(null);
    setLaunch({ phase: "idle" });
  }, []);

  const handleGoalClip = useCallback(async (clip: RecordedVoiceClip) => {
    if (!tokenServerUrl) {
      setLaunch({
        phase: "error",
        message:
          "the local server is not configured. add EXPO_PUBLIC_API_URL to .env.local and restart Expo.",
      });
      return;
    }

    try {
      setLaunch({ phase: "transcribing" });
      const goal = await transcribeVoiceClip(clip, { baseUrl: tokenServerUrl });
      setLaunch({ phase: "planning", goal });
      const plan = await getLiveLessonPlan(goal, { baseUrl: tokenServerUrl });
      setActivePlan(plan);
      setLaunch({ phase: "idle" });
    } catch (error) {
      setLaunch({
        phase: "error",
        message:
          error instanceof Error ? error.message : "something went wrong. try again.",
      });
    }
  }, [tokenServerUrl]);

  if (activePlan) {
    return (
      <>
        <StatusBar style="light" />
        <GuidedLesson
          plan={activePlan}
          tokenServerUrl={tokenServerUrl}
          onExit={returnHome}
        />
      </>
    );
  }

  const busy = launch.phase === "transcribing" || launch.phase === "planning";

  return (
    <CameraStage>
      <StatusBar style="light" />
      <View pointerEvents="box-none" style={styles.launchChrome}>
        <View style={styles.launchHeader}>
          <Text style={styles.eyebrow}>birdseye</Text>
          <Text style={styles.launchTitle}>
            point at your work and say what you want to learn.
          </Text>
        </View>
        <View style={styles.launchFooter}>
          {launch.phase === "planning" ? (
            <Text style={styles.statusText}>building your lesson for “{launch.goal}”…</Text>
          ) : null}
          {launch.phase === "error" ? (
            <Text style={styles.errorText}>{launch.message}</Text>
          ) : null}
          <PushToTalkButton
            busy={busy}
            busyLabel={launch.phase === "planning" ? "planning…" : "listening back…"}
            idleLabel="hold and say your goal"
            onClip={handleGoalClip}
          />
          <Text style={styles.safetyCopy}>
            use this as guidance, not safety clearance for heat, blades, mains power,
            or food allergies.
          </Text>
        </View>
      </View>
    </CameraStage>
  );
}

const styles = StyleSheet.create({
  launchChrome: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: 24,
    paddingBottom: 32,
    paddingTop: 64,
  },
  launchHeader: {
    gap: 8,
  },
  eyebrow: {
    color: "#d8ff69",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  launchTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 34,
    textShadowColor: "rgba(0, 0, 0, 0.55)",
    textShadowRadius: 8,
  },
  launchFooter: {
    gap: 12,
  },
  statusText: {
    color: "#d8ff69",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  errorText: {
    color: "#ffb4ab",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  safetyCopy: {
    color: "rgba(255, 255, 255, 0.72)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
});
