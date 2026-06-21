#!/usr/bin/env node
/**
 * Cross-compile @qvac/llm-llamacpp android-arm64 prebuilds from patched qvac-fabric-llm.cpp.
 *
 * Prerequisites (Windows):
 *   - Android SDK + NDK 29 (Expo uses 29.0.14206865)
 *   - Git, Node 22+, npm
 *   - Vulkan SDK with glslc on PATH (LunarG) OR set VULKAN_SDK
 *   - Visual Studio 2022 with "Desktop development with C++" (host vulkan-shaders-gen tool)
 *
 * Usage:
 *   node scripts/buildQvacMaliNative.mjs
 *   $env:QVAC_NATIVE_PREBUILD_PATH = (Resolve-Path vendor/prebuilds/android-arm64/qvac__llm-llamacpp)
 *   node scripts/patchQvacNativePrebuild.mjs
 *   npm run android:install-device
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findWindowsHostCompiler,
  writeHostToolchainFile,
} from "./findWindowsHostCompiler.mjs";

const QVAC_MONOREPO = "https://github.com/tetherto/qvac.git";

const QVAC_VCPKG_PACKAGES = [
  {
    sparsePath: "packages/lint-cpp",
    destRel: "vendor/qvac/packages/lint-cpp",
    ref: "08d695772fe2944dc5adad0067c1d4e105ffdc90",
  },
  {
    sparsePath: "packages/inference-addon-cpp",
    destRel: "vendor/qvac/packages/inference-addon-cpp",
    ref: "febc630cdbffbb7d4b5a24da72ab717958199e81",
  },
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const actualRoot = path.resolve(scriptDir, "..");

function resolveBuildRoot() {
  if (process.env.DAEMON_BUILD_ROOT?.trim()) {
    return path.resolve(process.env.DAEMON_BUILD_ROOT);
  }
  if (process.platform === "win32" && process.env.DAEMON_BUILD_REEXEC === "1") {
    return actualRoot;
  }
  if (process.platform === "win32" && actualRoot.length > 40 && !process.env.DAEMON_SKIP_SUBST) {
    const drive = process.env.DAEMON_BUILD_DRIVE || "Q:";
    if (process.env.DAEMON_BUILD_REEXEC !== "1") {
      spawnSync("subst", [drive, "/d"], { shell: true });
      const subst = spawnSync("subst", [drive, actualRoot], { shell: true });
      if (subst.status === 0) {
        console.log(`[buildQvacMaliNative] Mapped ${drive} -> ${actualRoot} (shorter build paths)`);
        const shortScript = path.join(`${drive}\\`, "scripts", "buildQvacMaliNative.mjs");
        const rerun = spawnSync(process.execPath, [shortScript], {
          cwd: `${drive}\\`,
          stdio: "inherit",
          env: { ...process.env, DAEMON_BUILD_REEXEC: "1", DAEMON_BUILD_ROOT: `${drive}\\` },
          shell: false,
        });
        spawnSync("subst", [drive, "/d"], { shell: true });
        process.exit(rerun.status ?? 1);
      }
      console.warn("[buildQvacMaliNative] subst failed; continuing with long paths (may hit Windows path limits).");
    }
  }
  return actualRoot;
}

const root = resolveBuildRoot();
const fabricPath = path.resolve(process.env.QVAC_FABRIC_SOURCE_PATH || path.join(root, "vendor", "qvac-fabric-llm.cpp"));
const llmPackage = path.join(root, "vendor", "qvac", "packages", "llm-llamacpp");
const overlayPorts = path.join(root, "vendor", "overlay-ports");
const vcpkgRoot = process.env.VCPKG_ROOT || path.join(root, "vendor", "vcpkg");
const prebuildSlot = path.join(root, "vendor", "prebuilds", "android-arm64", "qvac__llm-llamacpp");
const sdkRoot =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  path.join(os.homedir(), "AppData", "Local", "Android", "Sdk");
const ndkVersion = process.env.ANDROID_NDK_VERSION || "29.0.14206865";
const ndkHome = process.env.ANDROID_NDK_HOME || path.join(sdkRoot, "ndk", ndkVersion);
const cmakeBin =
  process.env.CMAKE ||
  path.join(sdkRoot, "cmake", "3.22.1", "bin", "cmake.exe");

function run(cmd, args, opts = {}) {
  console.log(`\n[buildQvacMaliNative] ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
  if (r.status !== 0) {
    throw new Error(`${cmd} exited ${r.status ?? "signal"}`);
  }
}

function runNode(script, extraEnv = {}) {
  run(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, ...extraEnv },
  });
}

function ensureVcpkg() {
  const bootstrap = path.join(vcpkgRoot, process.platform === "win32" ? "bootstrap-vcpkg.bat" : "bootstrap-vcpkg.sh");
  if (fs.existsSync(path.join(vcpkgRoot, "vcpkg.exe")) || fs.existsSync(path.join(vcpkgRoot, "vcpkg"))) return;
  if (!fs.existsSync(bootstrap)) {
    console.log("[buildQvacMaliNative] Cloning vcpkg 2025.12.12 …");
    fs.mkdirSync(path.dirname(vcpkgRoot), { recursive: true });
    run("git", [
      "clone",
      "--branch",
      "2025.12.12",
      "--single-branch",
      "--depth",
      "1",
      "https://github.com/microsoft/vcpkg.git",
      vcpkgRoot,
    ]);
  }
  console.log("[buildQvacMaliNative] Bootstrapping vcpkg …");
  if (process.platform === "win32") {
    run(bootstrap, [], { cwd: vcpkgRoot, shell: true });
  } else {
    run("bash", [bootstrap], { cwd: vcpkgRoot });
  }
}

function ensureFabric() {
  if (!fs.existsSync(path.join(fabricPath, "CMakeLists.txt"))) {
    fs.mkdirSync(path.dirname(fabricPath), { recursive: true });
    run("git", ["clone", "--depth", "1", "https://github.com/tetherto/qvac-fabric-llm.cpp.git", fabricPath]);
  }
  runNode(path.join(root, "scripts", "applyMaliVulkanPatch.mjs"), { QVAC_FABRIC_SOURCE_PATH: fabricPath });
  runNode(path.join(root, "scripts", "applyQvacFabricHostCompilerPatch.mjs"), {
    QVAC_FABRIC_SOURCE_PATH: fabricPath,
  });
}

function ensureHostCompilerToolchain() {
  if (process.platform !== "win32") {
    return { envExtra: {}, toolchainPath: process.env.DAEMON_VULKAN_SHADERS_HOST_TOOLCHAIN?.trim() };
  }
  const existing = process.env.DAEMON_VULKAN_SHADERS_HOST_TOOLCHAIN?.trim();
  if (existing && fs.existsSync(existing)) {
    console.log("[buildQvacMaliNative] Using host toolchain:", existing);
    return { envExtra: {}, toolchainPath: existing };
  }
  const host = findWindowsHostCompiler();
  const toolchainDir = path.join(root, "vendor", "overlay-ports", "qvac-fabric");
  const toolchainPath = writeHostToolchainFile(host, toolchainDir);
  console.log("[buildQvacMaliNative] Host compiler:", host.kind, host.cxx);
  console.log("[buildQvacMaliNative] Host toolchain:", toolchainPath);
  return { envExtra: host.env ?? {}, toolchainPath };
}

function ensureLlmSource() {
  if (!fs.existsSync(path.join(llmPackage, "CMakeLists.txt"))) {
    throw new Error(`Missing ${llmPackage}. Run: git sparse-checkout clone packages/llm-llamacpp from tetherto/qvac into vendor/qvac`);
  }
}

function findGlslc() {
  const binName = process.platform === "win32" ? "glslc.exe" : "glslc";
  const candidates = [];

  const envSdk = process.env.VULKAN_SDK?.trim();
  if (envSdk) candidates.push(path.join(envSdk, "Bin", binName));

  const sdkRoots = [
    "C:\\VulkanSDK",
    path.join(os.homedir(), "VulkanSDK"),
    path.join(process.env["ProgramFiles"] || "C:\\Program Files", "Vulkan SDK"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Vulkan SDK"),
  ];
  for (const base of sdkRoots) {
    if (!base || !fs.existsSync(base)) continue;
    candidates.push(path.join(base, "Bin", binName));
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory() && /^\d/.test(entry.name)) {
        candidates.push(path.join(base, entry.name, "Bin", binName));
      }
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  if (process.platform === "win32") {
    const where = spawnSync("where", ["glslc"], { encoding: "utf8", shell: true });
    if (where.status === 0) {
      const first = where.stdout.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
      if (first && fs.existsSync(first)) return first;
    }
  }
  return undefined;
}

function ensureHostGlslc(env) {
  const glslc = findGlslc();
  if (!glslc) {
    console.error("[buildQvacMaliNative] Host glslc not found (required to compile Vulkan shaders during cross-compile).");
    console.error("  Install LunarG Vulkan SDK as Administrator, then set VULKAN_SDK=C:\\VulkanSDK");
    console.error("  https://vulkan.lunarg.com/sdk/home#windows");
    process.exit(1);
  }
  const glslcDir = path.dirname(glslc);
  const sdkRoot = path.dirname(glslcDir);
  const sep = process.platform === "win32" ? ";" : ":";
  console.log("[buildQvacMaliNative] Using glslc:", glslc);
  return {
    ...env,
    VULKAN_SDK: env.VULKAN_SDK || sdkRoot,
    PATH: `${glslcDir}${sep}${env.PATH || ""}`,
  };
}

function pathWithCmake(env) {
  const cmakeDir = path.dirname(cmakeBin);
  const nodeDir = path.dirname(process.execPath);
  const sep = process.platform === "win32" ? ";" : ":";
  return {
    ...env,
    PATH: `${cmakeDir}${sep}${nodeDir}${sep}${env.PATH || ""}`,
    CMAKE: cmakeBin,
  };
}

/** vcpkg/cmake git fetch ignores shell env SSL workarounds — prefetch sources from Node git instead. */
function applyGitSslWorkaround() {
  if (process.env.DAEMON_GIT_SSL_VERIFY === "1") return;
  const gitConfigPath = path.join(root, "vendor", ".tools", "gitconfig-vcpkg");
  fs.mkdirSync(path.dirname(gitConfigPath), { recursive: true });
  fs.writeFileSync(gitConfigPath, "[http]\n\tsslVerify = false\n", "utf8");
  process.env.GIT_CONFIG_GLOBAL = gitConfigPath;
  process.env.GIT_CONFIG_SYSTEM = process.platform === "win32" ? "NUL" : "/dev/null";
  delete process.env.GIT_CONFIG_COUNT;
  delete process.env.GIT_CONFIG_KEY_0;
  delete process.env.GIT_CONFIG_VALUE_0;
}

