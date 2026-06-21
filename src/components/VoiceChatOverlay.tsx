import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { requestRecordingPermissionsAsync, setAudioModeAsync } from "expo-audio";
import type { RuntimeModel } from "../runtime/modelManifest";
import type { QvacDelegateOptions } from "../runtime/qvacClient";
import type { RealtimeVoiceLoop } from "../runtime/qvacVoiceLoop";
import { startVoiceMicStream, type VoiceMicStream } from "../runtime/voiceMicStream";
import { playPcmFloat32, stopPcmPlayback } from "../runtime/voicePcmPlayback";
import {
  voiceAddonsReady,
  type VoiceChatPhase,
} from "../runtime/voiceChatSession";
import { colors, typography } from "../theme";
import { GlyphIcon } from "../icons";
import { TypewriterStatus } from "./TypewriterStatus";
import { PulsingAsciiCircle } from "./PulsingAsciiCircle";

type VoiceChatOverlayProps = {
  visible: boolean;
  agentModel: RuntimeModel;
  installedModelIds: Set<string>;
  modelReady: boolean;
  onboardingComplete: boolean;
  downloadProgress: number | null;
  downloadBusyModelId: string | null;
  cloudMode: boolean;
  systemPrompt?: string;
  delegate?: QvacDelegateOptions;
  onDownloadVoiceAddons?: () => void | Promise<void>;
  onClose: () => void;
  onUserTranscript: (text: string) => void;
  onAgentReply: (text: string) => void;
  onError?: (detail: string) => void;
};

