import * as Device from "expo-device";
import * as FileSystem from "expo-file-system/legacy";

const AUDIT_DIR = `${FileSystem.documentDirectory}daemon-audit`;
const AUDIT_FILE = `${AUDIT_DIR}/inference.jsonl`;

export type InferenceAuditEvent =
  | {
      event: "model_load";
      modelId: string;
      modelTitle: string;
      source: string;
      loadPath?: string;
      wallMs?: number;
      qvacModelInstanceId?: string;
      detail?: string;
    }
  | {
      event: "model_unload";
      modelId: string;
      modelTitle: string;
      source: string;
      qvacModelInstanceId?: string;
      detail?: string;
    }
  | {
      event: "inference";
      modelId: string;
      modelTitle: string;
      source: string;
      loadPath?: string;
      wallMs?: number;
      qvacModelInstanceId?: string;
      promptSystem?: string;
      promptUser?: string;
      promptTokens?: number;
      generatedTokens?: number;
      ttftMs?: number;
      tokensPerSec?: number;
      decodeBackend?: string;
      mode?: string;
      detail?: string;
    };

function deviceSnapshot() {
  const ramGb =
    typeof Device.totalMemory === "number" && Device.totalMemory > 0
      ? Math.round(Device.totalMemory / 1024 / 1024 / 1024)
      : undefined;
  return {
    brand: Device.brand ?? "unknown",
    model: Device.modelName ?? Device.deviceName ?? "unknown",
    soc: Device.osName ? `${Device.manufacturer ?? ""} ${Device.modelName ?? ""}`.trim() : "unknown",
    ramGb,
  };
}

function truncate(value: string | undefined, max = 512) {
  if (!value) return value;
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

export async function appendInferenceAudit(entry: InferenceAuditEvent) {
  const payload = {
    ts: new Date().toISOString(),
    device: deviceSnapshot(),
    ...entry,
    ...(entry.event === "inference"
      ? {
          promptSystem: truncate(entry.promptSystem),
          promptUser: truncate(entry.promptUser),
        }
      : {}),
  };
  const line = JSON.stringify(payload);
  console.log("[DaemonAudit]", line);
  try {
    const dirInfo = await FileSystem.getInfoAsync(AUDIT_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(AUDIT_DIR, { intermediates: true });
    }
    const fileInfo = await FileSystem.getInfoAsync(AUDIT_FILE);
    const previous = fileInfo.exists ? await FileSystem.readAsStringAsync(AUDIT_FILE) : "";
    await FileSystem.writeAsStringAsync(AUDIT_FILE, previous ? `${previous.trimEnd()}\n${line}\n` : `${line}\n`);
  } catch (error) {
    console.warn("[DaemonAudit] write:ignored", error instanceof Error ? error.message : String(error));
  }
}
