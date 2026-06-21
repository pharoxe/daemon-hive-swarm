import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginPath = path.join(root, "node_modules", "@qvac", "sdk", "dist", "expo", "plugins", "withMobileBundle.js");

if (!fs.existsSync(pluginPath)) {
  console.warn("[patchQvacExpoMobileBundleTemp] QVAC Expo plugin not installed; skip.");
  process.exit(0);
}

let source = fs.readFileSync(pluginPath, "utf8");
const marker = "QVAC: Reusing prebuilt mobile bundle from qvac/worker.bundle.js";

if (source.includes(marker)) {
  console.log("[patchQvacExpoMobileBundleTemp] QVAC Expo mobile bundler already reuses prebuilt worker bundle.");
  process.exit(0);
}

const reusePatch = [
  '        const prebuiltBundle = path.join(projectRoot, "qvac", "worker.bundle.js");',
  "        if (fs.existsSync(prebuiltBundle)) {",
  `            console.log("${marker}");`,
  "        }",
  "        else {",
  "            await runBundler(projectRoot, sdkPackage.dir, configPath, deferredModules);",
  "        }",
].join("\n");

const oldSyncCall = "        runBundler(projectRoot, sdkPackage.dir, configPath, deferredModules);\n";
const newAsyncCall = "        await runBundler(projectRoot, sdkPackage.dir, configPath, deferredModules);\n";

if (source.includes(newAsyncCall)) {
  source = source.replace(newAsyncCall, `${reusePatch}\n`);
} else if (source.includes(oldSyncCall)) {
  source = source.replace(oldSyncCall, `${reusePatch.replace("await runBundler", "runBundler")}\n`);
} else {
  throw new Error("[patchQvacExpoMobileBundleTemp] Could not find QVAC Expo runBundler call to patch.");
}

fs.writeFileSync(pluginPath, source, "utf8");
console.log("[patchQvacExpoMobileBundleTemp] Patched QVAC Expo mobile bundler to reuse prebuilt worker bundle.");
