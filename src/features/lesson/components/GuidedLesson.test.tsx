import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import type { LessonPlan } from "../lib/plan";
import { GuidedLesson } from "./GuidedLesson";

const mockCaptureFrame = jest.fn();

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

  const CameraStage = React.forwardRef(
      ({ children }: { children: React.ReactNode }, ref: unknown) => {
        React.useImperativeHandle(ref, () => ({
          captureFrame: mockCaptureFrame,
        }));
        return React.createElement(View, { testID: "camera-stage" }, children);
      },
    );
  CameraStage.displayName = "MockCameraStage";

  return { CameraStage };
});

jest.mock("../../spatial/components/SpatialOverlay", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    SpatialOverlay: ({
      primitives,
      anchorMode = "world",
    }: {
      primitives: unknown[];
      anchorMode?: string;
    }) =>
      React.createElement(View, {
        accessibilityLabel: `Overlay ${anchorMode} with ${primitives.length} primitives`,
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
  beforeEach(() => {
    mockCaptureFrame.mockReset();
    mockCaptureFrame.mockResolvedValue(null);
  });

  it("keeps the current step, spoken instruction, and rendered overlay in lockstep", async () => {
    const narrate = jest.fn();

    await render(<GuidedLesson plan={plan} narrate={narrate} />);

    expect(screen.getByText("Step 1 of 2")).toBeTruthy();
    expect(screen.getByText("Place the bare board in the square.")).toBeTruthy();
    expect(screen.getByLabelText("Overlay world with 1 primitives")).toBeTruthy();

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

    expect(screen.getByLabelText("Overlay world with 1 primitives")).toBeTruthy();
  });

  it("replaces the static guidance with a world-anchored annotation from the current camera frame", async () => {
    const analyzeFrame = jest.fn().mockResolvedValue({
      observation: "the paper point is visible at the center.",
      overlay: [{ type: "label", at: [0.5, 0.5], text: "fold this point" }],
    });
    mockCaptureFrame.mockResolvedValue({
      base64: "frame-data",
      width: 640,
      height: 480,
    });

    await render(
      <GuidedLesson
        plan={plan}
        tokenServerUrl="http://192.168.1.20:3000"
        createSession={jest
          .fn()
          .mockRejectedValue(new Error("live voice requires a birdseye development build"))}
        analyzeFrame={analyzeFrame}
      />,
    );

    await waitFor(() => {
      expect(analyzeFrame).toHaveBeenCalledWith(
        {
          goal: "assemble a simple pcb",
          step: { n: 1, say: "Place the bare board in the square." },
          imageDataUrl: "data:image/jpeg;base64,frame-data",
        },
        expect.objectContaining({ baseUrl: "http://192.168.1.20:3000" }),
      );
      expect(screen.getByLabelText("Overlay world with 1 primitives")).toBeTruthy();
      expect(screen.getByText("the paper point is visible at the center.")).toBeTruthy();
    });
  });
});
