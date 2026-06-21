import { useEffect, useState } from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { typography } from "../theme";

const DONE_KEYS = new Set<string>();

type TypewriterHeadingProps = {
  stableKey: string;
  text: string;
  style?: StyleProp<TextStyle>;
  /** When false, show full text immediately (no animation). */
  enableAnimation?: boolean;
};

export function TypewriterHeading({ stableKey, text, style, enableAnimation = true }: TypewriterHeadingProps) {
  const done = DONE_KEYS.has(stableKey);
  const [visibleText, setVisibleText] = useState(enableAnimation && !done ? "" : text);

  useEffect(() => {
    if (!enableAnimation) {
      setVisibleText(text);
      return;
    }
    if (DONE_KEYS.has(stableKey)) {
      setVisibleText(text);
      return;
    }
    if (!text) {
      setVisibleText("");
      return;
    }

    let index = 0;
    const step = Math.max(1, Math.ceil(text.length / 72));
    setVisibleText("");

    const timer = setInterval(() => {
      index = Math.min(text.length, index + step);
      setVisibleText(text.slice(0, index));
      if (index >= text.length) {
        DONE_KEYS.add(stableKey);
        clearInterval(timer);
      }
    }, 22);

    return () => clearInterval(timer);
  }, [text, enableAnimation, stableKey]);

  const animating = enableAnimation && visibleText.length < text.length;

  return (
    <Text style={[styles.text, style]}>
      {visibleText}
      {animating ? <Text style={styles.cursor}>|</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontFamily: typography.heading,
  },
  cursor: {
    opacity: 0.65,
  },
});
