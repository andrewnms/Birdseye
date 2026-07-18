import { useEffect, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LessonStep, OverlayPrimitive } from "../../lesson/lib/plan";
import { useCachedCraneDemo } from "../hooks/useCachedCraneDemo";

export type CachedCraneDemoProps = {
  onNarrate?(message: string): void;
  renderOverlay?(step: LessonStep): ReactNode;
};

function overlayDescription(primitive: OverlayPrimitive): string {
  switch (primitive.type) {
    case "arrow":
      return "follow the direction arrow";
    case "crease_line":
      return "make the marked crease";
    case "fold_curve":
      return "follow the curved fold";
    case "dot":
      return "align with the marked point";
    case "label":
      return primitive.text;
  }
}

function DefaultOverlay({ step }: { step: LessonStep }) {
  return (
    <View accessibilityLabel={`Overlay for step ${step.n}`} style={styles.overlay}>
      <Text style={styles.overlayTitle}>Overlay cues</Text>
      {step.overlay.map((primitive, index) => (
        <Text key={`${primitive.type}-${index}`} style={styles.overlayCue}>
          {overlayDescription(primitive)}
        </Text>
      ))}
    </View>
  );
}

export function CachedCraneDemo({
  onNarrate,
  renderOverlay,
}: CachedCraneDemoProps) {
  const demo = useCachedCraneDemo();
  const narration =
    demo.status === "active" ? demo.currentStep.say : demo.completionMessage;

  useEffect(() => {
    onNarrate?.(narration);
  }, [narration, onNarrate]);

  if (demo.status === "complete") {
    return (
      <View accessibilityLabel="Lesson complete" style={styles.container}>
        <Text style={styles.completion}>{demo.completionMessage}</Text>
      </View>
    );
  }

  return (
    <View accessibilityLabel="Cached crane lesson" style={styles.container}>
      <Text style={styles.step}>
        Step {demo.currentStep.n} of {demo.totalSteps}
      </Text>
      <Text style={styles.narration}>{demo.currentStep.say}</Text>
      {renderOverlay ? renderOverlay(demo.currentStep) : <DefaultOverlay step={demo.currentStep} />}
      <Pressable
        accessibilityLabel="Next step"
        accessibilityRole="button"
        onPress={demo.advance}
        style={styles.nextButton}
      >
        <Text style={styles.nextButtonText}>Next</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  step: {
    fontSize: 18,
    fontWeight: "700",
  },
  narration: {
    fontSize: 16,
    lineHeight: 24,
  },
  overlay: {
    gap: 4,
  },
  overlayTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  overlayCue: {
    fontSize: 14,
  },
  nextButton: {
    alignItems: "center",
    backgroundColor: "#155eef",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  nextButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  completion: {
    fontSize: 18,
    fontWeight: "700",
  },
});
