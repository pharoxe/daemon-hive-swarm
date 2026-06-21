import React from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, typography } from "./theme";

export type IconGlyph = string;

type GlyphIconProps = {
  glyph: IconGlyph;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

type LineProps = {
  color: string;
  style: StyleProp<ViewStyle>;
};

function Line({ color, style }: LineProps) {
  return <View style={[styles.line, { backgroundColor: color }, style]} />;
}

function Dot({ color, style }: LineProps) {
  return <View style={[styles.dot, { backgroundColor: color }, style]} />;
}

function Ring({ color, style }: LineProps) {
  return <View style={[styles.ring, { borderColor: color }, style]} />;
}

function renderIcon(glyph: string, color: string) {
  switch (glyph.toUpperCase()) {
    case "HOME":
    case "AG":
      return (
        <>
          <Line color={color} style={styles.homeRoofLeft} />
          <Line color={color} style={styles.homeRoofRight} />
          <View style={[styles.homeBody, { borderColor: color }]} />
        </>
      );
    case "CH":
    case "MSG":
    case "IM":
      return (
        <>
          <View style={[styles.chatBox, { borderColor: color }]} />
          <Line color={color} style={styles.chatTail} />
        </>
      );
    case "CPU":
    case "AI":
      return (
        <>
          <View style={[styles.cpuCore, { borderColor: color }]} />
          <Line color={color} style={styles.cpuPinTopA} />
          <Line color={color} style={styles.cpuPinTopB} />
          <Line color={color} style={styles.cpuPinBottomA} />
          <Line color={color} style={styles.cpuPinBottomB} />
          <Line color={color} style={styles.cpuPinLeft} />
          <Line color={color} style={styles.cpuPinRight} />
        </>
      );
    case "BOX":
    case "TLS":
      return (
        <>
          <View style={[styles.gridCell, styles.gridOne, { borderColor: color }]} />
          <View style={[styles.gridCell, styles.gridTwo, { borderColor: color }]} />
          <View style={[styles.gridCell, styles.gridThree, { borderColor: color }]} />
          <View style={[styles.gridCell, styles.gridFour, { borderColor: color }]} />
        </>
      );
    case "ANT":
      return (
        <>
          <Line color={color} style={styles.antennaStem} />
          <Line color={color} style={styles.antennaLeft} />
          <Line color={color} style={styles.antennaRight} />
          <Dot color={color} style={styles.antennaDot} />
        </>
      );
    case "NET":
      return (
        <>
          <Ring color={color} style={styles.netOuter} />
          <Line color={color} style={styles.netHorizontal} />
          <Line color={color} style={styles.netVertical} />
        </>
      );
    case "PWR":
      return (
        <>
          <Ring color={color} style={styles.powerRing} />
          <Line color={color} style={styles.powerLine} />
        </>
      );
    case "DL":
      return (
        <>
          <Line color={color} style={styles.downloadStem} />
          <Line color={color} style={styles.downloadLeft} />
          <Line color={color} style={styles.downloadRight} />
          <Line color={color} style={styles.downloadBase} />
        </>
      );
    case "DRV":
      return (
        <>
          <View style={[styles.driveTop, { borderColor: color }]} />
          <Line color={color} style={styles.driveMid} />
          <Line color={color} style={styles.driveBase} />
        </>
      );
    case "SET":
      return (
        <>
          <Ring color={color} style={styles.setRing} />
          <Line color={color} style={styles.setLineA} />
          <Line color={color} style={styles.setLineB} />
        </>
      );
    case "OK":
      return (
        <>
          <Line color={color} style={styles.checkShort} />
          <Line color={color} style={styles.checkLong} />
        </>
      );
    case "ERR":
      return (
        <>
          <Line color={color} style={styles.xOne} />
          <Line color={color} style={styles.xTwo} />
        </>
      );
    case "RUN":
      return (
        <>
          <Ring color={color} style={styles.runRing} />
          <Line color={color} style={styles.runArrow} />
          <Line color={color} style={styles.runArrowTip} />
        </>
      );
    case ">":
    case "GO":
      return (
        <>
          <Line color={color} style={styles.arrowTop} />
          <Line color={color} style={styles.arrowBottom} />
        </>
      );
    case "LOCK":
    case "SEC":
      return (
        <>
          <View style={[styles.lockBody, { borderColor: color }]} />
          <View style={[styles.lockShackle, { borderColor: color }]} />
        </>
      );
    case "PH":
      return <View style={[styles.phone, { borderColor: color }]} />;
    case "MIC":
      return (
        <>
          <View style={[styles.micHead, { borderColor: color }]} />
          <Line color={color} style={styles.micStand} />
          <Line color={color} style={styles.micBase} />
        </>
      );
    case "KEY":
      return (
        <>
          <Ring color={color} style={styles.keyRing} />
          <Line color={color} style={styles.keyStem} />
          <Line color={color} style={styles.keyTooth} />
        </>
      );
    case "FS":
      return (
        <>
          <View style={[styles.folderBack, { borderColor: color }]} />
          <Line color={color} style={styles.folderTab} />
        </>
      );
    case "CAL":
      return (
        <>
          <View style={[styles.calendar, { borderColor: color }]} />
          <Line color={color} style={styles.calendarLine} />
        </>
      );
    case "MEM":
      return (
        <>
          <Line color={color} style={styles.memOne} />
          <Line color={color} style={styles.memTwo} />
          <Line color={color} style={styles.memThree} />
        </>
      );
    case "WALLET":
    case "WLT":
      return (
        <>
          <View style={[styles.walletBack, { borderColor: color }]} />
          <View style={[styles.walletFront, { borderColor: color }]} />
        </>
      );
    case "X":
    case "CLOSE":
      return (
        <>
          <Line color={color} style={styles.xOne} />
          <Line color={color} style={styles.xTwo} />
        </>
      );
    case "+":
    case "ADD":
      return (
        <>
          <Line color={color} style={styles.plusVertical} />
          <Line color={color} style={styles.plusHorizontal} />
        </>
      );
    case "<":
    case "BACK":
      return <Line color={color} style={styles.chevronLeft} />;
    case ">":
      return <Line color={color} style={styles.chevronRight} />;
    case "^":
    case "UP":
      return <Line color={color} style={styles.chevronUp} />;
    case "V":
    case "DOWN":
      return <Line color={color} style={styles.chevronDown} />;
    case "QV":
      return (
        <>
          <View style={[styles.qvBox, { borderColor: color }]} />
          <Line color={color} style={styles.qvSlash} />
        </>
      );
    default:
      return (
        <Text
          style={[
            styles.fallback,
            {
              color,
              fontSize: Math.max(8, glyph.length > 2 ? 9 : 11),
              lineHeight: 14,
            },
          ]}
          numberOfLines={1}
        >
          {glyph}
        </Text>
      );
  }
}

export function GlyphIcon({ glyph, color = colors.mutedForeground, size = 14, style }: GlyphIconProps) {
  const box = Math.max(18, size + 8);

  return (
    <View style={[styles.canvas, { width: box, height: box }, style]}>
      <View style={[styles.scale, { transform: [{ scale: box / 24 }] }]}>{renderIcon(glyph, color)}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    alignItems: "center",
    justifyContent: "center",
  },
  scale: {
    width: 24,
    height: 24,
  },
  line: {
    position: "absolute",
    height: 2,
    borderRadius: 2,
  },
  dot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 4,
  },
  ring: {
    position: "absolute",
    borderWidth: 2,
  },
  fallback: {
    fontFamily: typography.button,
    letterSpacing: 0,
    position: "absolute",
    textAlign: "center",
    textTransform: "uppercase",
    top: 5,
    width: 24,
  },
  homeRoofLeft: {
    left: 5,
    top: 8,
    width: 10,
    transform: [{ rotate: "-38deg" }],
  },
  homeRoofRight: {
    right: 5,
    top: 8,
    width: 10,
    transform: [{ rotate: "38deg" }],
  },
  homeBody: {
    position: "absolute",
    left: 7,
    top: 11,
    width: 10,
    height: 8,
    borderWidth: 2,
    borderTopWidth: 0,
  },
  chatBox: {
    position: "absolute",
    left: 4,
    top: 6,
    width: 16,
    height: 11,
    borderWidth: 2,
    borderRadius: 3,
  },
  chatTail: {
    left: 8,
    top: 16,
    width: 7,
    transform: [{ rotate: "-35deg" }],
  },
  cpuCore: {
    position: "absolute",
    left: 7,
    top: 7,
    width: 10,
    height: 10,
    borderWidth: 2,
  },
  cpuPinTopA: { left: 8, top: 3, width: 2, height: 4 },
  cpuPinTopB: { left: 14, top: 3, width: 2, height: 4 },
  cpuPinBottomA: { left: 8, top: 17, width: 2, height: 4 },
  cpuPinBottomB: { left: 14, top: 17, width: 2, height: 4 },
  cpuPinLeft: { left: 3, top: 11, width: 4 },
  cpuPinRight: { right: 3, top: 11, width: 4 },
  gridCell: {
    position: "absolute",
    width: 7,
    height: 7,
    borderWidth: 2,
  },
  gridOne: { left: 4, top: 4 },
  gridTwo: { right: 4, top: 4 },
  gridThree: { left: 4, bottom: 4 },
  gridFour: { right: 4, bottom: 4 },
  antennaStem: { left: 11, top: 9, width: 2, height: 10 },
  antennaLeft: { left: 5, top: 8, width: 9, transform: [{ rotate: "-38deg" }] },
  antennaRight: { right: 5, top: 8, width: 9, transform: [{ rotate: "38deg" }] },
  antennaDot: { left: 10, top: 5 },
  netOuter: { left: 4, top: 4, width: 16, height: 16, borderRadius: 16 },
  netHorizontal: { left: 5, top: 11, width: 14 },
  netVertical: { left: 11, top: 5, width: 2, height: 14 },
  powerRing: { left: 5, top: 6, width: 14, height: 14, borderRadius: 14 },
  powerLine: { left: 11, top: 3, width: 2, height: 9 },
  downloadStem: { left: 11, top: 4, width: 2, height: 11 },
  downloadLeft: { left: 7, top: 12, width: 7, transform: [{ rotate: "45deg" }] },
  downloadRight: { right: 7, top: 12, width: 7, transform: [{ rotate: "-45deg" }] },
  downloadBase: { left: 6, top: 19, width: 12 },
  driveTop: {
    position: "absolute",
    left: 5,
    top: 5,
    width: 14,
    height: 7,
    borderWidth: 2,
    borderRadius: 7,
  },
  driveMid: { left: 5, top: 12, width: 14 },
  driveBase: { left: 5, top: 17, width: 14 },
  setRing: { left: 7, top: 7, width: 10, height: 10, borderRadius: 10 },
  setLineA: { left: 3, top: 11, width: 18 },
  setLineB: { left: 11, top: 3, width: 2, height: 18 },
  checkShort: { left: 5, top: 13, width: 7, transform: [{ rotate: "42deg" }] },
  checkLong: { left: 10, top: 11, width: 12, transform: [{ rotate: "-48deg" }] },
  xOne: { left: 5, top: 11, width: 14, transform: [{ rotate: "45deg" }] },
  xTwo: { left: 5, top: 11, width: 14, transform: [{ rotate: "-45deg" }] },
  runRing: { left: 5, top: 5, width: 14, height: 14, borderRadius: 14 },
  runArrow: { right: 3, top: 6, width: 8, transform: [{ rotate: "-35deg" }] },
  runArrowTip: { right: 4, top: 5, width: 5, transform: [{ rotate: "55deg" }] },
  arrowTop: { left: 7, top: 8, width: 11, transform: [{ rotate: "38deg" }] },
  arrowBottom: { left: 7, top: 15, width: 11, transform: [{ rotate: "-38deg" }] },
  lockBody: {
    position: "absolute",
    left: 6,
    top: 10,
    width: 12,
    height: 10,
    borderWidth: 2,
    borderRadius: 2,
  },
  lockShackle: {
    position: "absolute",
    left: 8,
    top: 4,
    width: 8,
    height: 9,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  phone: {
    position: "absolute",
    left: 7,
    top: 4,
    width: 10,
    height: 16,
    borderWidth: 2,
    borderRadius: 3,
  },
  micHead: {
    position: "absolute",
    left: 8,
    top: 4,
    width: 8,
    height: 12,
    borderWidth: 2,
    borderRadius: 6,
  },
  micStand: { left: 11, top: 16, width: 2, height: 4 },
  micBase: { left: 7, top: 20, width: 10 },
  keyRing: { left: 4, top: 7, width: 8, height: 8, borderRadius: 8 },
  keyStem: { left: 11, top: 11, width: 9 },
  keyTooth: { left: 17, top: 12, width: 2, height: 5 },
  folderBack: {
    position: "absolute",
    left: 4,
    top: 8,
    width: 16,
    height: 11,
    borderWidth: 2,
    borderRadius: 2,
  },
  folderTab: { left: 5, top: 6, width: 8 },
  calendar: {
    position: "absolute",
    left: 5,
    top: 5,
    width: 14,
    height: 15,
    borderWidth: 2,
    borderRadius: 2,
  },
  calendarLine: { left: 5, top: 10, width: 14 },
  memOne: { left: 5, top: 7, width: 14 },
  memTwo: { left: 5, top: 12, width: 14 },
  memThree: { left: 5, top: 17, width: 14 },
  walletBack: {
    position: "absolute",
    left: 5,
    top: 11,
    width: 14,
    height: 9,
    borderWidth: 2,
    borderRadius: 2,
  },
  walletFront: {
    position: "absolute",
    left: 6,
    top: 5,
    width: 12,
    height: 8,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  plusVertical: { left: 11, top: 5, width: 2, height: 14 },
  plusHorizontal: { left: 5, top: 11, width: 14 },
  chevronLeft: { left: 6, top: 11, width: 10, transform: [{ rotate: "38deg" }] },
  chevronRight: { right: 6, top: 11, width: 10, transform: [{ rotate: "-38deg" }] },
  chevronUp: { left: 11, top: 6, width: 2, height: 12 },
  chevronDown: { left: 11, top: 6, width: 2, height: 12, transform: [{ rotate: "180deg" }] },
  qvBox: {
    position: "absolute",
    left: 5,
    top: 5,
    width: 14,
    height: 14,
    borderWidth: 2,
    borderRadius: 2,
  },
  qvSlash: { left: 7, top: 10, width: 10, transform: [{ rotate: "-35deg" }] },
});
