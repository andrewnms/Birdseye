import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import type { CameraViewProps } from "expo-camera";
import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import {
  ActivityIndicator,
  AppState,
  Button,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type CameraStageProps = PropsWithChildren<{
  cameraProps?: Omit<CameraViewProps, "children" | "style" | "testID">;
}>;

export function CameraStage({ children, cameraProps }: CameraStageProps) {
  const [
    cameraPermission,
    requestCameraPermission,
    refreshCameraPermission,
  ] = useCameraPermissions();
  const [
    microphonePermission,
    requestMicrophonePermission,
    refreshMicrophonePermission,
  ] = useMicrophonePermissions();

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        void Promise.all([
          refreshCameraPermission(),
          refreshMicrophonePermission(),
        ]);
      }
    });

    return () => subscription.remove();
  }, [refreshCameraPermission, refreshMicrophonePermission]);

  if (!cameraPermission || !microphonePermission) {
    return (
      <View style={styles.loading} accessibilityLabel="Checking camera access">
        <ActivityIndicator />
        <Text>Checking camera access…</Text>
      </View>
    );
  }

  const currentCameraPermission = cameraPermission;
  const currentMicrophonePermission = microphonePermission;

  if (!currentCameraPermission.granted || !currentMicrophonePermission.granted) {
    const hasPermanentlyDeniedPermission =
      (!currentCameraPermission.granted &&
        !currentCameraPermission.canAskAgain) ||
      (!currentMicrophonePermission.granted &&
        !currentMicrophonePermission.canAskAgain);
    const canRequestPermission =
      (!currentCameraPermission.granted &&
        currentCameraPermission.canAskAgain) ||
      (!currentMicrophonePermission.granted &&
        currentMicrophonePermission.canAskAgain);

    async function requestPermissions() {
      if (
        !currentCameraPermission.granted &&
        currentCameraPermission.canAskAgain
      ) {
        await requestCameraPermission();
      }

      if (
        !currentMicrophonePermission.granted &&
        currentMicrophonePermission.canAskAgain
      ) {
        await requestMicrophonePermission();
      }
    }

    function openSettings() {
      void Linking.openSettings().catch(() => undefined);
    }

    return (
      <View style={styles.permission}>
        <Text style={styles.title}>Camera and microphone access is required</Text>
        <Text style={styles.message}>
          Birdseye uses your camera for live guidance and your microphone for
          hands-free controls.
        </Text>
        {canRequestPermission ? (
          <Button
            title="Enable camera and microphone"
            onPress={() => void requestPermissions()}
          />
        ) : null}
        {hasPermanentlyDeniedPermission ? (
          <Button title="Open Settings" onPress={openSettings} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.stage} testID="camera-stage">
      <CameraView
        {...cameraProps}
        facing={cameraProps?.facing ?? "back"}
        style={styles.camera}
        testID="live-camera-preview"
      />
      <View
        pointerEvents="box-none"
        style={styles.overlay}
        testID="camera-stage-overlay"
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  message: {
    lineHeight: 22,
    textAlign: "center",
  },
  permission: {
    alignItems: "center",
    flex: 1,
    gap: 16,
    justifyContent: "center",
    padding: 32,
  },
  stage: {
    flex: 1,
  },
  camera: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  overlay: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
  },
});
