import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import App from "./App";
import { getLiveLessonPlan } from "./src/features/planner/api-client/get-live-lesson-plan";
import { transcribeVoiceClip } from "./src/features/voice/api-client/voice-api";

jest.mock("react-native-webrtc", () => ({
  mediaDevices: {},
  RTCPeerConnection: jest.fn(),
  registerGlobals: jest.fn(),
}));

jest.mock("./src/features/camera/components/CameraStage", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    CameraStage: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock("./src/features/spatial/components/SpatialOverlay", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    SpatialOverlay: () => React.createElement(View),
  };
});

jest.mock("./src/features/voice/components/PushToTalkButton", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");

  return {
    PushToTalkButton: ({
      onClip,
      busy = false,
    }: {
      onClip(clip: { audioBase64: string; mimeType: string }): void;
      busy?: boolean;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityLabel: "Talk to the tutor",
          disabled: busy,
          onPress: () => onClip({ audioBase64: "aGVsbG8=", mimeType: "audio/m4a" }),
        },
        React.createElement(Text, null, "hold and say your goal"),
      ),
  };
});

jest.mock("./src/features/voice/lib/play-voice-reply", () => ({
  playVoiceReply: jest.fn().mockResolvedValue(undefined),
  stopVoicePlayback: jest.fn(),
}));

jest.mock("./src/features/voice/api-client/voice-api", () => ({
  transcribeVoiceClip: jest.fn(),
  askVoiceQuestion: jest.fn(),
  narrateText: jest.fn().mockResolvedValue("bXAz"),
}));

jest.mock("./src/features/planner/api-client/get-live-lesson-plan", () => ({
  getLiveLessonPlan: jest.fn(),
}));

const mockTranscribe = jest.mocked(transcribeVoiceClip);
const mockGetPlan = jest.mocked(getLiveLessonPlan);

describe("Birdseye app", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = "http://192.168.1.20:3000";
    mockTranscribe.mockReset();
    mockGetPlan.mockReset();
  });

  it("opens on the live camera and starts a lesson from one spoken goal", async () => {
    mockTranscribe.mockResolvedValue("fold an origami crane");
    mockGetPlan.mockResolvedValue({
      goal: "fold an origami crane",
      steps: [
        {
          n: 1,
          say: "Place the paper in the square.",
          overlay: [],
        },
      ],
    });

    await render(<App />);

    expect(screen.getByText(/point at your work/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText("Talk to the tutor"));

    await waitFor(() => {
      expect(mockTranscribe).toHaveBeenCalledWith(
        { audioBase64: "aGVsbG8=", mimeType: "audio/m4a" },
        expect.objectContaining({ baseUrl: expect.any(String) }),
      );
      expect(mockGetPlan).toHaveBeenCalledWith(
        "fold an origami crane",
        expect.objectContaining({ baseUrl: expect.any(String) }),
      );
      expect(screen.getByText("Step 1 of 1")).toBeTruthy();
      expect(screen.getByText("Place the paper in the square.")).toBeTruthy();
    });
  });

  it("keeps the camera launch usable when the spoken goal cannot be transcribed", async () => {
    mockTranscribe.mockRejectedValue(new Error("the voice service could not transcribe the clip"));

    await render(<App />);
    await fireEvent.press(screen.getByLabelText("Talk to the tutor"));

    await waitFor(() => {
      expect(screen.getByText("the voice service could not transcribe the clip")).toBeTruthy();
      expect(screen.getByLabelText("Talk to the tutor")).toBeTruthy();
    });

    expect(mockGetPlan).not.toHaveBeenCalled();
  });
});
