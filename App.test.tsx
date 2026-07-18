import { fireEvent, render, screen } from "@testing-library/react-native";

import App from "./App";

jest.mock("react-native-webrtc", () => ({
  mediaDevices: {},
  RTCPeerConnection: jest.fn(),
  registerGlobals: jest.fn(),
}));

jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(),
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

describe("Birdseye app", () => {
  it("starts the reliable cached crane lesson through the shared guided executor", async () => {
    await render(<App />);

    await fireEvent.press(screen.getByRole("button", { name: "Cached crane lesson" }));

    expect(screen.getByText("Step 1 of 6")).toBeTruthy();
    expect(screen.getByText(/Place the paper in the square/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next step" })).toBeTruthy();
  });
});
