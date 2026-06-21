import type { DaemonDialogButton, DaemonDialogConfig } from "./DaemonDialog";

type DialogHandler = (config: DaemonDialogConfig) => void;

let handler: DialogHandler | null = null;

export function registerDaemonDialogHandler(next: DialogHandler | null) {
  handler = next;
}

export function showDaemonDialog(title: string, message: string, buttons?: DaemonDialogButton[]) {
  handler?.({
    title,
    message,
    buttons: buttons?.length ? buttons : [{ text: "OK", style: "default" }],
  });
}

export function confirmDaemonDialog(
  title: string,
  message: string,
  confirmLabel = "Confirm",
  destructive = false,
): Promise<boolean> {
  return new Promise((resolve) => {
    showDaemonDialog(title, message, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}
