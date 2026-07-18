import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

type ReleasablePlayer = {
  play(): void;
  release(): void;
};

let activePlayer: ReleasablePlayer | null = null;

/**
 * Plays one synthesized mp3 reply. A new reply replaces the previous one, and
 * silent-switch playback stays enabled so spoken answers remain audible.
 */
export async function playVoiceReply(replyAudioBase64: string): Promise<void> {
  const fileUri = `${FileSystem.cacheDirectory}birdseye-voice-reply.mp3`;
  await FileSystem.writeAsStringAsync(fileUri, replyAudioBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

  activePlayer?.release();
  // ponytail: the final player is released on the next reply, not on finish.
  const player = createAudioPlayer({ uri: fileUri });
  activePlayer = player;
  player.play();
}

/** Silences and releases whatever reply or narration is currently playing. */
export function stopVoicePlayback(): void {
  activePlayer?.release();
  activePlayer = null;
}
