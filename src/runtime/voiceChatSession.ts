import type { RuntimeModel } from "./modelManifest";

export type VoiceChatPhase = "initializing" | "listening" | "processing" | "speaking" | "error";

export type VoiceOrbPhase = "initializing" | "listening" | "processing" | "speaking" | "idle";

export function voiceAddonsReady(installedModelIds: Set<string>) {
  return installedModelIds.has("whisper-tiny") && installedModelIds.has("supertonic-tts-en");
}

export function voicePhaseLabel(phase: VoiceChatPhase, detail?: string) {
  if (phase === "initializing") return detail || "Warming up voice models…";
  if (phase === "listening") return "Listening…";
  if (phase === "processing") return detail || "Thinking…";
  if (phase === "speaking") return "Speaking…";
  return detail || "Voice unavailable";
}

export function voiceModelHint(agentModel: RuntimeModel) {
  return `Agent: ${agentModel.title}`;
}
