import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { LessonPlan } from "../lib/plan";
import { GuidedLesson } from "./GuidedLesson";

jest.mock("react-native-webrtc", () => ({
  mediaDevices: {},
  RTCPeerConnection: jest.fn(),
  registerGlobals: jest.fn(),
}));

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(),
}));

jest.mock("../../camera/components/CameraStage", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    CameraStage: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: "camera-stage" }, children),
  };
});

jest.mock("../../spatial/components/SpatialOverlay", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    SpatialOverlay: ({ primitives }: { primitives: unknown[] }) =>
      React.createElement(View, {
        accessibilityLabel: `Overlay with ${primitives.length} primitives`,
      }),
  };
});

const plan: LessonPlan = {
  goal: "assemble a simple pcb",
  steps: [
    {
      n: 1,
      say: "Place the bare board in the square.",
      overlay: [{ type: "label", at: [0.5, 0.5], text: "board" }],
    },
    {
      n: 2,
      say: "Set the resistor beside the marked pads.",
      overlay: [{ type: "dot", at: [0.5, 0.5] }],
    },
  ],
};

describe("GuidedLesson", () => {
  it("keeps the current step, spoken instruction, and rendered overlay in lockstep", async () => {
    const narrate = jest.fn();

    await render(<GuidedLesson plan={plan} narrate={narrate} />);

    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    expect(screen.getByText("Place the bare board in the square.")).toBeTruthy();
    expect(screen.getByLabelText("Overlay with 1 primitives")).toBeTruthy();

    await fireEvent.press(screen.getByRole("button", { name: "Next step" }));

    expect(screen.getByText("Step 2 of 2")).toBeTruthy();
    expect(screen.getByText("Set the resistor beside the marked pads.")).toBeTruthy();
    expect(narrate).toHaveBeenLastCalledWith("Set the resistor beside the marked pads.");
  });

  it("finishes the lesson after the last step instead of showing stale controls", async () => {
    await render(<GuidedLesson plan={plan} narrate={jest.fn()} />);

    await fireEvent.press(screen.getByRole("button", { name: "Next step" }));
    await fireEvent.press(screen.getByRole("button", { name: "Next step" }));

    expect(screen.getByLabelText("Lesson complete")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
  });

  it("keeps the annotated lesson running with device voice when live WebRTC is unavailable", async () => {
    const narrate = jest.fn();
    const createSession = jest
      .fn()
      .mockRejectedValue(new Error("live voice requires a birdseye development build"));

    await render(
      <GuidedLesson
        plan={plan}
        tokenServerUrl="http://192.168.1.20:3000"
        narrate={narrate}
        createSession={createSession}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("device voice")).toBeTruthy();
      expect(narrate).toHaveBeenCalledWith("Place the bare board in the square.");
    });

    expect(screen.getByLabelText("Overlay with 1 primitives")).toBeTruthy();
  });
});
