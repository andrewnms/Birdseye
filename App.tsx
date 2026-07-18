import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getCachedCranePlan } from "./src/features/lesson/lib/cached-crane-plan";
import type { LessonPlan } from "./src/features/lesson/lib/plan";
import { GuidedLesson } from "./src/features/lesson/components/GuidedLesson";
import { LiveGoalEntry } from "./src/features/live-goals/client";
import { getLiveLessonPlan } from "./src/features/planner/api-client/get-live-lesson-plan";

const tokenServerUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

function unavailablePlanner(): Promise<LessonPlan> {
  return Promise.reject(
    new Error(
      "the local planner is not configured. add EXPO_PUBLIC_API_URL to .env.local and restart Expo.",
    ),
  );
}

export default function App() {
  const [activePlan, setActivePlan] = useState<LessonPlan | null>(null);

  const startCraneDemo = useCallback(() => {
    setActivePlan(getCachedCranePlan());
  }, []);

  const returnHome = useCallback(() => {
    setActivePlan(null);
  }, []);

  const getPlan = useCallback(
    (goal: string) =>
      tokenServerUrl
        ? getLiveLessonPlan(goal, { baseUrl: tokenServerUrl })
        : unavailablePlanner(),
    [],
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

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>birdseye</Text>
        <Text style={styles.title}>learn the physical step in front of you.</Text>
        <Text style={styles.intro}>
          camera guidance for a paper crane, a pcb, a workbench, or the next thing
          you are trying to make.
        </Text>
      </View>

      <View style={styles.demoCard}>
        <Text style={styles.cardEyebrow}>reliable demo</Text>
        <Text style={styles.cardTitle}>paper crane</Text>
        <Text style={styles.cardCopy}>
          a cached six-step run with voice cues and world-locked overlays.
        </Text>
        <Pressable
          accessibilityLabel="Cached crane lesson"
          accessibilityRole="button"
          onPress={startCraneDemo}
          style={styles.demoButton}
        >
          <Text style={styles.demoButtonText}>start crane lesson</Text>
        </Pressable>
      </View>

      <View style={styles.liveCard}>
        <Text style={styles.cardEyebrow}>live planner</Text>
        <LiveGoalEntry getPlan={getPlan} onPlanReady={setActivePlan} />
      </View>

      <Text style={styles.safetyCopy}>
        use this as guidance, not safety clearance for heat, blades, mains power, or
        food allergies.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#081018",
    flex: 1,
    gap: 18,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    gap: 9,
  },
  eyebrow: {
    color: "#d8ff69",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    color: "#ffffff",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  intro: {
    color: "#c5d0dd",
    fontSize: 16,
    lineHeight: 23,
  },
  demoCard: {
    backgroundColor: "#d8ff69",
    borderRadius: 24,
    gap: 9,
    padding: 20,
  },
  liveCard: {
    backgroundColor: "#f3f7fa",
    borderRadius: 24,
    gap: 9,
    padding: 20,
  },
  cardEyebrow: {
    color: "#475467",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: "#102109",
    fontSize: 26,
    fontWeight: "800",
  },
  cardCopy: {
    color: "#32412a",
    fontSize: 15,
    lineHeight: 21,
  },
  demoButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#102109",
    borderRadius: 12,
    marginTop: 5,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  demoButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  safetyCopy: {
    color: "#98a2b3",
    fontSize: 12,
    lineHeight: 18,
  },
});