function gitEnv() {
  applyGitSslWorkaround();
  return { ...process.env };
}

function runGit(args, cwd) {
  console.log(`[buildQvacMaliNative] git ${args.join(" ")}`);
  const r = spawnSync("git", args, {
    cwd,
    stdio: "inherit",
    shell: false,
    env: gitEnv(),
  });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} exited ${r.status ?? "signal"}`);
  }
}

function ensureQvacVcpkgPackageSources() {
  if (process.env.DAEMON_GIT_SSL_VERIFY === "1") {
    console.warn("[buildQvacMaliNative] DAEMON_GIT_SSL_VERIFY=1 — skipping monorepo prefetch (overlay ports need local sources).");
    return;
  }
  const gitConfigPath = process.env.GIT_CONFIG_GLOBAL;
  console.log("[buildQvacMaliNative] Prefetching qvac monorepo packages for overlay ports (git SSL:", gitConfigPath, ")");
  for (const pkg of QVAC_VCPKG_PACKAGES) {
    const dest = path.join(root, pkg.destRel);
    const marker = path.join(dest, ".qvac-source-ref");
    if (fs.existsSync(path.join(dest, "CMakeLists.txt"))) {
      const existing = fs.existsSync(marker) ? fs.readFileSync(marker, "utf8").trim() : "";
      if (existing === pkg.ref) {
        console.log("[buildQvacMaliNative] Reusing", pkg.sparsePath, "@", pkg.ref.slice(0, 8));
        continue;
      }
    }
    console.log("[buildQvacMaliNative] Fetching", pkg.sparsePath, "@", pkg.ref.slice(0, 8), "…");
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), "qvac-vcpkg-"));
    try {
      runGit(["clone", "--filter=blob:none", "--sparse", "--depth", "1", QVAC_MONOREPO, staging]);
      runGit(["sparse-checkout", "set", pkg.sparsePath], staging);
      runGit(["fetch", "origin", pkg.ref, "--depth", "1"], staging);
      runGit(["checkout", pkg.ref], staging);
      const src = path.join(staging, pkg.sparsePath);
      fs.rmSync(dest, { recursive: true, force: true });
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
      fs.writeFileSync(marker, pkg.ref, "utf8");
    } finally {
      fs.rmSync(staging, { recursive: true, force: true });
    }
  }
}

function main() {
  console.log("[buildQvacMaliNative] Mali-tuned QVAC native build");
  console.log("  fabric:", fabricPath);
  console.log("  ndk:", ndkHome);
  console.log("  vcpkg:", vcpkgRoot);
  console.log("  overlay:", overlayPorts);

  if (!fs.existsSync(ndkHome)) {
    console.error("[buildQvacMaliNative] Android NDK not found:", ndkHome);
    console.error("  Install NDK 29 via Android Studio SDK Manager or set ANDROID_NDK_HOME.");
    process.exit(1);
  }
  if (!fs.existsSync(cmakeBin)) {
    console.error("[buildQvacMaliNative] cmake not found:", cmakeBin);
    console.error("  Install via Android SDK Manager (CMake 3.22.1) or set CMAKE.");
    process.exit(1);
  }

  applyGitSslWorkaround();
  ensureQvacVcpkgPackageSources();
  ensureFabric();
  ensureLlmSource();
  ensureVcpkg();
  const { envExtra: hostCompilerEnv, toolchainPath } = ensureHostCompilerToolchain();

  if (process.env.DAEMON_CLEAN_FABRIC_BUILD === "1") {
    for (const dir of ["arm64-android-dbg", "arm64-android-rel"]) {
      const tree = path.join(vcpkgRoot, "buildtrees", "qvac-fabric", dir);
      if (fs.existsSync(tree)) {
        console.log("[buildQvacMaliNative] Removing qvac-fabric buildtree:", tree);
        fs.rmSync(tree, { recursive: true, force: true });
      }
    }
  }

  console.log("[buildQvacMaliNative] npm install in llm-llamacpp …");
  run("npm", ["install"], { cwd: llmPackage });
  let bareMake = path.join(llmPackage, "node_modules", ".bin", process.platform === "win32" ? "bare-make.cmd" : "bare-make");
  if (!fs.existsSync(bareMake)) {
    console.log("[buildQvacMaliNative] Installing bare + bare-make …");
    run("npm", ["install", "--save-dev", "bare", "bare-make"], { cwd: llmPackage });
    bareMake = path.join(llmPackage, "node_modules", ".bin", process.platform === "win32" ? "bare-make.cmd" : "bare-make");
  }
  if (!fs.existsSync(bareMake)) {
    throw new Error(`bare-make not found after npm install: ${bareMake}`);
  }

  const buildDir = path.join(llmPackage, "build");
  if (process.env.DAEMON_CLEAN_BUILD === "1" && fs.existsSync(buildDir)) {
    console.log("[buildQvacMaliNative] Removing stale build/", buildDir);
    fs.rmSync(buildDir, { recursive: true, force: true });
  }

  const hasBuildTree = fs.existsSync(path.join(buildDir, "build.ninja"));
  if (hasBuildTree) {
    console.log("[buildQvacMaliNative] Reusing existing build/ (set DAEMON_CLEAN_BUILD=1 to regenerate)");
  }

  const env = ensureHostGlslc({
    ...pathWithCmake({
      ...process.env,
      QVAC_FABRIC_SOURCE_PATH: fabricPath,
      VCPKG_ROOT: vcpkgRoot,
      VCPKG_OVERLAY_PORTS: overlayPorts,
      ANDROID_NDK_HOME: ndkHome,
      ANDROID_HOME: sdkRoot,
      ANDROID_SDK_ROOT: sdkRoot,
      DAEMON_VULKAN_SHADERS_HOST_TOOLCHAIN: toolchainPath,
      CMAKE_BUILD_PARALLEL_LEVEL: process.env.CMAKE_BUILD_PARALLEL_LEVEL || "1",
      EXPO_PUBLIC_DAEMON_ANDROID_GPU_BACKEND: process.env.EXPO_PUBLIC_DAEMON_ANDROID_GPU_BACKEND || "vulkan",
    }),
    ...hostCompilerEnv,
  });

  if (!hasBuildTree) {
    run(bareMake, ["generate", "--platform", "android", "--arch", "arm64"], {
      cwd: llmPackage,
      env,
      shell: process.platform === "win32",
    });
  }
  run(bareMake, ["build"], { cwd: llmPackage, env, shell: process.platform === "win32" });
  run(bareMake, ["install"], { cwd: llmPackage, env, shell: process.platform === "win32" });

  const builtPrebuild = path.join(llmPackage, "prebuilds", "android-arm64", "qvac__llm-llamacpp");
  if (!fs.existsSync(builtPrebuild)) {
    console.error("[buildQvacMaliNative] Expected prebuild output missing:", builtPrebuild);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(prebuildSlot), { recursive: true });
  fs.cpSync(builtPrebuild, prebuildSlot, { recursive: true, force: true });

  const libs = fs.readdirSync(prebuildSlot).filter((f) => f.endsWith(".so"));
  console.log("\n[buildQvacMaliNative] Installed custom prebuild →", prebuildSlot);
  console.log("  libs:", libs.join(", "));
  console.log("\nNext:");
  console.log(`  $env:QVAC_NATIVE_PREBUILD_PATH="${prebuildSlot}"`);
  console.log("  node scripts/patchQvacNativePrebuild.mjs");
  console.log('  $env:EXPO_PUBLIC_DAEMON_ANDROID_GPU_BACKEND="vulkan"');
  console.log("  $env:EXPO_PUBLIC_DAEMON_FABRIC_GPU=\"1\"");
  console.log("  npm run android:install-device");
}

try {
  main();
} catch (error) {
  console.error("[buildQvacMaliNative] FAILED:", error instanceof Error ? error.message : error);
  if (process.platform === "win32") {
    console.error("\nWindows build notes:");
    console.error("  - Host C++ tools: Visual Studio → Desktop development with C++ (for vulkan-shaders-gen)");
    console.error("  - Or set DAEMON_HOST_CC / DAEMON_HOST_CXX to gcc.exe / g++.exe");
    if (!process.env.VULKAN_SDK) {
      console.error("  - Vulkan SDK + glslc: https://vulkan.lunarg.com/sdk/home#windows");
    }
  }
  process.exit(1);
}
