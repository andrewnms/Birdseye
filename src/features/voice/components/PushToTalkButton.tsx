import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { gradients, palette, radius } from "../../design/tokens";

/** Speech-tuned recording: mono 16 kHz uploads ~4x smaller than the hi-fi preset. */
const speechRecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  sampleRate: 16_000,
  numberOfChannels: 1,
  bitRate: 64_000,
};

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
  /** `mic` renders the 66px round mic from the v3 mock; `pill` is a wide bar. */
  variant?: "pill" | "mic";
  style?: StyleProp<ViewStyle>;
};

function MicGlyph({ color }: { color: string }) {
  return (
    <Svg fill="none" height={26} viewBox="0 0 24 24" width={26}>
      <Rect height={11} rx={3} stroke={color} strokeWidth={2.2} width={6} x={9} y={3} />
      <Path
        d="M6 11a6 6 0 0012 0M12 17v4"
        stroke={color}
        strokeLinecap="round"
        strokeWidth={2.2}
      />
    </Svg>
  );
}

/**
 * Hold-to-record microphone control for Expo Go, where streaming realtime
 * audio is unavailable. Each release hands one bounded m4a clip to the caller.
 */
export function PushToTalkButton({
  onClip,
  busy = false,
  idleLabel = "hold to talk",
  busyLabel = "thinking…",
  variant = "pill",
  style,
}: PushToTalkButtonProps) {
  const recorder = useAudioRecorder(speechRecordingOptions);
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

  if (variant === "mic") {
    return (
      <Pressable
        accessibilityLabel="Talk to the tutor"
        accessibilityRole="button"
        disabled={busy}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.micRing, recording && styles.micRingRecording, style]}
      >
        {recording ? (
          <View style={[styles.micFace, styles.micFaceRecording]}>
            <MicGlyph color={palette.navy} />
          </View>
        ) : (
          <LinearGradient
            {...gradients.voice}
            style={[styles.micFace, busy && styles.busyFace]}
          >
            <MicGlyph color={palette.white} />
          </LinearGradient>
        )}
      </Pressable>
    );
  }

  const label = busy ? busyLabel : recording ? "listening… release to send" : idleLabel;

  return (
    <Pressable
      accessibilityLabel="Talk to the tutor"
      accessibilityRole="button"
      disabled={busy}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.button, style]}
    >
      {recording ? (
        <View style={[styles.face, styles.recordingFace]}>
          <Text style={styles.recordingLabel}>{label}</Text>
        </View>
      ) : (
        <LinearGradient {...gradients.voice} style={[styles.face, busy && styles.busyFace]}>
          <Text style={styles.label}>{label}</Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.talk,
    overflow: "hidden",
  },
  face: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 22,
    paddingVertical: 15,
  },
  busyFace: {
    opacity: 0.55,
  },
  recordingFace: {
    backgroundColor: palette.signal,
  },
  label: {
    color: palette.white,
    fontSize: 15,
    fontWeight: "800",
  },
  recordingLabel: {
    color: palette.navy,
    fontSize: 15,
    fontWeight: "800",
  },
  micRing: {
    alignItems: "center",
    backgroundColor: "rgba(76, 141, 255, 0.14)",
    borderRadius: 41,
    height: 82,
    justifyContent: "center",
    width: 82,
  },
  micRingRecording: {
    backgroundColor: "rgba(52, 224, 161, 0.22)",
  },
  micFace: {
    alignItems: "center",
    borderRadius: 33,
    height: 66,
    justifyContent: "center",
    overflow: "hidden",
    width: 66,
  },
  micFaceRecording: {
    backgroundColor: palette.signal,
  },
});
