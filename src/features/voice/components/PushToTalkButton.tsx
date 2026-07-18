import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";

export type RecordedVoiceClip = {
  audioBase64: string;
  mimeType: string;
};

export type PushToTalkButtonProps = {
  onClip(clip: RecordedVoiceClip): void;
  /** Shown while the caller processes the last clip; recording is disabled. */
  busy?: boolean;
  idleLabel?: string;
  busyLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Hold-to-record microphone control for Expo Go, where streaming realtime
 * audio is unavailable. Each release hands one bounded m4a clip to the caller.
 */
export function PushToTalkButton({
  onClip,
  busy = false,
  idleLabel = "hold to talk",
  busyLabel = "thinking…",
  style,
}: PushToTalkButtonProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const pressedRef = useRef(false);
  const busyRef = useRef(false);

  const finishRecording = useCallback(async () => {
    setRecording(false);

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      const uri = recorder.uri;

      if (!uri) {
        return;
      }

      const audioBase64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      onClip({ audioBase64, mimeType: "audio/m4a" });
    } catch {
      // A failed clip leaves the button ready for the next attempt.
    }
  }, [onClip, recorder]);

  const handlePressIn = useCallback(async () => {
    if (busy || busyRef.current) {
      return;
    }

    pressedRef.current = true;
    busyRef.current = true;

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();

      if (!permission.granted || !pressedRef.current) {
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();

      if (!pressedRef.current) {
        return;
      }

      recorder.record();
      setRecording(true);
    } catch {
      // Missing microphone access simply keeps the button idle.
    } finally {
      busyRef.current = false;

      if (!pressedRef.current && recorder.isRecording) {
        void finishRecording();
      }
    }
  }, [busy, finishRecording, recorder]);

  const handlePressOut = useCallback(() => {
    pressedRef.current = false;

    if (recording) {
      void finishRecording();
    }
  }, [finishRecording, recording]);

  return (
    <Pressable
      accessibilityLabel="Talk to the tutor"
      accessibilityRole="button"
      disabled={busy}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.button, recording && styles.buttonRecording, style]}
    >
      <Text style={styles.label}>
        {busy ? busyLabel : recording ? "listening… release to send" : idleLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "rgba(8, 15, 24, 0.9)",
    borderColor: "#d8ff69",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 16,
  },
  buttonRecording: {
    backgroundColor: "#d8ff69",
    borderColor: "#d8ff69",
  },
  label: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
});
