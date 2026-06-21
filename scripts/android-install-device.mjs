/**
 * Installs the Android app on the first `adb devices` entry in "device" state.
 *
 * **standalone** / **release** (default: standalone): installs embedded JS bundle — no Metro on PC.
 *   Expo prebuild only defines `debug` / `release` build types (no `standalone` flavor), so this
 *   script maps **standalone → release** and runs Gradle `installRelease` (embedded bundle via RN
 *   `export:embed`). Launches `MainActivity` (avoids Expo CLI opening dev-client URLs).
 *
 * **debug**: uses `npx expo run:android` (expects Metro).
 *
 * Override variant: `EXPO_ANDROID_VARIANT=release` or `debug`.
 *
 * Expo device name comes from `adb devices -l` (`model:...`), not the USB serial.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const adbCandidates = [
  process.env.ADB,
  process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb"),
  process.env.ANDROID_SDK_ROOT &&
    path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb"),
  "adb",
].filter(Boolean);

const adb = adbCandidates.find((candidate) => candidate === "adb" || fs.existsSync(candidate));
const adbCommand = adb.includes(" ") ? `"${adb}"` : adb;

const variantEnv = (process.env.EXPO_ANDROID_VARIANT || "standalone").toLowerCase();
const useEmbeddedBundle = variantEnv === "standalone" || variantEnv === "release";
/** Gradle install task suffix: prebuild template has no `standalone` flavor. */
const gradleVariant =
  variantEnv === "standalone" || variantEnv === "release" ? "release" : variantEnv;
const localJavaTrustStore =
  process.env.GRADLE_JAVA_TRUST_STORE || path.join(os.homedir(), ".gradle", "certs", "daemon-agent-cacerts");
const gradleEnv = { ...process.env };

if (!gradleEnv.JAVA_TOOL_OPTIONS && fs.existsSync(localJavaTrustStore)) {
  const trustStorePassword = process.env.GRADLE_JAVA_TRUST_STORE_PASSWORD || "changeit";
  gradleEnv.JAVA_TOOL_OPTIONS =
    `-Djavax.net.ssl.trustStore=${localJavaTrustStore} -Djavax.net.ssl.trustStorePassword=${trustStorePassword}`;
}

const out = execSync(`${adbCommand} devices -l`, { encoding: "utf8" });
const lines = out
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => {
    if (!l || l.startsWith("List of devices")) return false;
    return /^\S+\s+device(\s|$)/.test(l);
  });

if (lines.length === 0) {
  console.error(
    "No Android device found. Connect hardware with USB debugging, or start an emulator, then check `adb devices` shows 'device' (not unauthorized/offline).",
  );
  process.exit(1);
}

const first = lines[0];
const serial = first.split(/\s+/)[0];
const modelMatch = first.match(/\bmodel:(\S+)/);
const productMatch = first.match(/\bproduct:(\S+)/);
const expoDevice = modelMatch?.[1] ?? productMatch?.[1] ?? serial;

console.log(`ADB serial: ${serial}`);

if (useEmbeddedBundle) {
  const capitalized = gradleVariant.charAt(0).toUpperCase() + gradleVariant.slice(1);
  const task = `install${capitalized}`;
  const gradlew = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  const androidDir = path.join(root, "android");
  const resDir = path.join(androidDir, "app", "src", "main", "res");
  const launcherNames = new Set([
    "ic_launcher.png",
    "ic_launcher.webp",
    "ic_launcher_foreground.png",
    "ic_launcher_foreground.webp",
    "ic_launcher_round.png",
    "ic_launcher_round.webp",
  ]);

  for (const density of fs.readdirSync(resDir)) {
    if (!density.startsWith("mipmap-")) continue;
    const densityDir = path.join(resDir, density);
    for (const file of fs.readdirSync(densityDir)) {
      if (launcherNames.has(file)) {
        fs.rmSync(path.join(densityDir, file), { force: true });
      }
    }
  }

  console.log("Regenerating native Android resources from app.json...");
  execSync("npx expo prebuild --platform android --no-install", { stdio: "inherit", cwd: root, shell: true });

  console.log(
    `Gradle: ${task} (EXPO_ANDROID_VARIANT=${variantEnv}${variantEnv !== gradleVariant ? ` → ${gradleVariant}` : ""}, embedded bundle - no Metro)`,
  );
  execSync(`${gradlew} :app:${task}`, { stdio: "inherit", cwd: androidDir, shell: true, env: gradleEnv });

  const main = "io.daemon.mobile/.MainActivity";
  console.log(`Launching ${main}...`);
  execSync(`${adbCommand} -s ${serial} shell am start -n ${main}`, { stdio: "inherit", cwd: root, shell: true });
} else {
  console.log(`Expo run:android (debug), device name: ${expoDevice}`);
  execSync(`npx expo run:android --variant ${gradleVariant} --device ${expoDevice}`, {
    stdio: "inherit",
    cwd: root,
    shell: true,
  });
}
