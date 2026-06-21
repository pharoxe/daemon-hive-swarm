#!/usr/bin/env node
/**
 * Patch @qvac/sdk to accept/forward llama.cpp modelConfig keys we use for Android GPU probing.
 * The transform layer forwards snake_case keys to the C++ addon automatically.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = path.join(root, "node_modules", "@qvac", "sdk", "dist", "schemas", "llamacpp-config.js");
const transformPath = path.join(
  root,
  "node_modules",
  "@qvac",
  "sdk",
  "dist",
  "server",
  "bare",
  "plugins",
  "llamacpp-completion",
  "transform.js",
);

function patchSchema(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  let changed = false;
  const marker = "gpu_layers: z.number().optional(),";
  if (!src.includes(marker)) {
    console.warn("[patchQvacLlmBatchConfig] Unexpected schema shape:", filePath);
    return false;
  }

  function insertAfterMarker(key, line) {
    if (src.includes(key)) return;
    src = src.replace(marker, `${marker}\n    ${line}`);
    changed = true;
  }

  insertAfterMarker("n_batch", "n_batch: z.number().int().positive().optional(),");
  insertAfterMarker("n_ubatch", "n_ubatch: z.number().int().positive().optional(),");
  insertAfterMarker('"kv-offload"', '"kv-offload": z.boolean().optional(),');
  insertAfterMarker('"op-offload"', '"op-offload": z.boolean().optional(),');
  insertAfterMarker('"flash-attn"', '"flash-attn": z.enum(["on", "off", "auto"]).optional(),');

  if (changed) fs.writeFileSync(filePath, src, "utf8");
  return changed;
}

function patchTransform(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  const marker = "if (\"stop_sequences\" in transformed) {";
  const patch = `if (transformed["no_mmap"] === "true") {
        transformed["no_mmap"] = "";
    }
    if (transformed["no_mmap"] === "false") {
        delete transformed["no_mmap"];
    }
    `;

  if (src.includes('transformed["no_mmap"] = "";')) return false;
  if (!src.includes(marker)) {
    console.warn("[patchQvacLlmBatchConfig] Unexpected transform shape:", filePath);
    return false;
  }

  src = src.replace(marker, `${patch}${marker}`);
  fs.writeFileSync(filePath, src, "utf8");
  return true;
}

function main() {
  if (!fs.existsSync(schemaPath)) {
    console.warn("[patchQvacLlmBatchConfig] @qvac/sdk schema not installed; skip.");
    return;
  }
  const patched = patchSchema(schemaPath);
  const transformPatched = fs.existsSync(transformPath) ? patchTransform(transformPath) : false;
  console.log(`[patchQvacLlmBatchConfig] schema patched=${patched} transform patched=${transformPatched}`);
}

main();
