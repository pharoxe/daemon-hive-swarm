#!/usr/bin/env node
/**
 * QVAC 0.11 validates the llama.cpp completion addon logging module, but the
 * packaged plugin registry skips installing the native logger callback for that
 * namespace. That hides the C++ llama.cpp / Vulkan failure that the QVAC team
 * asks us to inspect via @qvac/llm-llamacpp/addonLogging.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(projectRoot, "node_modules", "@qvac", "sdk", "dist", "server", "plugins", "registry.js");
const addonLoggingPath = path.join(projectRoot, "node_modules", "@qvac", "sdk", "dist", "logging", "addon.js");

if (!fs.existsSync(registryPath)) {
  console.warn(`[Daemon] QVAC plugin registry not found, skipping native logging patch: ${registryPath}`);
  process.exit(0);
}

const source = fs.readFileSync(registryPath, "utf8");
const needle = `        if (plugin.logging.namespace !== "llamacpp-completion") {
            loggingModule.setLogger(createAddonLoggerCallback(plugin.logging.namespace));
        }
`;
const replacement = `        loggingModule.setLogger(createAddonLoggerCallback(plugin.logging.namespace));
`;

if (source.includes(replacement) && !source.includes(needle)) {
  console.log("[Daemon] QVAC llama.cpp native logging patch already applied");
} else if (!source.includes(needle)) {
  console.warn("[Daemon] QVAC plugin registry shape changed; native logging patch was not applied");
} else {
  fs.writeFileSync(registryPath, source.replace(needle, replacement));
  console.log("[Daemon] Patched QVAC llama.cpp native logging registration");
}

if (!fs.existsSync(addonLoggingPath)) {
  console.warn(`[Daemon] QVAC addon logging router not found, skipping console mirror patch: ${addonLoggingPath}`);
  process.exit(0);
}

const addonSource = fs.readFileSync(addonLoggingPath, "utf8");
const consoleNeedle = `        const level = PRIORITY_TO_LEVEL[priority] ?? "debug";
        for (const logger of loggers) {
            routeLog(logger, level, message);
        }
`;
const consoleReplacement = `        const level = PRIORITY_TO_LEVEL[priority] ?? "debug";
        const line = "[qvac-native:" + namespace + ":" + level + "] " + message;
        if (level === "error")
            console.error(line);
        else if (level === "warn")
            console.warn(line);
        else
            console.log(line);
        for (const logger of loggers) {
            routeLog(logger, level, message);
        }
`;

if (addonSource.includes(consoleReplacement)) {
  console.log("[Daemon] QVAC native logging console mirror already applied");
} else if (addonSource.includes(consoleNeedle)) {
  fs.writeFileSync(addonLoggingPath, addonSource.replace(consoleNeedle, consoleReplacement));
  console.log("[Daemon] Patched QVAC native logging console mirror");
} else {
  console.warn("[Daemon] QVAC addon logging router shape changed; console mirror patch was not applied");
}