export function VoiceChatOverlay({
  visible,
  agentModel,
  installedModelIds,
  modelReady,
  onboardingComplete,
  downloadProgress,
  downloadBusyModelId,
  cloudMode,
  systemPrompt,
  delegate,
  onDownloadVoiceAddons,
  onClose,
  onUserTranscript,
  onAgentReply,
  onError,
}: VoiceChatOverlayProps) {
  const [phase, setPhase] = useState<VoiceChatPhase>("initializing");
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [initProgress, setInitProgress] = useState(0);
  const loopRef = useRef<RealtimeVoiceLoop | null>(null);
  const micStreamRef = useRef<VoiceMicStream | null>(null);
  const bootStartedRef = useRef(false);
  const downloadRequestedRef = useRef(false);

  const agentInstalled = installedModelIds.has(agentModel.id);
  const voiceAddonsInstalled = voiceAddonsReady(installedModelIds);
  const isFirstTimeSetup = !onboardingComplete || !agentInstalled || !voiceAddonsInstalled;
  const isDownloadingAgent = downloadBusyModelId === agentModel.id;
  const isDownloadingVoiceAddon =
    downloadBusyModelId === "whisper-tiny" || downloadBusyModelId === "supertonic-tts-en";

  const voiceReadyToBoot =
    !cloudMode &&
    modelReady &&
    agentInstalled &&
    voiceAddonsInstalled &&
    onboardingComplete &&
    !isDownloadingAgent &&
    !isDownloadingVoiceAddon;

  const setupStatusLines = useMemo(() => {
    const lines: string[] = [];
    if (isFirstTimeSetup) {
      lines.push("First-time setup: preparing on-device voice.");
    }
    if (!agentInstalled) {
      lines.push(`Download ${agentModel.title} from Models to enable voice chat.`);
    } else if (isDownloadingAgent) {
      lines.push(`Downloading ${agentModel.title}…`);
    }
    if (!installedModelIds.has("whisper-tiny")) {
      lines.push("Downloading the Listener add-on prepares private speech recognition.");
    } else if (downloadBusyModelId === "whisper-tiny") {
      lines.push("Downloading Listener…");
    }
    if (!installedModelIds.has("supertonic-tts-en")) {
      lines.push("Downloading the Voice add-on prepares private speech playback.");
    } else if (downloadBusyModelId === "supertonic-tts-en") {
      lines.push("Downloading Voice TTS…");
    }
    if (!onboardingComplete) {
      lines.push("Complete First Agent Setup before going live.");
    }
    return lines;
  }, [
    agentInstalled,
    agentModel.title,
    downloadBusyModelId,
    installedModelIds,
    isDownloadingAgent,
    isFirstTimeSetup,
    onboardingComplete,
  ]);

  const downloadActive = isDownloadingAgent || isDownloadingVoiceAddon;
  const downloadLabel = isDownloadingAgent
    ? agentModel.title
    : downloadBusyModelId === "whisper-tiny"
      ? "Listener"
      : downloadBusyModelId === "supertonic-tts-en"
        ? "Voice TTS"
        : null;

  useEffect(() => {
    if (!visible) {
      downloadRequestedRef.current = false;
      return;
    }
    if (
      cloudMode ||
      !agentInstalled ||
      voiceAddonsInstalled ||
      downloadActive ||
      downloadRequestedRef.current ||
      !onDownloadVoiceAddons
    ) {
      return;
    }
    downloadRequestedRef.current = true;
    void Promise.resolve(onDownloadVoiceAddons()).catch((error) => {
      const detail = error instanceof Error ? error.message : String(error);
      setPhase("error");
      setStatusLines([detail]);
      onError?.(detail);
    });
  }, [
    agentInstalled,
    cloudMode,
    downloadActive,
    onDownloadVoiceAddons,
    onError,
    visible,
    voiceAddonsInstalled,
  ]);

  const bootStatusLines = useMemo(
    () => [
      ...(isFirstTimeSetup ? setupStatusLines.slice(0, 2) : []),
      "Loading Whisper listener…",
      "Loading Supertonic TTS…",
      `Warming up ${agentModel.title}…`,
      "Opening microphone stream…",
    ],
    [agentModel.title, isFirstTimeSetup, setupStatusLines],
  );

  const teardown = useCallback(async () => {
    bootStartedRef.current = false;
    if (micStreamRef.current) {
      await micStreamRef.current.stop().catch(() => {});
      micStreamRef.current = null;
    }
    if (loopRef.current) {
      await loopRef.current.stop().catch(() => {});
      loopRef.current = null;
    }
    await stopPcmPlayback();
    setAudioLevel(0);
    setInitProgress(0);
    setPhase("initializing");
    setStatusLines([]);
  }, []);

  useEffect(() => {
    if (!visible) {
      void teardown();
      return;
    }

    if (cloudMode) {
      setPhase("error");
      setStatusLines(["Voice mode requires Private on-device chat."]);
      onError?.("Switch chat to Private before using voice mode.");
      return;
    }

    if (!voiceReadyToBoot) {
      setPhase("initializing");
      setStatusLines(setupStatusLines.length ? setupStatusLines : ["Preparing voice…"]);
      setInitProgress(
        typeof downloadProgress === "number" ? Math.max(0.12, downloadProgress / 100) : isFirstTimeSetup ? 0.1 : 0.08,
      );
      return;
    }

    if (bootStartedRef.current) return;
    bootStartedRef.current = true;

    let cancelled = false;
    let progressTimer: ReturnType<typeof setInterval> | null = null;

    void (async () => {
      setPhase("initializing");
      setInitProgress(0.08);
      setStatusLines(bootStatusLines);

      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setPhase("error");
        setStatusLines(["Microphone permission is required."]);
        onError?.("Microphone permission denied.");
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: "duckOthers",
      });

      setStatusLines(bootStatusLines);
      progressTimer = setInterval(() => {
        setInitProgress((value) => Math.min(0.92, value + 0.04));
      }, 180);

      try {
        const { startQvacRealtimeVoiceLoop } = await import("../runtime/qvacVoiceLoop");
        const loop = await startQvacRealtimeVoiceLoop({
          agentModel,
          systemPrompt,
          delegate,
          callbacks: {
            onVad: (speaking, probability) => {
              if (speaking) {
                setAudioLevel((level) => Math.max(level, 0.25 + probability * 0.55));
              }
            },
            onTranscript: (text) => {
              setPhase("processing");
              setStatusLines(["Thinking…"]);
              onUserTranscript(text);
            },
            onReply: (text) => {
              onAgentReply(text);
              setStatusLines([text.slice(0, 120)]);
            },
            onSpeechPcm: (samples, sampleRate) => {
              setPhase("speaking");
              setStatusLines(["Speaking…"]);
              void playPcmFloat32(samples, sampleRate).finally(() => {
                if (!cancelled) {
                  setPhase("listening");
                  setStatusLines(["Listening…"]);
                }
              });
            },
            onError: (error) => {
              setPhase("error");
              setStatusLines([error]);
              onError?.(error);
            },
          },
        });

        if (cancelled) {
          await loop.stop();
          return;
        }

        loopRef.current = loop;
        micStreamRef.current = await startVoiceMicStream({
          onPcmFloat32: (chunk) => {
            loopRef.current?.writePcmFloat32(chunk);
          },
          onLevel: (level) => {
            setAudioLevel((current) => Math.max(current * 0.65, level));
          },
          onError: (message) => {
            setPhase("error");
            setStatusLines([message]);
            onError?.(message);
          },
        });
        setInitProgress(1);
        setPhase("listening");
        setStatusLines(["Listening…"]);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        setPhase("error");
        setStatusLines([detail]);
        onError?.(detail);
      } finally {
        if (progressTimer) clearInterval(progressTimer);
      }
    })();

    return () => {
      cancelled = true;
      if (progressTimer) clearInterval(progressTimer);
    };
  }, [
    agentModel,
    bootStatusLines,
    cloudMode,
    delegate,
    downloadProgress,
    isFirstTimeSetup,
    onAgentReply,
    onError,
    onUserTranscript,
    setupStatusLines,
    systemPrompt,
    teardown,
    visible,
    voiceReadyToBoot,
  ]);

  useEffect(() => {
    if (!visible || !downloadActive) return;
    setInitProgress(typeof downloadProgress === "number" ? Math.max(0.12, downloadProgress / 100) : 0.12);
  }, [downloadActive, downloadProgress, visible]);

  const orbPhase =
    phase === "initializing"
      ? "initializing"
      : phase === "speaking"
        ? "speaking"
        : phase === "processing"
          ? "processing"
          : phase === "listening"
            ? "listening"
            : "idle";

  const displayLines =
    phase === "listening"
      ? ["Listening…"]
      : phase === "processing"
        ? statusLines.length ? statusLines : ["Thinking…"]
        : phase === "speaking"
          ? ["Speaking…"]
          : statusLines.length
            ? statusLines
            : ["Preparing voice…"];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{isFirstTimeSetup ? "Voice Setup" : "Voice"}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <GlyphIcon glyph="ERR" size={12} color={colors.foreground} />
            </Pressable>
          </View>

          <View style={styles.orbFrame}>
            <PulsingAsciiCircle
              audioLevel={Math.max(audioLevel, phase === "initializing" ? 0.12 : 0.04)}
              initProgress={initProgress}
              phase={orbPhase}
            />
            {phase === "initializing" ? (
              <VoiceMatrixProgress progress={initProgress} />
            ) : null}
          </View>

          <TypewriterStatus
            lines={displayLines}
            style={styles.status}
            charIntervalMs={isFirstTimeSetup ? 40 : 32}
            holdMs={isFirstTimeSetup ? 4800 : 2600}
          />
          {downloadActive && downloadLabel ? (
            <Text style={styles.downloadProgress}>
              Downloading {downloadLabel}
              {typeof downloadProgress === "number" ? ` · ${Math.round(downloadProgress)}%` : "…"}
            </Text>
          ) : null}
          <Text style={styles.hint}>
            {isFirstTimeSetup
              ? "First-time setup - downloads run here"
              : `${agentModel.title} · Supertonic TTS · Whisper listener`}
          </Text>

          {phase === "error" ? (
            <Pressable style={styles.retryHint} onPress={onClose}>
              <Text style={styles.retryHintText}>Close and try again</Text>
            </Pressable>
          ) : isFirstTimeSetup && !voiceReadyToBoot ? (
            <Pressable
              style={styles.retryHint}
              disabled={downloadActive || !onDownloadVoiceAddons}
              onPress={() => {
                if (downloadActive || !onDownloadVoiceAddons) return;
                downloadRequestedRef.current = true;
                void Promise.resolve(onDownloadVoiceAddons()).catch((error) => {
                  const detail = error instanceof Error ? error.message : String(error);
                  setPhase("error");
                  setStatusLines([detail]);
                  onError?.(detail);
                });
              }}
            >
              <Text style={styles.retryHintText}>
                {downloadActive ? "Downloading voice add-ons" : "Download voice add-ons"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function VoiceMatrixProgress({ progress }: { progress: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const normalized = Math.max(0.08, Math.min(1, progress));
  const activeCells = Math.max(1, Math.round(normalized * 18));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 980,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.voiceProgressShell} pointerEvents="none">
      {Array.from({ length: 18 }).map((_, index) => {
        const active = index < activeCells;
        const start = index / 18;
        const peak = Math.min(1, start + 0.18);
        const opacity = active
          ? pulse.interpolate({
              inputRange: [0, start, peak, 1],
              outputRange: [0.62, 0.62, 1, 0.78],
              extrapolate: "clamp",
            })
          : 0.18;
        const scale = active
          ? pulse.interpolate({
              inputRange: [0, start, peak, 1],
              outputRange: [0.9, 0.9, 1.08, 0.96],
              extrapolate: "clamp",
            })
          : 1;
        return (
          <Animated.View
            key={index}
            style={[
              styles.voiceProgressCell,
              active ? styles.voiceProgressCellActive : null,
              { opacity, transform: [{ scale }] },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(5,5,4,0.92)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  sheet: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.foreground,
    fontFamily: typography.heading,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  closeButton: {
    padding: 8,
  },
  orbFrame: {
    height: Platform.OS === "android" ? 320 : 300,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  initRing: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(231,224,212,0.12)",
    overflow: "hidden",
  },
  initRingFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  voiceProgressShell: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 14,
    height: 16,
    borderWidth: 1,
    borderColor: colors.accentTertiary,
    backgroundColor: "rgba(198,177,155,0.08)",
    paddingHorizontal: 6,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  voiceProgressCell: {
    flex: 1,
    height: 5,
    borderRadius: 1,
    backgroundColor: "rgba(231,224,212,0.18)",
  },
  voiceProgressCellActive: {
    backgroundColor: colors.accent,
  },
  status: {
    color: colors.foreground,
    fontSize: 15,
    minHeight: 44,
  },
  downloadProgress: {
    color: colors.accent,
    fontFamily: typography.button,
    fontSize: 12,
    textAlign: "center",
  },
  hint: {
    color: colors.mutedForeground,
    fontFamily: typography.body,
    fontSize: 11,
    textAlign: "center",
  },
  retryHint: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  retryHintText: {
    color: colors.accent,
    fontFamily: typography.button,
    fontSize: 12,
  },
});
