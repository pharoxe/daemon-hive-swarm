import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CyberButton } from "../components";
import { colors, typography } from "../theme";
import { GlyphIcon } from "../icons";

export type DaemonDialogButton = {
  text: string;
  style?: "cancel" | "destructive" | "default";
  onPress?: () => void;
};

export type DaemonDialogConfig = {
  title: string;
  message: string;
  buttons: DaemonDialogButton[];
};

type DaemonDialogProps = {
  config: DaemonDialogConfig | null;
  onDismiss: () => void;
};

export function DaemonDialog({ config, onDismiss }: DaemonDialogProps) {
  if (!config) return null;

  const handlePress = (button: DaemonDialogButton) => {
    onDismiss();
    button.onPress?.();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.iconBox}>
              <GlyphIcon glyph="FS" size={14} color={colors.accent} />
            </View>
            <View style={styles.titleBlock}>
              <Text style={styles.kicker}>DAEMON PROMPT</Text>
              <Text style={styles.title}>{config.title}</Text>
            </View>
          </View>
          <Text style={styles.message}>{config.message}</Text>
          <View style={styles.actions}>
            {config.buttons.map((button, index) => (
              <CyberButton
                key={`${button.text}-${index}`}
                label={button.text}
                variant={button.style === "destructive" ? "secondary" : button.style === "cancel" ? "outline" : "secondary"}
                onPress={() => handlePress(button)}
                style={styles.actionBtn}
              />
            ))}
          </View>
          <Pressable onPress={onDismiss} style={styles.dismissHit} accessibilityRole="button" accessibilityLabel="Dismiss" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(81,222,192,0.08)",
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    color: colors.accentTertiary,
    fontFamily: typography.mono,
    fontSize: 10,
    letterSpacing: 1.1,
  },
  title: {
    color: colors.foreground,
    fontFamily: typography.heading,
    fontSize: 18,
  },
  message: {
    color: colors.mutedForeground,
    fontFamily: typography.body,
    fontSize: 13,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    minWidth: 100,
  },
  dismissHit: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
