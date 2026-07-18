import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { PermissionStatus, type PermissionResponse } from "expo-modules-core";
import {
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { AppState, Linking, Text } from "react-native";
import { createRef } from "react";

import { CameraStage, type CameraStageRef } from "./CameraStage";

const mockTakePictureAsync = jest.fn();

jest.mock("expo-camera", () => {
  const React = require("react");
  const { View } = require("react-native");
  const CameraView = React.forwardRef(
    (props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({
        takePictureAsync: mockTakePictureAsync,
      }));
      return React.createElement(View, props);
    },
  );
  CameraView.displayName = "MockCameraView";

  return {
    CameraView,
    useCameraPermissions: jest.fn(),
    useMicrophonePermissions: jest.fn(),
  };
});

const cameraPermissions = jest.mocked(useCameraPermissions);
const microphonePermissions = jest.mocked(useMicrophonePermissions);

describe("CameraStage", () => {
  const requestCamera = jest.fn();
  const refreshCamera = jest.fn();
  const requestMicrophone = jest.fn();
  const refreshMicrophone = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows a loading state while the native permission status is still loading", async () => {
    cameraPermissions.mockReturnValue([null, requestCamera, refreshCamera]);
    microphonePermissions.mockReturnValue([
      null,
      requestMicrophone,
      refreshMicrophone,
    ]);

    const { getByText, queryByTestId } = await render(<CameraStage />);

    expect(getByText("Checking camera access…")).toBeTruthy();
    expect(queryByTestId("live-camera-preview")).toBeNull();
  });

  it("does not capture a frame until the camera stage has granted access", async () => {
    const deniedPermission: PermissionResponse = {
      granted: false,
      canAskAgain: true,
      expires: "never",
      status: PermissionStatus.DENIED,
    };
    const stageRef = createRef<CameraStageRef>();
    cameraPermissions.mockReturnValue([
      deniedPermission,
      requestCamera,
      refreshCamera,
    ]);
    microphonePermissions.mockReturnValue([
      deniedPermission,
      requestMicrophone,
      refreshMicrophone,
    ]);

    await render(<CameraStage ref={stageRef} />);

    expect(stageRef.current).not.toBeNull();
    await expect(stageRef.current?.captureFrame()).resolves.toBeNull();
  });

  it("does not invoke the native camera before its granted preview is ready", async () => {
    const granted: PermissionResponse = {
      granted: true,
      canAskAgain: true,
      expires: "never",
      status: PermissionStatus.GRANTED,
    };
    const stageRef = createRef<CameraStageRef>();
    cameraPermissions.mockReturnValue([granted, requestCamera, refreshCamera]);
    microphonePermissions.mockReturnValue([
      granted,
      requestMicrophone,
      refreshMicrophone,
    ]);

    await render(<CameraStage ref={stageRef} />);

    await expect(stageRef.current?.captureFrame()).resolves.toBeNull();
    expect(mockTakePictureAsync).not.toHaveBeenCalled();
  });

  it("returns a compressed base64 JPEG frame after the granted preview is ready", async () => {
    const granted: PermissionResponse = {
      granted: true,
      canAskAgain: true,
      expires: "never",
      status: PermissionStatus.GRANTED,
    };
    const stageRef = createRef<CameraStageRef>();
    mockTakePictureAsync.mockResolvedValue({
      base64: "compressed-jpeg-data",
      format: "jpg",
      height: 480,
      uri: "file:///frame.jpg",
      width: 640,
    });
    cameraPermissions.mockReturnValue([granted, requestCamera, refreshCamera]);
    microphonePermissions.mockReturnValue([
      granted,
      requestMicrophone,
      refreshMicrophone,
    ]);

    const { getByTestId } = await render(<CameraStage ref={stageRef} />);
    await act(async () => {
      fireEvent(getByTestId("live-camera-preview"), "onCameraReady");
    });

    await expect(stageRef.current?.captureFrame()).resolves.toEqual({
      base64: "compressed-jpeg-data",
      height: 480,
      width: 640,
    });
    expect(mockTakePictureAsync).toHaveBeenCalledWith({
      base64: true,
      quality: 0.25,
    });
  });

  it("requests both permissions when access can be requested again", async () => {
    const deniedPermission: PermissionResponse = {
      granted: false,
      canAskAgain: true,
      expires: "never",
      status: PermissionStatus.DENIED,
    };
    cameraPermissions.mockReturnValue([
      deniedPermission,
      requestCamera,
      refreshCamera,
    ]);
    microphonePermissions.mockReturnValue([
      deniedPermission,
      requestMicrophone,
      refreshMicrophone,
    ]);

    const { getByRole } = await render(<CameraStage />);
    fireEvent.press(
      getByRole("button", { name: "Enable camera and microphone" }),
    );

    await waitFor(() => {
      expect(requestCamera).toHaveBeenCalledTimes(1);
      expect(requestMicrophone).toHaveBeenCalledTimes(1);
    });
  });

  it("directs a previously denied permission to Settings so returning can recover", async () => {
    const permanentlyDenied: PermissionResponse = {
      granted: false,
      canAskAgain: false,
      expires: "never",
      status: PermissionStatus.DENIED,
    };
    const granted: PermissionResponse = {
      granted: true,
      canAskAgain: true,
      expires: "never",
      status: PermissionStatus.GRANTED,
    };
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    cameraPermissions.mockReturnValue([
      permanentlyDenied,
      requestCamera,
      refreshCamera,
    ]);
    microphonePermissions.mockReturnValue([
      granted,
      requestMicrophone,
      refreshMicrophone,
    ]);

    const { getByRole, queryByTestId } = await render(<CameraStage />);
    fireEvent.press(getByRole("button", { name: "Open Settings" }));

    expect(openSettings).toHaveBeenCalledTimes(1);
    expect(queryByTestId("live-camera-preview")).toBeNull();
  });

  it("rechecks both permission statuses when the app returns from Settings", async () => {
    const granted: PermissionResponse = {
      granted: true,
      canAskAgain: true,
      expires: "never",
      status: PermissionStatus.GRANTED,
    };
    const subscription = { remove: jest.fn() };
    const addAppStateListener = jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue(subscription);
    cameraPermissions.mockReturnValue([granted, requestCamera, refreshCamera]);
    microphonePermissions.mockReturnValue([
      granted,
      requestMicrophone,
      refreshMicrophone,
    ]);

    const { unmount } = await render(<CameraStage />);

    expect(addAppStateListener).toHaveBeenCalledWith("change", expect.any(Function));
    const onAppStateChange = addAppStateListener.mock.calls[0]?.[1];

    await act(async () => {
      onAppStateChange?.("active");
    });

    await waitFor(() => {
      expect(refreshCamera).toHaveBeenCalledTimes(1);
      expect(refreshMicrophone).toHaveBeenCalledTimes(1);
    });
    await unmount();
    expect(subscription.remove).toHaveBeenCalledTimes(1);
  });

  it("renders a full-screen back-camera preview with controls in a sibling overlay", async () => {
    const granted: PermissionResponse = {
      granted: true,
      canAskAgain: true,
      expires: "never",
      status: PermissionStatus.GRANTED,
    };
    cameraPermissions.mockReturnValue([granted, requestCamera, refreshCamera]);
    microphonePermissions.mockReturnValue([
      granted,
      requestMicrophone,
      refreshMicrophone,
    ]);

    const { getByTestId, getByText } = await render(
      <CameraStage>
        <Text>Next instruction</Text>
      </CameraStage>,
    );

    expect(getByTestId("camera-stage")).toBeTruthy();
    expect(getByTestId("live-camera-preview").props.facing).toBe("back");
    expect(getByTestId("camera-stage-overlay")).toBeTruthy();
    expect(getByText("Next instruction")).toBeTruthy();
  });

});
