export const colors = {
  background: "#0b0b0a",
  foreground: "#e7e0d4",
  card: "#151311",
  muted: "#211d1a",
  mutedForeground: "#9d9287",
  accent: "#c26a3a",
  accentSecondary: "#8f3f24",
  accentTertiary: "#c6b19b",
  border: "#3a322c",
  input: "#151311",
  destructive: "#b54835",
  warning: "#d79b55",
  /** Online / cloud-positive accent for toggles */
  onlineGreen: "#8ef0b8",
  onlineGreenMuted: "rgba(142,240,184,0.22)",
};

export const shadows = {
  neon: {
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  magenta: {
    shadowColor: colors.accentSecondary,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  cyan: {
    shadowColor: colors.accentTertiary,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
};

export const typography = {
  mono: "ProtoMono-Regular",
  body: "Jura-Medium",
  button: "Jura-DemiBold",
  heading: "ProtoMono-SemiBold",
};
