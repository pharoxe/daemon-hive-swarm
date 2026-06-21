import { File, Paths } from "expo-file-system";
import { env } from "../config/env";

/** Merged into the on-device worker config (see repo root `qvac.config.json` for defaults). */
const QVAC_LOGGER_CONSOLE = true;
const QVAC_LOGGER_LEVEL = "debug";

let ensurePromise: Promise<void> | null = null;

/**
 * QVAC's HTTP model fetch wraps `fetch()` in a short default timeout (10s) unless
 * `httpConnectionTimeoutMs` is set in worker config. The published SDK omits this field
 * from the config registry until patched (see scripts/patchQvacHttpTimeoutRegistry.mjs).
 *
 * Writes `${Paths.document.uri}qvac.config.json` before the worker initializes so
 * large HF downloads (e.g. 0.8B GGUF) can complete on slow links.
 */
export function ensureQvacSdkConfigFile(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = writeMergedQvacConfig();
  }
  return ensurePromise;
}

async function writeMergedQvacConfig() {
  try {
    const configFile = new File(Paths.document, "qvac.config.json");
    const timeoutMs = env.qvacHttpConnectionTimeoutMs;
    let base: Record<string, unknown> = {};
    if (configFile.exists) {
      try {
        const raw = await configFile.text();
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          base = parsed as Record<string, unknown>;
        }
      } catch {
        // Corrupt JSON: replace with minimal config below.
      }
    }
    const merged = {
      ...base,
      httpConnectionTimeoutMs: timeoutMs,
      loggerConsoleOutput: QVAC_LOGGER_CONSOLE,
      loggerLevel: QVAC_LOGGER_LEVEL,
    };
    const body = `${JSON.stringify(merged, null, 2)}\n`;
    if (!configFile.exists) {
      configFile.create();
    }
    configFile.write(body);
  } catch (error) {
    console.warn("[DaemonQvac] ensureQvacSdkConfigFile failed", error);
  }
}
