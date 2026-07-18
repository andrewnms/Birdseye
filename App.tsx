import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

import { CameraStage } from "./src/features/camera/components/CameraStage";
import { palette, radius } from "./src/features/design/tokens";
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

function AppBody() {
  const tokenServerUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const insets = useSafeAreaInsets();
  const [activePlan, setActivePlan] = useState<LessonPlan | null>(null);
  const [launch, setLaunch] = useState<LaunchState>({ phase: "idle" });

  const returnHome = useCallback(() => {
    setActivePlan(null);
    setLaunch({ phase: "idle" });
  }, []);

  const handleGoalClip = useCallback(
    async (clip: RecordedVoiceClip) => {
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
    },
    [tokenServerUrl],
  );

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
      <View
        pointerEvents="box-none"
        style={[
          styles.launchChrome,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.launchHeader}>
          <Text style={styles.wordmark}>birdseye</Text>
          <Text style={styles.launchTitle}>
            point at your work and say what you want to learn.
          </Text>
        </View>
        <View style={styles.launchFooter}>
          {launch.phase === "transcribing" ? (
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>listening back…</Text>
            </View>
          ) : null}
          {launch.phase === "planning" ? (
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>
                building your lesson for “{launch.goal}”…
              </Text>
            </View>
          ) : null}
          {launch.phase === "error" ? (
            <View style={styles.errorPill}>
              <Text style={styles.errorText}>{launch.message}</Text>
            </View>
          ) : null}
          <PushToTalkButton
            busy={busy}
            onClip={handleGoalClip}
            style={styles.launchMic}
            variant="mic"
          />
          <Text style={styles.capHint}>hold the mic and say what you want to learn</Text>
          <Text style={styles.safetyCopy}>
            use this as guidance, not safety clearance for heat, blades, mains power,
            or food allergies.
          </Text>
        </View>
      </View>
    </CameraStage>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppBody />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  launchChrome: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  launchHeader: {
    gap: 8,
  },
  wordmark: {
    color: palette.white,
    fontSize: 17,
    fontWeight: "700",
    textShadowColor: "rgba(13, 20, 40, 0.6)",
    textShadowRadius: 6,
  },
  launchTitle: {
    color: palette.white,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
    lineHeight: 34,
    textShadowColor: "rgba(13, 20, 40, 0.6)",
    textShadowRadius: 8,
  },
  launchFooter: {
    alignItems: "center",
    gap: 12,
  },
  launchMic: {
    marginTop: 2,
  },
  capHint: {
    color: palette.white,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    textShadowColor: "rgba(13, 20, 40, 0.7)",
    textShadowRadius: 6,
  },
  statusPill: {
    backgroundColor: palette.darkPill,
    borderRadius: radius.chip,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statusText: {
    color: palette.mint,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  errorPill: {
    backgroundColor: palette.darkPill,
    borderRadius: radius.chip,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    color: palette.coral,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  safetyCopy: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    textShadowColor: "rgba(13, 20, 40, 0.7)",
    textShadowRadius: 4,
  },
});
