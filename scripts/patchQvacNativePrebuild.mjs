#!/usr/bin/env node
/**
 * Copy a locally built QVAC android-arm64 prebuild tree into node_modules.
 *
 * Set QVAC_NATIVE_PREBUILD_PATH to a directory containing libqvac-ggml-*.so and
 * related @qvac/llm-llamacpp prebuild artifacts (built from qvac-fabric-llm.cpp).
 *
 * Mali Vulkan build flags (reference):
 *   cmake -B build-android -DCMAKE_TOOLCHAIN_FILE=$NDK/build/cmake/android.toolchain.cmake \
 *     -DANDROID_ABI=arm64-v8a -DANDROID_PLATFORM=android-29 \
 *     -DGGML_VULKAN=ON -DGGML_OPENCL=ON -DBUILD_SHARED_LIBS=ON
 *
 * Apply scripts/mali-vulkan-tiling.patch in the qvac-fabric fork before building.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.QVAC_NATIVE_PREBUILD_PATH?.trim();

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function main() {
  if (!source) {
    console.log("[patchQvacNativePrebuild] QVAC_NATIVE_PREBUILD_PATH unset; skip custom prebuild copy.");
    return;
  }
  if (!fs.existsSync(source)) {
    console.warn("[patchQvacNativePrebuild] Source missing:", source);
    process.exit(1);
  }
  /** @qvac ships arm64 libs under nested `qvac__*` dirs; copy into each existing slot. */
  function prebuildSlots(packageName) {
    const arm64 = path.join(root, "node_modules", "@qvac", packageName, "prebuilds", "android-arm64");
    if (!fs.existsSync(arm64)) return [];
    const nested = fs
      .readdirSync(arm64, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith("qvac__"))
      .map((e) => path.join(arm64, e.name));
    return nested.length ? nested : [arm64];
  }

  const targets = [...prebuildSlots("llm-llamacpp"), ...prebuildSlots("embed-llamacpp")];
  let copied = 0;
  for (const target of targets) {
    if (!fs.existsSync(path.dirname(target))) continue;
    copyDir(source, target);
    copied += 1;
    console.log("[patchQvacNativePrebuild] Copied prebuild →", target);
  }
  if (!copied) {
    console.warn("[patchQvacNativePrebuild] No @qvac prebuild targets found under node_modules.");
    process.exit(1);
  }
}

main();
