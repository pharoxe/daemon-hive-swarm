import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, typography } from "../theme";

type InferenceDotMatrixProps = {
  size?: number;
  style?: ViewStyle;
};

export function InferenceDotMatrix({ size = 18, style }: InferenceDotMatrixProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const cellSize = Math.max(4, Math.round(size / 3) - 2);
  const gap = 2;
  const gridSize = cellSize * 3 + gap * 2;
  const cells = [0, 1, 2, 5, 8, 7, 6, 3, 4];

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
    <View style={[styles.frame, { width: size, height: size }, style]}>
      <View style={[styles.grid, { width: gridSize, height: gridSize }]}>
        {cells.map((order, index) => {
          const start = index / cells.length;
          const peak = Math.min(1, start + 0.22);
          const opacity = pulse.interpolate({
            inputRange: [0, start, peak, 1],
            outputRange: [0.24, 0.24, 1, 0.42],
            extrapolate: "clamp",
          });
          const scale = pulse.interpolate({
            inputRange: [0, start, peak, 1],
            outputRange: [0.84, 0.84, 1.14, 0.92],
            extrapolate: "clamp",
          });
          return (
            <Animated.View
              key={`${order}-${index}`}
              style={[
                styles.cell,
                {
                  width: cellSize,
                  height: cellSize,
                  left: (order % 3) * (cellSize + gap),
                  top: Math.floor(order / 3) * (cellSize + gap),
                  opacity,
                  transform: [{ scale }],
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

export function WaitingIndicator({
  label,
  size = 18,
  style,
}: {
  label?: string;
  size?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.waitRow, style]}>
      <InferenceDotMatrix size={size} />
      {label ? <Text style={styles.waitLabel}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  grid: {
    position: "relative",
  },
  cell: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  waitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  waitLabel: {
    color: colors.mutedForeground,
    fontFamily: typography.body,
    fontSize: 11,
    letterSpacing: 0.4,
  },
});
