import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = path.join(projectRoot, "src", "hive", "hiveBackend.mjs");
const out = path.join(projectRoot, "src", "hive", "hive.bundle.mjs");
const barePack = path.join(projectRoot, "node_modules", ".bin", process.platform === "win32" ? "bare-pack.cmd" : "bare-pack");

if (!fs.existsSync(entry)) {
  throw new Error(`Hive backend entrypoint is missing: ${entry}`);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
console.log("[DaemonHive] Bundling Bare Hive backend for Android...");
execSync(`"${barePack}" "${entry}" --host android-arm64 --linked --out "${out}"`, {
  cwd: projectRoot,
  stdio: "inherit",
  shell: true,
});
console.log(`[DaemonHive] Installed Hive worklet bundle -> ${out}`);
