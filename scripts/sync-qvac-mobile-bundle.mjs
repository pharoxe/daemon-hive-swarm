/**
 * Regenerates the QVAC Bare worker bundle for React Native and installs it where
 * `expo-rpc-client` expects it (`@qvac/sdk` → `dist/worker.mobile.bundle.js`).
 *
 * Run after moving the repo, switching machines, or if model download fails with
 * RPC / worklet errors. Then rebuild the native app (`npx expo run:android`, etc.).
 *
 * Mirrors `@qvac/sdk` Expo plugin `withMobileBundle` (bundle + copy + BareKit linker patches).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CONFIG_CANDIDATES = ["qvac.config.json", "qvac.config.js", "qvac.config.mjs"];
const MOBILE_HOSTS = ["android-arm64", "ios-arm64", "ios-arm64-simulator", "ios-x64-simulator"];
const DEFERRED_MODULES = ["expo-file-system", "react-native-bare-kit"];

function findConfigFile() {
  for (const candidate of CONFIG_CANDIDATES) {
    const configPath = path.join(projectRoot, candidate);
    if (fs.existsSync(configPath)) return configPath;
  }
  return null;
}

function resolveSdkDir() {
  const dir = path.join(projectRoot, "node_modules", "@qvac", "sdk");
  if (!fs.existsSync(dir)) {
    throw new Error(`@qvac/sdk not found under ${dir}. Run npm install first.`);
  }
  return dir;
}

function resolveCliCommand() {
  const distCli = path.join(projectRoot, "node_modules", "@qvac", "cli", "dist", "index.js");
  if (fs.existsSync(distCli)) {
    return `node "${distCli}"`;
  }
  const srcCli = path.join(projectRoot, "node_modules", "@qvac", "cli", "src", "index.js");
  if (fs.existsSync(srcCli)) {
    return `node "${srcCli}"`;
  }
  console.warn("[Daemon] @qvac/cli not in node_modules; using npx @qvac/cli");
  return "npx --package=@qvac/cli qvac";
}

function makeTempProjectRoot() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "daemon-qvac-bundle-"));
  const nodeModulesSource = path.join(projectRoot, "node_modules");
  const nodeModulesTarget = path.join(tempRoot, "node_modules");
  try {
    fs.symlinkSync(nodeModulesSource, nodeModulesTarget, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    throw new Error(`Failed to create temp node_modules link for QVAC bundling: ${error instanceof Error ? error.message : String(error)}`);
  }
  return tempRoot;
}

function copyGeneratedQvacFiles(tempRoot) {
  const tempQvacDir = path.join(tempRoot, "qvac");
  const projectQvacDir = path.join(projectRoot, "qvac");
  fs.mkdirSync(projectQvacDir, { recursive: true });
  for (const name of ["worker.entry.mjs", "worker.bundle.js", "addons.manifest.json"]) {
    const source = path.join(tempQvacDir, name);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(projectQvacDir, name));
    }
  }
}

/** Same as `@qvac/sdk` `withMobileBundle.patchBareKitLinkers` — keeps linker aligned with addons manifest. */
function patchBareKitLinkers(qvacSdkPath) {
  const bareKitPath = path.join(projectRoot, "node_modules", "react-native-bare-kit");
  if (!fs.existsSync(bareKitPath)) {
    console.warn("[Daemon] react-native-bare-kit not found, skipping linker patch");
    return;
  }
  const patchesDir = path.join(qvacSdkPath, "expo", "plugins", "patches");
  if (!fs.existsSync(patchesDir)) {
    console.warn(`[Daemon] QVAC patches dir missing (${patchesDir}), skipping linker patch`);
    return;
  }
  const androidPatch = path.join(patchesDir, "android-link.mjs");
  const androidTarget = path.join(bareKitPath, "android", "link.mjs");
  if (fs.existsSync(androidPatch) && fs.existsSync(path.dirname(androidTarget))) {
    fs.copyFileSync(androidPatch, androidTarget);
    console.log("[Daemon] Patched react-native-bare-kit android/link.mjs (manifest-aware linker)");
  }
  const iosPatch = path.join(patchesDir, "ios-link.mjs");
  const iosTarget = path.join(bareKitPath, "ios", "link.mjs");
  if (fs.existsSync(iosPatch) && fs.existsSync(path.dirname(iosTarget))) {
    fs.copyFileSync(iosPatch, iosTarget);
    console.log("[Daemon] Patched react-native-bare-kit ios/link.mjs (manifest-aware linker)");
  }
}

/** Best-effort remove so bare-pack can recreate (Windows/OneDrive often lock this path). */
function unlinkStaleBundleOutputs() {
  const candidates = [
    path.join(projectRoot, "qvac", "worker.bundle.js"),
    path.join(projectRoot, "qvac", "worker.entry.mjs"),
  ];
  for (const filePath of candidates) {
    for (let i = 0; i < 12; i++) {
      try {
        if (!fs.existsSync(filePath)) break;
        fs.unlinkSync(filePath);
        console.log(`[Daemon] Removed stale ${path.relative(projectRoot, filePath)}`);
        break;
      } catch {
        try {
          if (process.platform === "win32") {
            execSync("timeout /t 1 /nobreak >nul 2>&1", { stdio: "ignore" });
          } else {
            execSync("sleep 1", { stdio: "ignore" });
          }
        } catch {
          /* ignore */
        }
      }
    }
  }
}

function main() {
  const sdkDir = resolveSdkDir();
  const configPath = findConfigFile();
  if (configPath) {
    console.log(`[Daemon] Using QVAC config: ${path.basename(configPath)}`);
  } else {
    console.log("[Daemon] No qvac.config.* in project root (bundler will use SDK defaults)");
  }

  patchBareKitLinkers(sdkDir);
  unlinkStaleBundleOutputs();

  const sdkPathFlag = `--sdk-path "${sdkDir}"`;
  const configFlag = configPath ? `--config "${configPath}"` : "";
  const hostFlags = MOBILE_HOSTS.map((h) => `--host ${h}`).join(" ");
  const deferredModules = [...DEFERRED_MODULES, "@qvac/sdk/worker.mobile.bundle"];
  const deferFlags = deferredModules.map((m) => `--defer "${m}"`).join(" ");
  const cliCommand = resolveCliCommand();

  console.log("[Daemon] Running qvac bundle sdk in temp workspace (avoids OneDrive file locks)...");
  const tempRoot = makeTempProjectRoot();
  try {
    execSync(`${cliCommand} bundle sdk ${sdkPathFlag} ${configFlag} ${hostFlags} ${deferFlags} --quiet`, {
      stdio: "inherit",
      cwd: tempRoot,
    });
    copyGeneratedQvacFiles(tempRoot);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  const generatedBundle = path.join(projectRoot, "qvac", "worker.bundle.js");
  if (!fs.existsSync(generatedBundle)) {
    throw new Error(
      `QVAC bundle output missing: ${generatedBundle}. Check qvac CLI output above for errors.`,
    );
  }

  const outputPath = path.join(sdkDir, "dist", "worker.mobile.bundle.js");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(generatedBundle, outputPath);
  console.log(`[Daemon] Installed mobile worker bundle → ${outputPath}`);
}

main();
