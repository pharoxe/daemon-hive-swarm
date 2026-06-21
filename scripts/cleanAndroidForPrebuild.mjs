/**
 * Prepare for `expo prebuild --clean` on Windows: stop Gradle daemons and remove `android/`
 * without leaving a half-deleted tree (EBUSY from Gradle / CMake / dex / OneDrive).
 *
 * Windows: after `gradlew --stop`, uses `robocopy` mirror-to-empty (Microsoft’s usual
 * workaround for “in use” trees), then removes the folder.
 *
 * If this still fails: close Android Studio, pause OneDrive on this repo, close Gradle terminals.
 * Optional: `DAEMON_ANDROID_CLEAN_KILL_JAVA=1` runs `taskkill /F /IM java.exe` (kills all JVMs).
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = path.join(root, "android");
const gradlewBat = path.join(androidDir, "gradlew.bat");
const gradlewUnix = path.join(androidDir, "gradlew");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function tryGradleStop() {
  if (process.platform === "win32" && fs.existsSync(gradlewBat)) {
    try {
      execFileSync(gradlewBat, ["--stop"], { cwd: androidDir, stdio: "inherit", windowsHide: true });
      return;
    } catch {
      /* ignore */
    }
  }
  if (process.platform !== "win32" && fs.existsSync(gradlewUnix)) {
    try {
      execFileSync(gradlewUnix, ["--stop"], { cwd: androidDir, stdio: "inherit" });
      return;
    } catch {
      /* ignore */
    }
  }
  try {
    execFileSync("gradle", ["--stop"], { stdio: "pipe", windowsHide: true });
  } catch {
    /* gradle not on PATH */
  }
}

function tryKillJavaWindows() {
  if (process.platform !== "win32" || process.env.DAEMON_ANDROID_CLEAN_KILL_JAVA !== "1") return;
  console.warn("[clean-android] DAEMON_ANDROID_CLEAN_KILL_JAVA=1 — stopping Java (Gradle) …");
  const r = spawnSync("taskkill", ["/F", "/IM", "java.exe"], { encoding: "utf8", windowsHide: true });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status !== 0 && !/not find|no tasks running|not running/i.test(out)) {
    console.warn("[clean-android] taskkill:", out.trim() || r.status);
  }
}

/** Windows: mirror an empty dir into `target` to wipe contents even when some files were locked for delete. */
function robocopyWipeWindows(targetDir) {
  const stamp = `daemon-android-empty-${Date.now()}`;
  const empty = path.join(os.tmpdir(), stamp);
  fs.mkdirSync(empty, { recursive: true });
  try {
    const r = spawnSync(
      "robocopy",
      [empty, targetDir, "/MIR", "/R:2", "/W:2", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/NS", "/NC"],
      { stdio: "pipe", windowsHide: true, encoding: "utf8" },
    );
    // robocopy exit codes 0–7 = success-ish for our purpose
    if (r.status !== null && r.status > 7) {
      console.warn("[clean-android] robocopy mirror exit:", r.status);
    }
  } finally {
    try {
      fs.rmSync(empty, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function rmAndroidTree() {
  if (!fs.existsSync(androidDir)) {
    console.log("[clean-android] No android/ folder — nothing to remove.");
    return;
  }

  console.log("[clean-android] Removing", androidDir);

  if (process.platform === "win32") {
    try {
      robocopyWipeWindows(androidDir);
    } catch (e) {
      console.warn("[clean-android] robocopy wipe:", e instanceof Error ? e.message : e);
    }
  }

  try {
    await fs.promises.rm(androidDir, { recursive: true, force: true, maxRetries: 12, retryDelay: 350 });
  } catch (e1) {
    console.warn("[clean-android] fs.rm:", e1 instanceof Error ? e1.message : e1);
  }

  if (!fs.existsSync(androidDir)) {
    console.log("[clean-android] Done.");
    return;
  }

  if (process.platform === "win32") {
    try {
      execFileSync("cmd.exe", ["/c", `rd /s /q "${androidDir}"`], { stdio: "inherit", windowsHide: true });
    } catch {
      /* ignore */
    }
  }

  if (fs.existsSync(androidDir)) {
    console.error(
      "[clean-android] Could not delete android/. Close Android Studio and terminals using this repo, pause OneDrive for this folder, then re-run. Last resort: DAEMON_ANDROID_CLEAN_KILL_JAVA=1 node scripts/cleanAndroidForPrebuild.mjs",
    );
    process.exit(1);
  }
  console.log("[clean-android] Done.");
}

console.log("[clean-android] Start");
tryKillJavaWindows();
tryGradleStop();
await sleep(2500);
await rmAndroidTree();
