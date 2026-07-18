import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { type LessonPlan, validateLessonPlan } from "../../lesson/lib/plan";

export type GetPlan = (goal: string) => Promise<LessonPlan>;

export type LiveGoalEntryProps = {
  /** Retrieves a candidate plan without coupling this screen to a transport. */
  getPlan: GetPlan;
  /** Hands the validated plan to the one shared lesson executor. */
  onPlanReady(plan: LessonPlan): void;
};

type PlannerState =
  | { status: "idle" }
  | { status: "planning"; goal: string }
  | { status: "ready"; goal: string; plan: LessonPlan }
  | { status: "error"; goal: string | null; message: string };

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "We could not create that lesson. Try again.";
}

/**
 * Lets a learner start a lesson from any real-world goal. The injected
 * planner adapter and the executor callback keep networking and session
 * execution outside this UI seam.
 */
export function LiveGoalEntry({ getPlan, onPlanReady }: LiveGoalEntryProps) {
  const [goal, setGoal] = useState("");
  const [state, setState] = useState<PlannerState>({ status: "idle" });
  const latestGoalRef = useRef<string | null>(null);

  const requestPlan = useCallback(
    async (requestedGoal: string): Promise<void> => {
      const normalizedGoal = requestedGoal.trim();

      if (!normalizedGoal) {
        setState({
          status: "error",
          goal: null,
          message: "Describe a goal before planning a lesson.",
        });
        return;
      }

      latestGoalRef.current = normalizedGoal;
      setState({ status: "planning", goal: normalizedGoal });

      try {
        const candidate = await getPlan(normalizedGoal);
        const result = validateLessonPlan(candidate);

        if (!result.ok) {
          throw new Error(`The planner returned an invalid lesson: ${result.error}`);
        }

        setState({
          status: "ready",
          goal: normalizedGoal,
          plan: result.value,
        });
        onPlanReady(result.value);
      } catch (error) {
        setState({
          status: "error",
          goal: normalizedGoal,
          message: errorMessage(error),
        });
      }
    },
    [getPlan, onPlanReady],
  );

  const retry = useCallback(() => {
    if (latestGoalRef.current) {
      void requestPlan(latestGoalRef.current);
    }
  }, [requestPlan]);

  if (state.status === "planning") {
    return (
      <View accessibilityLabel="Lesson planning" style={styles.container}>
        <Text style={styles.title}>Planning…</Text>
        <Text style={styles.copy}>Building your {state.goal} lesson.</Text>
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View accessibilityLabel="Lesson planning error" style={styles.container}>
        <Text style={styles.title}>We could not plan that lesson.</Text>
        <Text style={styles.copy}>{state.message}</Text>
        {state.goal ? (
          <Pressable
            accessibilityLabel="Retry planning"
            accessibilityRole="button"
            onPress={retry}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (state.status === "ready") {
    return (
      <View accessibilityLabel="Lesson ready" style={styles.container}>
        <Text style={styles.title}>Your {state.goal} lesson is ready.</Text>
      </View>
    );
  }

  return (
    <View accessibilityLabel="Start a live lesson" style={styles.container}>
      <Text style={styles.title}>What would you like to learn?</Text>
      <TextInput
        accessibilityLabel="What would you like to learn?"
        autoCapitalize="sentences"
        onChangeText={setGoal}
        placeholder="Build a PCB, cook dinner, or make a shelf"
        style={styles.input}
        value={goal}
      />
      <Pressable
        accessibilityLabel="Plan lesson"
        accessibilityRole="button"
        onPress={() => {
          void requestPlan(goal);
        }}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Plan lesson</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  title: {
    color: "#101828",
    fontSize: 22,
    fontWeight: "700",
  },
  copy: {
    color: "#475467",
    fontSize: 16,
    lineHeight: 24,
  },
  input: {
    borderColor: "#98a2b3",
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#155eef",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
