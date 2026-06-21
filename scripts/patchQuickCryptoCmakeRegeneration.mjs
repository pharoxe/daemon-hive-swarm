import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildGradle = path.join(root, "node_modules", "react-native-quick-crypto", "android", "build.gradle");

if (!fs.existsSync(buildGradle)) {
  console.warn("[patchQuickCryptoCmakeRegeneration] react-native-quick-crypto build.gradle not found; skip.");
  process.exit(0);
}

const source = fs.readFileSync(buildGradle, "utf8");
if (source.includes("-DCMAKE_SUPPRESS_REGENERATION=ON")) {
  console.log("[patchQuickCryptoCmakeRegeneration] CMake regeneration suppression already present.");
  process.exit(0);
}

const needle = `"-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON"`;
if (!source.includes(needle)) {
  console.warn("[patchQuickCryptoCmakeRegeneration] Unexpected build.gradle shape; skip.");
  process.exit(0);
}

const patched = source.replace(needle, `${needle},\n                  "-DCMAKE_SUPPRESS_REGENERATION=ON"`);
fs.writeFileSync(buildGradle, patched);
console.log("[patchQuickCryptoCmakeRegeneration] Patched QuickCrypto CMake regeneration suppression.");
