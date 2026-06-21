#!/usr/bin/env node
/**
 * Capture recent QVAC / llama.cpp GPU logs from a connected Android device.
 * Run a profiler or chat turn in the app first, then invoke this script.
 *
 * Usage: node scripts/probeQvacGpuLogcat.mjs [--lines 400]
 */
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const linesArg = args.find((a) => a.startsWith("--lines="));
const lineCount = linesArg ? Number(linesArg.split("=")[1]) : 400;

function adb(cmd) {
  return execSync(`adb ${cmd}`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

try {
  const devices = adb("devices").split(/\r?\n/).slice(1).filter((l) => l.includes("device") && !l.includes("List"));
  if (!devices.length) {
    console.error("No adb device connected.");
    process.exit(1);
  }

  const props = [
    "ro.hardware.egl",
    "ro.hardware.vulkan",
    "ro.board.platform",
    "ro.soc.model",
    "ro.product.model",
    "ro.product.brand",
  ];
  console.log("Device GPU / SoC props\n");
  for (const key of props) {
    try {
      console.log(`  ${key}: ${adb(`shell getprop ${key}`) || "?"}`);
    } catch {
      console.log(`  ${key}: ?`);
    }
  }

  console.log("\nRecent QVAC / GPU log lines (run profiler in app first)\n");
  const patterns = [
    "DaemonQvac",
    "DaemonGpuProfile",
    "BareKit",
    "bare",
    "llama",
    "ggml",
    "vulkan",
    "Vulkan",
    "opencl",
    "OpenCL",
    "qvac",
    "QVAC",
    "ReactNativeJS",
  ];
  const grep = patterns.map((p) => `-e ${p}`).join(" ");
  const raw = adb(`logcat -d -t ${lineCount} ${grep}`);
  if (!raw) {
    console.log("(no matching log lines — open app, run Profile Inference with HA on, then re-run)");
  } else {
    console.log(raw);
    const hasVulkan = /vulkan|ggml_vk/i.test(raw);
    const hasOpenClOnly = /opencl/i.test(raw) && !hasVulkan;
    console.log("\n--- Interpretation ---");
    if (hasVulkan) console.log("Vulkan backend activity detected (good for Mali/MediaTek).");
    if (hasOpenClOnly) console.log("OpenCL-only activity — on Mali this often means CPU decode; prefer backend=auto with Vulkan in APK.");
    console.log("Success gate: profiler shows Decode backend: gpu and native TPS >= 10 tok/s on qwen35-08b-q4km.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
