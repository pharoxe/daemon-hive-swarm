#!/usr/bin/env node
/**
 * Verify QVAC Android OpenCL packaging and device stock OpenCL libraries.
 *
 * Usage: node scripts/verifyQvacOpenClDevice.mjs
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function walkForFile(dir, fileName, matches = []) {
  if (!fs.existsSync(dir)) return matches;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkForFile(full, fileName, matches);
    else if (entry.isFile() && entry.name === fileName) matches.push(full);
  }
  return matches;
}

const env = mergedEnv();
const backend = String(env.EXPO_PUBLIC_DAEMON_ANDROID_GPU_BACKEND || "opencl").toLowerCase();
const fabricGpu = env.EXPO_PUBLIC_DAEMON_FABRIC_GPU === "1";
const fabricLlm = env.EXPO_PUBLIC_DAEMON_FABRIC_LLM !== "0";

const checks = [];

function pass(label, detail) {
  checks.push({ ok: true, label, detail });
}

function fail(label, detail) {
  checks.push({ ok: false, label, detail });
}

if (backend === "opencl") pass("Env backend", `EXPO_PUBLIC_DAEMON_ANDROID_GPU_BACKEND=${backend}`);
else fail("Env backend", `Expected opencl, got ${backend}`);

if (fabricLlm) pass("Fabric LLM", "EXPO_PUBLIC_DAEMON_FABRIC_LLM enabled");
else fail("Fabric LLM", "EXPO_PUBLIC_DAEMON_FABRIC_LLM=0 disables GPU llama.cpp path");

const vulkanTargets = [
  ...walkForFile(path.join(root, "node_modules", "@qvac", "llm-llamacpp", "prebuilds", "android-arm64"), "libqvac-ggml-vulkan.so"),
  ...walkForFile(path.join(root, "node_modules", "@qvac", "embed-llamacpp", "prebuilds", "android-arm64"), "libqvac-ggml-vulkan.so"),
];
const disabledVulkan = vulkanTargets.filter((file) => fs.existsSync(`${file}.disabled-opencl`));
const activeVulkan = vulkanTargets.filter((file) => fs.existsSync(file));

if (backend === "opencl" && activeVulkan.length === 0) {
  pass("Vulkan packaging", `Vulkan backend disabled in ${disabledVulkan.length} QVAC prebuild path(s)`);
} else if (backend === "opencl") {
  fail("Vulkan packaging", `Found active libqvac-ggml-vulkan.so: ${activeVulkan.join(", ")}`);
}

const gradlePath = path.join(root, "android", "app", "build.gradle");
if (fs.existsSync(gradlePath)) {
  const gradle = fs.readFileSync(gradlePath, "utf8");
  if (gradle.includes('excludes += "**/libqvac-ggml-vulkan.so"')) {
    pass("Gradle Vulkan exclude", "Release APK excludes bundled Vulkan backend");
  } else {
    fail("Gradle Vulkan exclude", "Missing libqvac-ggml-vulkan.so exclude in android/app/build.gradle");
  }
  if (gradle.includes('excludes += "/lib/**/libOpenCL.so"')) {
    pass("Gradle OpenCL packaging", "APK does not bundle libOpenCL.so (uses device stock ICD)");
  } else {
    fail("Gradle OpenCL packaging", "Expected libOpenCL.so exclude so stock vendor OpenCL is used");
  }
}

try {
  const devices = adb("devices").split(/\r?\n/).slice(1).filter((line) => line.includes("device") && !line.includes("List"));
  if (!devices.length) throw new Error("No adb device connected");
  pass("ADB device", devices[0].split(/\s+/)[0] || "connected");

  const openClCandidates = [
    "/vendor/lib64/libOpenCL.so",
    "/vendor/lib/libOpenCL.so",
    "/system/vendor/lib64/libOpenCL.so",
    "/system/vendor/lib/libOpenCL.so",
    "/system/lib64/libOpenCL.so",
    "/system/lib/libOpenCL.so",
  ];
  const found = [];
  for (const candidate of openClCandidates) {
    try {
      adb(`shell ls -l ${candidate}`);
      found.push(candidate);
    } catch {
      // missing path
    }
  }
  if (found.length) pass("Device OpenCL ICD", found.join(", "));
  else fail("Device OpenCL ICD", "No stock libOpenCL.so found on common vendor/system paths");

  const gpuInfo = adb('shell getprop ro.hardware.egl');
  pass("Device GPU EGL", gpuInfo || "unknown");

  const apkPath = adb("shell pm path io.daemon.mobile").replace("package:", "").trim();
  if (apkPath) {
    const remoteList = adb(`shell unzip -l ${apkPath} "lib/arm64-v8a/libqvac*"`);
    const hasOpenClBackend = /libqvac-ggml-opencl\.so/.test(remoteList);
    const hasVulkanBackend = /libqvac-ggml-vulkan\.so/.test(remoteList);
    if (hasOpenClBackend) pass("Installed APK backend", "libqvac-ggml-opencl.so present");
    else fail("Installed APK backend", "libqvac-ggml-opencl.so missing from installed APK");
    if (!hasVulkanBackend) pass("Installed APK Vulkan", "libqvac-ggml-vulkan.so not packaged");
    else fail("Installed APK Vulkan", "libqvac-ggml-vulkan.so still packaged");
  }
} catch (error) {
  fail("ADB checks", error instanceof Error ? error.message : String(error));
}

if (fabricGpu) pass("Fabric GPU flag", "EXPO_PUBLIC_DAEMON_FABRIC_GPU=1");
else fail("Fabric GPU flag", "EXPO_PUBLIC_DAEMON_FABRIC_GPU is not 1 (GPU offload opt-in off)");

console.log("\nQVAC OpenCL verification\n");
for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.label}`);
  console.log(`      ${check.detail}\n`);
}

const failed = checks.filter((check) => !check.ok).length;
process.exit(failed ? 1 : 0);
