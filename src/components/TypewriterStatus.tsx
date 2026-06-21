import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { typography } from "../theme";

type TypewriterStatusProps = {
  lines: string[];
  style?: StyleProp<TextStyle>;
  /** ms per character while typing */
  charIntervalMs?: number;
  /** ms to hold a completed line before switching */
  holdMs?: number;
};

/** Strip volatile suffixes (percentages, counts) so progress ticks do not restart the cycle. */
function stableCycleKey(lines: string[]) {
  return lines
    .filter(Boolean)
    .map((line) => line.replace(/\s[\d.]+%?\s*$/u, "").trim())
    .join("\n");
}

export function TypewriterStatus({
  lines,
  style,
  charIntervalMs = 36,
  holdMs = 4200,
}: TypewriterStatusProps) {
  const filtered = useMemo(() => lines.filter(Boolean), [lines]);
  const cycleKey = useMemo(() => stableCycleKey(filtered), [filtered]);
  const [lineIndex, setLineIndex] = useState(0);
  const [visible, setVisible] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleKeyRef = useRef(cycleKey);

  useEffect(() => {
    cycleKeyRef.current = cycleKey;
    setLineIndex(0);
  }, [cycleKey]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    if (!filtered.length) {
      setVisible("");
      return;
    }

    const safeIndex = lineIndex % filtered.length;
    const target = filtered[safeIndex] ?? "";
    let charIndex = 0;
    setVisible("");

    timerRef.current = setInterval(() => {
      charIndex = Math.min(target.length, charIndex + 1);
      setVisible(target.slice(0, charIndex));
      if (charIndex >= target.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        holdTimerRef.current = setTimeout(() => {
          if (cycleKeyRef.current !== cycleKey) return;
          setLineIndex((current) => (current + 1) % filtered.length);
        }, holdMs);
      }
    }, charIntervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [charIntervalMs, cycleKey, filtered, holdMs, lineIndex]);

  return (
    <Text style={[styles.text, style]}>
      {visible}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: typography.body,
    textAlign: "center",
  },
});
