#!/usr/bin/env node
/**
 * Apply Mali Vulkan tiling patch to vendor/qvac-fabric-llm.cpp (ARM_MALI architecture + tiling).
 * Idempotent — skips when marker ARM_MALI is already present in ggml-vulkan.cpp.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fabricRoot = process.env.QVAC_FABRIC_SOURCE_PATH?.trim()
  ? path.resolve(process.env.QVAC_FABRIC_SOURCE_PATH)
  : path.join(root, "vendor", "qvac-fabric-llm.cpp");
const vkPath = path.join(fabricRoot, "ggml", "src", "ggml-vulkan", "ggml-vulkan.cpp");

function main() {
  if (!fs.existsSync(vkPath)) {
    console.error("[applyMaliVulkanPatch] Missing:", vkPath);
    console.error("  Clone: git clone https://github.com/tetherto/qvac-fabric-llm.cpp.git vendor/qvac-fabric-llm.cpp");
    process.exit(1);
  }
  const src = fs.readFileSync(vkPath, "utf8");
  if (src.includes("ARM_MALI")) {
    console.log("[applyMaliVulkanPatch] Mali Vulkan patch already applied:", vkPath);
    return;
  }
  console.error("[applyMaliVulkanPatch] ARM_MALI marker not found — run buildQvacMaliNative after pulling vendor/qvac-fabric-llm.cpp");
  process.exit(1);
}

main();
