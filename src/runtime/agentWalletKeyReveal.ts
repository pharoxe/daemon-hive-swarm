import { confirmDaemonDialog, showDaemonDialog } from "../components/daemonDialogHost";

async function doubleConfirmReveal(): Promise<boolean> {
  const first = await confirmDaemonDialog(
    "Reveal private key",
    "Biometric unlock is not available in this build (stub module). Only continue if you are alone and your screen is private.",
    "Continue",
    true,
  );
  if (!first) return false;
  return confirmDaemonDialog(
    "Final confirmation",
    "This shows your full 64-byte Solana secret. Never share it or store it in cloud photos.",
    "Reveal",
    true,
  );
}

export async function authorizeAgentKeyReveal(): Promise<boolean> {
  let LocalAuthentication: typeof import("expo-local-authentication");
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    LocalAuthentication = require("expo-local-authentication");
  } catch {
    return doubleConfirmReveal();
  }

  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!compatible || !enrolled) {
      showDaemonDialog(
        "Device lock required",
        "Add a screen lock, fingerprint, or face unlock on this device before viewing the private key.",
      );
      return false;
    }
    const auth = await LocalAuthentication.authenticateAsync({
      promptMessage: "Confirm it is you to reveal the agent wallet private key",
      cancelLabel: "Cancel",
    });
    return auth.success;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("expo-local-authentication-stub")) {
      return doubleConfirmReveal();
    }
    console.warn("[agentWalletKeyReveal] local auth failed", error);
    return doubleConfirmReveal();
  }
}
