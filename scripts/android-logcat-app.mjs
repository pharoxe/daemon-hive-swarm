/**
 * Stream logcat for the running io.daemon.mobile process only (by PID).
 * Surfaces BridgelessReact / Hermes / native lines without system noise.
 *
 * Usage: npm run android:logs:app
 *
 * If the app crashed on launch (no PID), dumps the recent crash buffer instead.
 */
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const pkg = "io.daemon.mobile";

const adbCandidates = [
  process.env.ADB,
  process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb"),
  process.env.ANDROID_SDK_ROOT &&
    path.join(process.env.ANDROID_SDK_ROOT, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb"),
  "adb",
].filter(Boolean);

const adb = adbCandidates.find((candidate) => candidate === "adb" || fs.existsSync(candidate));

function tryGetPid() {
  try {
    const out = execSync(`"${adb}" shell pidof ${pkg}`, { encoding: "utf8" }).trim();
    if (!out) return null;
    return out.split(/\s+/)[0];
  } catch {
    return null;
  }
}

function dumpRecentCrash() {
  console.error(`[android-logcat-app] No PID for ${pkg}. Dumping recent crash buffer (launch the app first if empty).\n`);
  try {
    execSync(`"${adb}" logcat -b crash -d -v time`, { stdio: "inherit", windowsHide: true });
  } catch {
    // ignore
  }
  console.error(`\n[android-logcat-app] Tip: adb logcat -b crash -d -v time | findstr /i "${pkg} FATAL"`);
  process.exit(1);
}

const pid = tryGetPid();
if (!pid) {
  dumpRecentCrash();
}

console.error(`[android-logcat-app] ${pkg} pid=${pid} - streaming (Ctrl+C to stop)\n`);

const child = spawn(adb, ["logcat", "-v", "time", "--pid", pid], {
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code) => process.exit(code ?? 0));
