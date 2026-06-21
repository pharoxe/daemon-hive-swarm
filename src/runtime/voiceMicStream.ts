import { PermissionsAndroid, Platform } from "react-native";
import { toByteArray } from "react-native-quick-base64";
import {
  addErrorListener,
  addFrameListener,
  requestPermission,
  start,
  stop,
  type AudioFrameEvent,
} from "expo-stream-audio";

export type VoiceMicStream = {
  stop: () => Promise<void>;
};

function pcm16Base64ToFloat32Bytes(pcmBase64: string) {
  const pcm16 = toByteArray(pcmBase64);
  const samples = new Int16Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength / 2);
  const float32 = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    float32[i] = (samples[i] ?? 0) / 32768;
  }
  return new Uint8Array(float32.buffer);
}

export async function startVoiceMicStream(params: {
  onPcmFloat32: (chunk: Uint8Array) => void;
  onLevel?: (level: number) => void;
  onError?: (message: string) => void;
}): Promise<VoiceMicStream> {
  let permission = await requestPermission();

  if (Platform.OS === "android" && permission !== "granted") {
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    if (result === PermissionsAndroid.RESULTS.GRANTED) {
      permission = "granted";
    }
  }

  if (permission !== "granted") {
    throw new Error("Microphone permission denied.");
  }

  const frameSub = addFrameListener((frame: AudioFrameEvent) => {
    params.onPcmFloat32(pcm16Base64ToFloat32Bytes(frame.pcmBase64));
    if (frame.level !== undefined) {
      params.onLevel?.(Math.min(1, frame.level * 3.5));
    }
  });
  const errorSub = addErrorListener((event) => {
    params.onError?.(event.message);
  });

  await start({
    sampleRate: 16000,
    frameDurationMs: 20,
    enableLevelMeter: true,
  });

  return {
    stop: async () => {
      frameSub.remove();
      errorSub.remove();
      await stop();
    },
  };
}
