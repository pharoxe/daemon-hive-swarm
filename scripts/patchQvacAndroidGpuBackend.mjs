#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VULKAN_LIB = "libqvac-ggml-vulkan.so";
const OPENCL_LIB = "libqvac-ggml-opencl.so";
const VULKAN_DISABLED_SUFFIX = ".disabled-opencl";
const OPENCL_DISABLED_SUFFIX = ".disabled-vulkan";

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function mergedEnv() {
  return {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, ".env.local")),
    ...process.env,
  };
}

function walkDir(dir, matches = []) {
  if (!fs.existsSync(dir)) return matches;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, matches);
    else matches.push(full);
  }
  return matches;
}

function backendFromEnv() {
  const env = mergedEnv();
  return String(env.EXPO_PUBLIC_DAEMON_ANDROID_GPU_BACKEND || "auto").trim().toLowerCase();
}

function gpuLibRoots() {
  return [
    path.join(root, "node_modules", "@qvac", "llm-llamacpp", "prebuilds"),
    path.join(root, "node_modules", "@qvac", "embed-llamacpp", "prebuilds"),
    path.join(root, "node_modules", "react-native-bare-kit", "android"),
  ];
}

/** Resolve canonical active-path slots for a GPU backend library. */
function collectLibSlots(libBaseName, disabledSuffix) {
  const slots = new Set();
  for (const base of gpuLibRoots()) {
    for (const file of walkDir(base)) {
      const name = path.basename(file);
      if (name === libBaseName) {
        slots.add(file);
      } else if (name === `${libBaseName}${disabledSuffix}`) {
        slots.add(path.join(path.dirname(file), libBaseName));
      }
    }
  }
  return Array.from(slots);
}

function setLibEnabled(activePath, disabledSuffix, enabled) {
  const disabledPath = `${activePath}${disabledSuffix}`;
  if (enabled) {
    if (fs.existsSync(disabledPath)) {
      fs.renameSync(disabledPath, activePath);
      return "restored";
    }
    if (fs.existsSync(activePath)) return "already-enabled";
    return "missing";
  }
  if (fs.existsSync(activePath)) {
    fs.renameSync(activePath, disabledPath);
    return "disabled";
  }
  if (fs.existsSync(disabledPath)) return "already-disabled";
  return "missing";
}

const backend = backendFromEnv();
if (!["opencl", "vulkan", "auto"].includes(backend)) {
  console.warn(
    `[patchQvacAndroidGpuBackend] Unknown EXPO_PUBLIC_DAEMON_ANDROID_GPU_BACKEND=${backend}; leaving QVAC GPU backends unchanged.`,
  );
  process.exit(0);
}

const vulkanSlots = collectLibSlots(VULKAN_LIB, VULKAN_DISABLED_SUFFIX);
const openclSlots = collectLibSlots(OPENCL_LIB, OPENCL_DISABLED_SUFFIX);

let vulkanChanged = 0;
let openclChanged = 0;

const enableVulkan = backend === "auto" || backend === "vulkan";
const enableOpenCl = backend === "auto" || backend === "opencl";

for (const slot of vulkanSlots) {
  const result = setLibEnabled(slot, VULKAN_DISABLED_SUFFIX, enableVulkan);
  if (result === "restored" || result === "disabled") vulkanChanged += 1;
}

for (const slot of openclSlots) {
  const result = setLibEnabled(slot, OPENCL_DISABLED_SUFFIX, enableOpenCl);
  if (result === "restored" || result === "disabled") openclChanged += 1;
}

const activeVulkan = vulkanSlots.filter((slot) => fs.existsSync(slot)).length;
const activeOpenCl = openclSlots.filter((slot) => fs.existsSync(slot)).length;

console.log(
  `[patchQvacAndroidGpuBackend] backend=${backend} vulkan=${activeVulkan}/${vulkanSlots.length} opencl=${activeOpenCl}/${openclSlots.length} (changed vulkan=${vulkanChanged} opencl=${openclChanged})`,
);

if (backend === "vulkan" && activeVulkan === 0) {
  console.warn("[patchQvacAndroidGpuBackend] No active Vulkan libs — run npm install @qvac/llm-llamacpp or set QVAC_NATIVE_PREBUILD_PATH.");
  process.exit(1);
}
