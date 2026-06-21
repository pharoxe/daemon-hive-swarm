import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme";
import type { VoiceOrbPhase } from "../runtime/voiceChatSession";

type VoiceOrbProps = {
  audioLevel?: number;
  initProgress?: number;
  phase?: VoiceOrbPhase;
  waveColor?: [number, number, number];
};

function rgb([r, g, b]: [number, number, number]) {
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

export default function VoiceOrb({
  audioLevel = 0,
  initProgress = 1,
  phase = "idle",
  waveColor = [0.76, 0.42, 0.23],
}: VoiceOrbProps) {
  const breathe = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const levelAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: phase === "initializing" ? 900 : 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: phase === "initializing" ? 900 : 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    breatheLoop.start();
    return () => breatheLoop.stop();
  }, [breathe, phase]);

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: phase === "processing" ? 4200 : 7600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinLoop.start();
    return () => spinLoop.stop();
  }, [phase, spin]);

  useEffect(() => {
    Animated.timing(levelAnim, {
      toValue: audioLevel,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [audioLevel, levelAnim]);

  useEffect(() => {
    if (phase !== "speaking" && phase !== "listening") return;
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [phase, pulse]);

  const coreScale =
    phase === "initializing"
      ? 0.55 + initProgress * 0.45
      : phase === "speaking"
        ? 1 + audioLevel * 0.14
        : 0.88 + audioLevel * 0.2;

  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const ringScale = levelAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const ringOpacity = levelAnim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.55] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const accent = rgb(waveColor);
  const accentSoft = rgb([waveColor[0] * 0.55, waveColor[1] * 0.55, waveColor[2] * 0.55]);

  return (
    <View style={styles.stage}>
      <Animated.View style={[styles.halo, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}>
        <LinearGradient
          colors={["rgba(194,106,58,0.05)", "rgba(194,106,58,0.28)", "rgba(194,106,58,0.04)"]}
          style={styles.haloFill}
        />
      </Animated.View>

      <Animated.View style={[styles.ringOrbit, { transform: [{ rotate: spinDeg }, { scale: pulseScale }] }]}>
        <View style={[styles.orbitRing, { borderColor: accentSoft }]} />
        <View style={[styles.orbitRing, styles.orbitRingInner, { borderColor: accent }]} />
      </Animated.View>

      <Animated.View style={{ transform: [{ scale: breatheScale }] }}>
        <View style={[styles.coreWrap, { transform: [{ scale: coreScale }] }]}>
          <LinearGradient
            colors={["#0a1424", accentSoft, accent, "#f0dcc8"]}
            locations={[0, 0.35, 0.72, 1]}
            start={{ x: 0.2, y: 0.05 }}
            end={{ x: 0.85, y: 0.95 }}
            style={styles.core}
          />
          <LinearGradient
            colors={["rgba(255,255,255,0.35)", "rgba(255,255,255,0)"]}
            start={{ x: 0.15, y: 0.1 }}
            end={{ x: 0.7, y: 0.75 }}
            style={styles.highlight}
          />
        </View>
      </Animated.View>

      {phase === "initializing" ? (
        <View style={styles.initOrbit} pointerEvents="none">
          <Animated.View style={[styles.initSweep, { transform: [{ rotate: spinDeg }] }]}>
            <View style={[styles.initSweepArm, { backgroundColor: accent }]} />
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

const ORB = 168;

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  halo: {
    position: "absolute",
    width: ORB * 1.55,
    height: ORB * 1.55,
    borderRadius: ORB,
  },
  haloFill: {
    flex: 1,
    borderRadius: ORB,
  },
  ringOrbit: {
    position: "absolute",
    width: ORB * 1.28,
    height: ORB * 1.28,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitRing: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: ORB,
    borderWidth: 1.5,
    opacity: 0.55,
  },
  orbitRingInner: {
    width: "78%",
    height: "78%",
    opacity: 0.75,
  },
  coreWrap: {
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
    overflow: "hidden",
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  core: {
    flex: 1,
    borderRadius: ORB / 2,
  },
  highlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ORB / 2,
  },
  initOrbit: {
    position: "absolute",
    width: ORB * 1.35,
    height: ORB * 1.35,
    alignItems: "center",
    justifyContent: "center",
  },
  initSweep: {
    width: "100%",
    height: "100%",
    alignItems: "center",
  },
  initSweepArm: {
    width: 3,
    height: "46%",
    borderRadius: 999,
    marginTop: 4,
    opacity: 0.85,
  },
});
