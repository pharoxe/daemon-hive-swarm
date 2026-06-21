import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(
  projectRoot,
  "node_modules",
  "@qvac",
  "sdk",
  "dist",
  "server",
  "bare",
  "registry",
  "config-registry.js",
);

const marker = "httpConnectionTimeoutMs: undefined";

function patch() {
  if (!fs.existsSync(registryPath)) {
    console.warn("[patchQvacHttpTimeoutRegistry] Missing file (skip):", registryPath);
    return;
  }
  let src = fs.readFileSync(registryPath, "utf8");
  if (src.includes(marker)) {
    return;
  }

  const registryInsert = `    httpDownloadConcurrency: undefined,
    httpConnectionTimeoutMs: undefined,
    deviceDefaults: undefined,`;

  if (!src.includes("    httpDownloadConcurrency: undefined,\n    deviceDefaults: undefined,")) {
    console.warn("[patchQvacHttpTimeoutRegistry] Unexpected configRegistry shape; skip.");
    return;
  }
  src = src.replace(
    "    httpDownloadConcurrency: undefined,\n    deviceDefaults: undefined,",
    registryInsert,
  );

  const setBlock = [
    "    if (config.deviceDefaults !== undefined && config.deviceDefaults !== null) {",
    "        configRegistry.deviceDefaults = config.deviceDefaults;",
    "        logger.info(`✅ Device defaults configured: ${config.deviceDefaults.length} pattern(s)`);",
    "    }",
    "    // Mark config as set - now it's immutable",
  ].join("\n");

  const setReplacement = [
    "    if (config.deviceDefaults !== undefined && config.deviceDefaults !== null) {",
    "        configRegistry.deviceDefaults = config.deviceDefaults;",
    "        logger.info(`✅ Device defaults configured: ${config.deviceDefaults.length} pattern(s)`);",
    "    }",
    "    if (config.httpConnectionTimeoutMs !== undefined && config.httpConnectionTimeoutMs !== null) {",
    "        configRegistry.httpConnectionTimeoutMs = config.httpConnectionTimeoutMs;",
    "        logger.info(`HTTP connection timeout set to: ${config.httpConnectionTimeoutMs}ms`);",
    "    }",
    "    // Mark config as set - now it's immutable",
  ].join("\n");

  if (!src.includes(setBlock)) {
    console.warn("[patchQvacHttpTimeoutRegistry] Unexpected setSDKConfig tail; skip.");
    return;
  }
  src = src.replace(setBlock, setReplacement);

  fs.writeFileSync(registryPath, src, "utf8");
  console.log("[patchQvacHttpTimeoutRegistry] Patched", registryPath);
}

patch();
