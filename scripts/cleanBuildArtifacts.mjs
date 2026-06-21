#!/usr/bin/env node
/**
 * Remove regenerable build artifacts to free disk space (~3–4 GB typical).
 * Safe to run before npm run qvac:build-mali-native or android:install-device.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = [
  "android/app/build",
  "android/app/.cxx",
  "android/build",
  "android/.gradle",
  "vendor/vcpkg/buildtrees",
  "vendor/vcpkg/packages",
  "vendor/qvac/packages/llm-llamacpp/build",
  "vendor/qvac-fabric-llm.cpp/vulkan-sdk-1.3.275.tar.gz",
];

function dirSizeBytes(dir) {
  let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) total += dirSizeBytes(full);
      else if (entry.isFile()) total += fs.statSync(full).size;
    } catch {
      /* skip locked files */
    }
  }
  return total;
}

function removeTarget(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return 0;
  let bytes = 0;
  try {
    const stat = fs.statSync(full);
    bytes = stat.isDirectory() ? dirSizeBytes(full) : stat.size;
    fs.rmSync(full, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    console.log(`[cleanBuildArtifacts] removed ${rel} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
  } catch (e) {
    console.warn(`[cleanBuildArtifacts] skip ${rel}:`, e instanceof Error ? e.message : e);
  }
  return bytes;
}

let freed = 0;
console.log("[cleanBuildArtifacts] Start");
for (const rel of TARGETS) freed += removeTarget(rel);
console.log(`[cleanBuildArtifacts] Done — freed ~${(freed / 1024 / 1024 / 1024).toFixed(2)} GB`);
