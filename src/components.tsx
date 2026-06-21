import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type StyleProp,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GlyphIcon, type IconGlyph } from "./icons";
import { colors, shadows, typography } from "./theme";

type PanelProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: "green" | "magenta" | "cyan";
};

export function Panel({ children, style, accent = "green" }: PanelProps) {
  const accentColor =
    accent === "magenta" ? colors.accentSecondary : accent === "cyan" ? colors.accentTertiary : colors.accent;

  return (
    <View style={[styles.panelOuter, { borderColor: accentColor }, style]}>
      <LinearGradient
        colors={["rgba(18,16,14,0.98)", "rgba(28,22,18,0.78)", "rgba(10,10,9,0.98)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.panelInner}
      >
        {children}
        <LinearGradient
          pointerEvents="none"
          colors={[accentColor + "24", "rgba(194,106,58,0)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.panelSheen}
        />
      </LinearGradient>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "outline";
  icon?: IconGlyph;
  loading?: boolean;
  prominent?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function CyberButton({ label, onPress, variant = "primary", icon, loading = false, prominent, style }: ButtonProps) {
  const accent = variant === "secondary" ? colors.accentSecondary : colors.accent;
  const filled = variant === "primary";
  const showShine = prominent ?? variant === "secondary";
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shine, {
        toValue: 1,
        duration: 2200,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [shine]);

  const translateX = shine.interpolate({ inputRange: [0, 1], outputRange: [-90, 170] });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading }}
      onPress={loading ? undefined : onPress}
      android_ripple={{ color: filled ? "rgba(11,11,10,0.18)" : accent + "22", borderless: false }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: accent,
          backgroundColor: filled ? accent : "transparent",
          opacity: pressed ? 0.88 : 1,
          transform: [{ scale: pressed ? 0.972 : 1 }, { translateY: pressed ? 2 : 0 }],
        },
        filled ? shadows.neon : null,
        style,
      ]}
    >
      {showShine ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.buttonShine,
            {
              backgroundColor: filled ? "rgba(255,255,255,0.22)" : accent + "24",
              transform: [{ translateX }, { rotate: "18deg" }],
            },
          ]}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator size="small" color={filled ? colors.background : accent} />
      ) : icon ? (
        <GlyphIcon glyph={icon} size={12} color={filled ? colors.background : accent} />
      ) : null}
      <Text style={[styles.buttonText, { color: filled ? colors.background : accent }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

type SectionTitleProps = {
  kicker: string;
  title: string;
  copy?: string;
  style?: StyleProp<ViewStyle>;
};

export function SectionTitle({ kicker, title, copy, style }: SectionTitleProps) {
  return (
    <View style={[styles.sectionTitle, style]}>
      <Text style={styles.kicker}>{"> " + kicker}</Text>
      <Text style={styles.heading}>{title}</Text>
      {copy ? <Text style={styles.copy}>{copy}</Text> : null}
    </View>
  );
}

type BadgeProps = {
  children: React.ReactNode;
  tone?: "green" | "magenta" | "cyan" | "warn";
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

export function Badge({ children, tone = "green", style, textStyle }: BadgeProps) {
  const color =
    tone === "magenta"
      ? colors.accentSecondary
      : tone === "cyan"
        ? colors.accentTertiary
        : tone === "warn"
          ? colors.warning
          : colors.accent;

  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: color + "14" }, style]}>
      <Text style={[styles.badgeText, { color }, textStyle]}>{children}</Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  panelOuter: {
    borderWidth: 1,
    backgroundColor: colors.card,
    overflow: "hidden",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 2,
  },
  panelInner: {
    padding: 13,
    position: "relative",
    flexGrow: 1,
  },
  panelSheen: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 1,
  },
  button: {
    minHeight: 38,
    borderWidth: 2,
    paddingHorizontal: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 2,
    overflow: "hidden",
  },
  buttonShine: {
    position: "absolute",
    top: -10,
    bottom: -10,
    width: 26,
  },
  buttonText: {
    fontFamily: typography.button,
    fontSize: 11,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  sectionTitle: {
    gap: 6,
  },
  kicker: {
    color: colors.accent,
    fontFamily: typography.button,
    fontSize: 11,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  heading: {
    color: colors.foreground,
    fontFamily: typography.heading,
    fontSize: 20,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  copy: {
    color: colors.mutedForeground,
    fontFamily: typography.body,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0,
  },
  badge: {
    borderWidth: 1,
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 1,
  },
  badgeText: {
    fontFamily: typography.button,
    fontSize: 9,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 11,
  },
});
