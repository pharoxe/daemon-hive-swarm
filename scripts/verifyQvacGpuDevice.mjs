#!/usr/bin/env node
/**
 * Verify QVAC Android GPU packaging matches the connected device profile.
 *
 * Usage: node scripts/verifyQvacGpuDevice.mjs
 */
import { execSync } from "node:child_process";
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

function adb(args) {
  try {
    return execSync(`adb ${args}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const stderr = error?.stderr?.toString?.() || "";
    throw new Error(stderr || error.message);
  }
}

function walkFiles(dir, matches = []) {
  if (!fs.existsSync(dir)) return matches;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, matches);
    else matches.push(full);
  }
  return matches;
}

function collectLibSlots(libBaseName, disabledSuffix) {
  const slots = new Set();
  const roots = [
    path.join(root, "node_modules", "@qvac", "llm-llamacpp", "prebuilds"),
    path.join(root, "node_modules", "@qvac", "embed-llamacpp", "prebuilds"),
  ];
  for (const base of roots) {
    for (const file of walkFiles(base)) {
      const name = path.basename(file);
      if (name === libBaseName) slots.add(file);
      else if (name === `${libBaseName}${disabledSuffix}`) slots.add(path.join(path.dirname(file), libBaseName));
    }
  }
  return Array.from(slots);
}

function classifyDeviceProps(vulkanHw, eglHw, socModel) {
  const blob = `${vulkanHw} ${eglHw} ${socModel}`.toLowerCase();
  if (/qualcomm|adreno|\bsm[0-9]{4}\b/.test(blob)) return "adreno_opencl";
  if (/mali|mediatek|\bmt[0-9]{4}\b/.test(blob)) return "mali_vulkan";
  return "cpu_safe";
}

const env = mergedEnv();
const backend = String(env.EXPO_PUBLIC_DAEMON_ANDROID_GPU_BACKEND || "auto").toLowerCase();
const fabricGpu = env.EXPO_PUBLIC_DAEMON_FABRIC_GPU === "1";
const fabricLlm = env.EXPO_PUBLIC_DAEMON_FABRIC_LLM !== "0";

const checks = [];

function pass(label, detail) {
  checks.push({ ok: true, label, detail });
}

function fail(label, detail) {
  checks.push({ ok: false, label, detail });
}

if (["auto", "opencl", "vulkan"].includes(backend)) pass("Env backend", `EXPO_PUBLIC_DAEMON_ANDROID_GPU_BACKEND=${backend}`);
else fail("Env backend", `Unknown backend ${backend}`);

if (fabricLlm) pass("Fabric LLM", "EXPO_PUBLIC_DAEMON_FABRIC_LLM enabled");
else fail("Fabric LLM", "EXPO_PUBLIC_DAEMON_FABRIC_LLM=0 disables GPU llama.cpp path");

const vulkanSlots = collectLibSlots(VULKAN_LIB, VULKAN_DISABLED_SUFFIX);
const openclSlots = collectLibSlots(OPENCL_LIB, OPENCL_DISABLED_SUFFIX);
const activeVulkan = vulkanSlots.filter((file) => fs.existsSync(file));
const activeOpenCl = openclSlots.filter((file) => fs.existsSync(file));
const disabledVulkan = vulkanSlots.filter((file) => fs.existsSync(`${file}${VULKAN_DISABLED_SUFFIX}`));

if (backend === "opencl" && activeVulkan.length === 0) {
  pass("Node Vulkan packaging", `OpenCL-only: ${disabledVulkan.length} Vulkan file(s) disabled`);
} else if ((backend === "auto" || backend === "vulkan") && activeVulkan.length > 0) {
  pass("Node Vulkan packaging", `${backend}: ${activeVulkan.length} active Vulkan prebuild(s)`);
} else {
  fail("Node Vulkan packaging", `backend=${backend} activeVulkan=${activeVulkan.length} disabled=${disabledVulkan.length}`);
}

if (backend === "vulkan" && activeOpenCl.length === 0) {
  pass("Node OpenCL packaging", "Vulkan-only: OpenCL disabled in prebuilds");
} else if (activeOpenCl.length > 0) {
  pass("Node OpenCL packaging", `${activeOpenCl.length} active OpenCL prebuild(s)`);
} else if (backend === "opencl" && activeOpenCl.length > 0) {
  pass("Node OpenCL packaging", `${activeOpenCl.length} active OpenCL prebuild(s)`);
} else {
  fail("Node OpenCL packaging", `backend=${backend} activeOpenCl=${activeOpenCl.length}`);
}

const gradlePath = path.join(root, "android", "app", "build.gradle");
if (fs.existsSync(gradlePath)) {
  const gradle = fs.readFileSync(gradlePath, "utf8");
  const excludesVulkan = gradle.includes('excludes += "**/libqvac-ggml-vulkan.so"');
  const excludesOpenCl = gradle.includes('excludes += "**/libqvac-ggml-opencl.so"');
  if (backend === "opencl" && excludesVulkan) pass("Gradle packaging", "OpenCL-only APK excludes Vulkan");
  else if (backend === "vulkan" && excludesOpenCl) pass("Gradle packaging", "Vulkan-only APK excludes OpenCL");
  else if (backend === "auto" && !excludesVulkan && !excludesOpenCl) pass("Gradle packaging", "Auto mode keeps both backends");
  else if (backend === "vulkan" && !excludesVulkan) pass("Gradle packaging", "Vulkan mode keeps Vulkan in APK");
  else fail("Gradle packaging", `backend=${backend} excludesVulkan=${excludesVulkan} excludesOpenCl=${excludesOpenCl}`);
}

let deviceProfile = "cpu_safe";
try {
  const devices = adb("devices").split(/\r?\n/).slice(1).filter((line) => line.includes("device") && !line.includes("List"));
  if (!devices.length) throw new Error("No adb device connected");
  pass("ADB device", devices[0].split(/\s+/)[0] || "connected");

  const vulkanHw = adb("shell getprop ro.hardware.vulkan");
  const eglHw = adb("shell getprop ro.hardware.egl");
  const socModel = adb("shell getprop ro.soc.model");
  deviceProfile = classifyDeviceProps(vulkanHw, eglHw, socModel);
  pass("Device GPU profile", `${deviceProfile} (vulkan=${vulkanHw || "?"}, egl=${eglHw || "?"}, soc=${socModel || "?"})`);

  if (deviceProfile === "mali_vulkan" && backend === "auto") {
    pass("Mali build hint", "Auto packaging selected; keep HA off for CPU fallback and enable only for profiling");
  } else if (deviceProfile === "mali_vulkan" && backend !== "vulkan") {
    fail("Mali build hint", `Unsupported Mali backend mode for this package: ${backend}`);
  } else if (deviceProfile === "mali_vulkan" && backend === "vulkan") {
    pass("Mali build hint", "Vulkan-only packaging selected for Mali device");
  }

  const apkPath = adb("shell pm path io.daemon.mobile").replace("package:", "").trim();
  if (apkPath) {
    const remoteList = adb(`shell unzip -l ${apkPath} "lib/arm64-v8a/libqvac*"`);
    const hasOpenClBackend = /libqvac-ggml-opencl\.so/.test(remoteList);
    const hasVulkanBackend = /libqvac-ggml-vulkan\.so/.test(remoteList);
    if (deviceProfile === "mali_vulkan") {
      if (hasVulkanBackend) pass("Installed APK Vulkan (Mali)", "libqvac-ggml-vulkan.so present");
      else fail("Installed APK Vulkan (Mali)", "libqvac-ggml-vulkan.so missing — rebuild with backend=vulkan");
      if (hasOpenClBackend && backend === "vulkan") {
        fail("Installed APK OpenCL (Mali)", "OpenCL still packaged — rebuild after patch with backend=vulkan");
      } else if (!hasOpenClBackend && backend === "vulkan") {
        pass("Installed APK OpenCL (Mali)", "OpenCL excluded (Vulkan-only)");
      }
    } else {
      if (hasOpenClBackend) pass("Installed APK OpenCL", "libqvac-ggml-opencl.so present");
      if (hasVulkanBackend) pass("Installed APK Vulkan", "libqvac-ggml-vulkan.so present");
    }
    if (backend === "auto" && hasVulkanBackend && hasOpenClBackend) {
      pass("Installed APK dual backend", "Vulkan + OpenCL packaged");
    }
  }

  pass("Profiler gate (manual)", "Run Profile Inference: target Decode backend=gpu, native TPS >= 10");
  pass("Logcat gate (manual)", "Then: npm run qvac:probe-gpu-logcat");
} catch (error) {
  fail("ADB checks", error instanceof Error ? error.message : String(error));
}

if (fabricGpu) pass("Fabric GPU flag", "EXPO_PUBLIC_DAEMON_FABRIC_GPU=1");
else fail("Fabric GPU flag", "EXPO_PUBLIC_DAEMON_FABRIC_GPU is not 1");

console.log("\nQVAC GPU device verification\n");
for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.label}`);
  console.log(`      ${check.detail}\n`);
}

const failed = checks.filter((check) => !check.ok).length;
process.exit(failed ? 1 : 0);
