import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import type { VoiceOrbPhase } from "../runtime/voiceChatSession";
import { colors, typography } from "../theme";

type PulsingAsciiCircleProps = {
  audioLevel?: number;
  compact?: boolean;
  phase?: VoiceOrbPhase;
  initProgress?: number;
  style?: StyleProp<ViewStyle>;
};

const RING_GLYPHS = "  .,:;irsXA253hMH#@";

function buildAsciiCircle(frame: number, cols: number, rows: number, level: number, phase?: VoiceOrbPhase) {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const voice = Math.min(1, Math.max(0, level));
  const phaseBoost = phase === "speaking" ? 0.2 : phase === "processing" ? 0.13 : phase === "listening" ? 0.08 : 0;
  const pulse = Math.sin(frame * 0.19) * (0.55 + voice * 1.3);
  const wobble = Math.cos(frame * 0.13) * (0.35 + voice * 1.6 + phaseBoost);
  const radius = Math.min(cols, rows * 1.9) * (0.22 + voice * 0.035) + pulse;
  const thickness = 1.25 + voice * 2.4 + phaseBoost * 4;
  const lines: string[] = [];

  for (let y = 0; y < rows; y += 1) {
    let line = "";
    for (let x = 0; x < cols; x += 1) {
      const dx = x - cx;
      const dy = (y - cy) * 1.85;
      const angle = Math.atan2(dy, dx);
      const radialWarp = Math.sin(angle * 5 + frame * 0.12) * wobble + Math.cos(angle * 3 - frame * 0.1) * voice * 1.7;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const ringDistance = Math.abs(distance - radius - radialWarp);
      const coreDistance = Math.abs(distance - radius * 0.42 - Math.sin(angle * 4 + frame * 0.08) * voice * 1.2);
      const spark = Math.sin(x * 0.55 + y * 0.44 + frame * 0.22);

      if (ringDistance < thickness) {
        const energy = 1 - ringDistance / thickness + voice * 0.35 + Math.max(0, spark) * 0.22;
        line += RING_GLYPHS[Math.min(RING_GLYPHS.length - 1, Math.max(2, Math.floor(energy * (RING_GLYPHS.length - 1))))];
      } else if (coreDistance < 0.52 + voice * 0.85) {
        line += RING_GLYPHS[Math.min(RING_GLYPHS.length - 1, 4 + Math.floor(voice * 9))];
      } else {
        line += " ";
      }
    }
    lines.push(line);
  }

  return lines.join("\n");
}

export function PulsingAsciiCircle({
  audioLevel = 0,
  compact = false,
  phase = "idle",
  initProgress = 1,
  style,
}: PulsingAsciiCircleProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((value) => (value + 1) % 10000), 33);
    return () => clearInterval(timer);
  }, []);

  const cols = compact ? 35 : 48;
  const rows = compact ? 12 : 20;
  const effectiveLevel = Math.max(audioLevel, phase === "initializing" ? Math.max(0.08, initProgress * 0.18) : 0.04);
  const ascii = useMemo(
    () => buildAsciiCircle(frame, cols, rows, effectiveLevel, phase),
    [cols, effectiveLevel, frame, phase, rows],
  );

  return (
    <View style={[compact ? styles.compactFrame : styles.frame, style]}>
      <Text style={[styles.text, compact ? styles.compactText : null]} selectable={false}>
        {ascii}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
    overflow: "hidden",
    paddingVertical: 14,
  },
  compactFrame: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 118,
    overflow: "hidden",
    paddingVertical: 4,
  },
  text: {
    color: colors.accent,
    fontFamily: typography.mono,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0,
    textAlign: "center",
  },
  compactText: {
    color: colors.accent,
    fontSize: 8,
    lineHeight: 9,
  },
});
