import { Audio } from "expo-av";
import { fromByteArray } from "react-native-quick-base64";
import * as FileSystem from "expo-file-system/legacy";

let activeSound: Audio.Sound | null = null;

function clampSample(value: number) {
  return Math.max(-1, Math.min(1, value));
}

function encodeWavMonoInt16(samples: number[], sampleRate: number) {
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (const sample of samples) {
    const int16 = Math.round(clampSample(sample) * 32767);
    view.setInt16(offset, int16, true);
    offset += 2;
  }

  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  return fromByteArray(new Uint8Array(buffer));
}

export async function stopPcmPlayback() {
  if (!activeSound) return;
  try {
    await activeSound.stopAsync();
    await activeSound.unloadAsync();
  } catch {
    // ignore stale sound handles
  }
  activeSound = null;
}

export async function playPcmFloat32(samples: number[], sampleRate: number) {
  if (!samples.length) return;
  await stopPcmPlayback();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  const wav = encodeWavMonoInt16(samples, sampleRate);
  const base64 = arrayBufferToBase64(wav);
  const uri = `${FileSystem.cacheDirectory}daemon-voice-${Date.now()}.wav`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });

  const sound = new Audio.Sound();
  activeSound = sound;
  await sound.loadAsync({ uri });
  await sound.playAsync();
  sound.setOnPlaybackStatusUpdate((status) => {
    if (!status.isLoaded) return;
    if (status.didJustFinish) {
      void stopPcmPlayback();
    }
  });
}
