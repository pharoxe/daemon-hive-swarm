#!/usr/bin/env node
/**
 * Locate a Windows host C/C++ compiler for vulkan-shaders-gen (not Android NDK clang).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const NDK_PATH_RE = /[/\\]ndk[/\\]|Android[/\\]Sdk[/\\]/i;

function isAndroidNdkCompiler(compilerPath) {
  return Boolean(compilerPath && NDK_PATH_RE.test(compilerPath));
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function findVswhere() {
  const candidates = [
    process.env.VSWHERE,
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft Visual Studio", "Installer", "vswhere.exe"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fileExists(candidate)) return candidate;
  }
  return undefined;
}

function findVsInstallations() {
  const vswhere = findVswhere();
  if (!vswhere) return [];
  const result = spawnSync(
    vswhere,
    ["-latest", "-products", "*", "-requires", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64", "-property", "installationPath"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function findClInVs(vsRoot) {
  const msvcRoot = path.join(vsRoot, "VC", "Tools", "MSVC");
  if (!fileExists(msvcRoot)) return undefined;
  const versions = fs
    .readdirSync(msvcRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  for (const version of versions) {
    const cl = path.join(msvcRoot, version, "bin", "Hostx64", "x64", "cl.exe");
    if (fileExists(cl)) return cl;
  }
  return undefined;
}

function getWindowsShortPath(longPath) {
  if (process.platform !== "win32" || !longPath.includes(" ")) return longPath;
  const result = spawnSync("cmd.exe", ["/d", "/c", `for %I in ("${longPath}") do @echo %~sI`], {
    encoding: "utf8",
    shell: true,
  });
  const candidate = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .pop();
  return candidate && fs.existsSync(candidate) ? candidate : longPath;
}

function normalizeMsvcPaths(paths) {
  return paths.map((entry) => getWindowsShortPath(entry));
}

function findWindowsSdkRc(sdkRoot, sdkVer) {
  const candidates = [
    path.join(sdkRoot, "bin", sdkVer, "x64", "rc.exe"),
    path.join(sdkRoot, "Bin", sdkVer, "x64", "rc.exe"),
  ];
  for (const candidate of candidates) {
    if (fileExists(candidate)) return getWindowsShortPath(candidate);
  }
  return undefined;
}

function parseCmdSetOutput(stdout) {
  const env = {};
  for (const line of stdout.split(/\r?\n/)) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    env[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return env;
}

function buildMsvcDevEnv(vsRoot) {
  const msvcRoot = path.join(vsRoot, "VC", "Tools", "MSVC");
  const sdkRoot = path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Windows Kits", "10");
  if (!fileExists(msvcRoot) || !fileExists(path.join(sdkRoot, "Include"))) return undefined;

  const msvcVer = fs
    .readdirSync(msvcRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse()[0];
  const sdkVer = fs
    .readdirSync(path.join(sdkRoot, "Include"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse()[0];
  if (!msvcVer || !sdkVer) return undefined;

  const clDir = path.join(msvcRoot, msvcVer, "bin", "Hostx64", "x64");
  const include = normalizeMsvcPaths([
    path.join(msvcRoot, msvcVer, "include"),
    path.join(sdkRoot, "Include", sdkVer, "ucrt"),
    path.join(sdkRoot, "Include", sdkVer, "shared"),
    path.join(sdkRoot, "Include", sdkVer, "um"),
    path.join(sdkRoot, "Include", sdkVer, "winrt"),
    path.join(sdkRoot, "Include", sdkVer, "cppwinrt"),
  ]).join(";");
  const lib = normalizeMsvcPaths([
    path.join(msvcRoot, msvcVer, "lib", "x64"),
    path.join(sdkRoot, "Lib", sdkVer, "ucrt", "x64"),
    path.join(sdkRoot, "Lib", sdkVer, "um", "x64"),
  ]).join(";");
  const pathPrefix = normalizeMsvcPaths([
    clDir,
    path.join(sdkRoot, "Bin", sdkVer, "x64"),
    path.join(vsRoot, "Common7", "IDE", "CommonExtensions", "Microsoft", "CMake", "Ninja"),
    path.join(vsRoot, "Common7", "IDE", "CommonExtensions", "Microsoft", "CMake", "CMake", "bin"),
  ]).join(";");
  return {
    INCLUDE: include,
    LIB: lib,
    PATH: `${pathPrefix};${process.env.PATH || ""}`,
    SDK_ROOT: sdkRoot,
    SDK_VER: sdkVer,
  };
}

function loadVcVars64Env(vsRoot) {
  const vcvars = path.join(vsRoot, "VC", "Auxiliary", "Build", "vcvars64.bat");
  if (fileExists(vcvars)) {
    const result = spawnSync(`cmd /d /c call "${vcvars}" && set`, {
      encoding: "utf8",
      shell: true,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.status === 0) {
      const env = parseCmdSetOutput(result.stdout);
      if (env.INCLUDE && env.LIB) return env;
    }
  }
  return buildMsvcDevEnv(vsRoot);
}

function findCompilerInPath(names) {
  for (const name of names) {
    const result = spawnSync("where", [name], { encoding: "utf8", shell: true });
    if (result.status !== 0) continue;
    const first = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (first && fileExists(first) && !isAndroidNdkCompiler(first)) return first;
  }
  return undefined;
}

function findKnownGcc() {
  const candidates = [
    process.env.DAEMON_MINGW_ROOT && path.join(process.env.DAEMON_MINGW_ROOT, "bin", "g++.exe"),
    "C:\\msys64\\mingw64\\bin\\g++.exe",
    "C:\\mingw64\\bin\\g++.exe",
    path.join(process.env.LOCALAPPDATA || "", "daemon-agent", "tools", "mingw64", "bin", "g++.exe"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fileExists(candidate) && !isAndroidNdkCompiler(candidate)) {
      return {
        cc: candidate.replace(/g\+\+\.exe$/i, "gcc.exe"),
        cxx: candidate,
      };
    }
  }
  return undefined;
}

function findAnyVsRoot() {
  const vswhere = findVswhere();
  if (!vswhere) return undefined;
  const result = spawnSync(vswhere, ["-latest", "-products", "*", "-property", "installationPath"], {
    encoding: "utf8",
  });
  if (result.status !== 0) return undefined;
  const line = result.stdout
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find(Boolean);
  return line && fileExists(line) ? line : undefined;
}

export function findWindowsHostCompiler() {
  if (process.platform !== "win32") {
    return { cc: process.env.DAEMON_HOST_CC, cxx: process.env.DAEMON_HOST_CXX, kind: "env", env: {} };
  }

  const envOverrideCc = process.env.DAEMON_HOST_CC?.trim();
  const envOverrideCxx = process.env.DAEMON_HOST_CXX?.trim() || envOverrideCc;
  if (envOverrideCc && envOverrideCxx) {
    if (isAndroidNdkCompiler(envOverrideCc) || isAndroidNdkCompiler(envOverrideCxx)) {
      throw new Error("DAEMON_HOST_CC/CXX must not point at the Android NDK (vulkan-shaders-gen needs a Windows host compiler).");
    }
    return { cc: envOverrideCc, cxx: envOverrideCxx, kind: "env", env: {} };
  }

  for (const vsRoot of findVsInstallations()) {
    const cl = findClInVs(vsRoot);
    if (!cl) continue;
    const vcEnv = loadVcVars64Env(vsRoot) ?? {};
    const rcCompiler =
      vcEnv.SDK_ROOT && vcEnv.SDK_VER
        ? findWindowsSdkRc(vcEnv.SDK_ROOT, vcEnv.SDK_VER)
        : findWindowsSdkRc(
            path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Windows Kits", "10"),
            (vcEnv.INCLUDE || "").split(";").map((entry) => entry.match(/Include[/\\]([\d.]+)/)?.[1]).find(Boolean) ||
              fs
                .readdirSync(path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Windows Kits", "10", "Include"))
                .filter((name) => /^\d/.test(name))
                .sort()
                .reverse()[0],
          );
    return {
      cc: getWindowsShortPath(cl),
      cxx: getWindowsShortPath(cl),
      kind: "msvc",
      env: vcEnv,
      vsRoot,
      rcCompiler,
    };
  }

  const gccPair = findKnownGcc();
  if (gccPair) {
    return { cc: gccPair.cc, cxx: gccPair.cxx, kind: "gcc", env: {} };
  }

  const pathCl = findCompilerInPath(["cl.exe", "clang-cl.exe", "clang++.exe", "g++.exe"]);
  if (pathCl) {
    const kind = /cl\.exe$/i.test(pathCl) ? "msvc" : pathCl.toLowerCase().includes("clang") ? "clang" : "gcc";
    return {
      cc: kind === "gcc" ? pathCl.replace(/g\+\+\.exe$/i, "gcc.exe") : pathCl,
      cxx: pathCl,
      kind,
      env: {},
    };
  }

  const vsRoot = findAnyVsRoot();
  if (vsRoot) {
    throw new Error(
      [
        "Visual Studio is installed but the C++ build tools are missing (required for vulkan-shaders-gen).",
        "Open Visual Studio Installer → Modify → enable \"Desktop development with C++\" → Install.",
        `Detected VS at: ${vsRoot}`,
        "Or install MinGW-w64 and set DAEMON_HOST_CC / DAEMON_HOST_CXX to gcc.exe / g++.exe.",
      ].join("\n"),
    );
  }

  throw new Error(
    [
      "No Windows host C/C++ compiler found for vulkan-shaders-gen.",
      "Install Visual Studio 2022 with \"Desktop development with C++\", or MinGW-w64.",
      "Optional override: set DAEMON_HOST_CC and DAEMON_HOST_CXX to full paths.",
    ].join("\n"),
  );
}

export function writeHostToolchainFile({ cc, cxx, kind, env, rcCompiler }, outputDir) {
  const toCmakePath = (value) => value.replace(/\\/g, "/");
  const runtimeDir = toCmakePath(path.join(outputDir, "host-runtime"));
  fs.mkdirSync(runtimeDir, { recursive: true });
  const toolchainPath = path.join(outputDir, "daemon-host-toolchain.cmake");

  let msvcFlagsBlock = "";
  if (kind === "msvc" && env?.INCLUDE) {
    const includes = env.INCLUDE.split(";").map((entry) => entry.trim()).filter(Boolean);
    const libs = (env.LIB || "").split(";").map((entry) => entry.trim()).filter(Boolean);
    const includeItems = includes.map((dir) => `    "${toCmakePath(dir)}"`).join("\n");
    const libItems = libs.map((dir) => `    "${toCmakePath(dir)}"`).join("\n");
    msvcFlagsBlock = `
foreach(_daemon_inc IN ITEMS
${includeItems}
)
  set(CMAKE_C_FLAGS "\${CMAKE_C_FLAGS} /I\${_daemon_inc}")
  set(CMAKE_CXX_FLAGS "\${CMAKE_CXX_FLAGS} /I\${_daemon_inc}")
endforeach()
foreach(_daemon_lib IN ITEMS
${libItems}
)
  set(CMAKE_EXE_LINKER_FLAGS "\${CMAKE_EXE_LINKER_FLAGS} /LIBPATH:\${_daemon_lib}")
endforeach()
set(ENV{INCLUDE} "${env.INCLUDE.replace(/\\/g, "\\\\")}")
set(ENV{LIB} "${(env.LIB || "").replace(/\\/g, "\\\\")}")
set(ENV{PATH} "${(env.PATH || "").replace(/\\/g, "\\\\")}")
`;
  }

  const msvcBlock =
    kind === "msvc"
      ? `
set(CMAKE_TRY_COMPILE_TARGET_TYPE STATIC_LIBRARY)
foreach(CONFIG IN ITEMS DEBUG RELEASE MINSIZEREL RELWITHDEBINFO)
    set(CMAKE_RUNTIME_OUTPUT_DIRECTORY_\${CONFIG} \${CMAKE_RUNTIME_OUTPUT_DIRECTORY})
endforeach()
${msvcFlagsBlock}`
      : "";
  let rcBlock = "";
  if (kind === "msvc" && rcCompiler) {
    rcBlock = `set(CMAKE_RC_COMPILER "${toCmakePath(rcCompiler)}")\n`;
  }

  const contents = `# Generated by buildQvacMaliNative.mjs — host tool for vulkan-shaders-gen
set(CMAKE_BUILD_TYPE Release)
set(CMAKE_C_FLAGS -O2)
set(CMAKE_CXX_FLAGS -O2)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE NEVER)
set(CMAKE_C_COMPILER "${toCmakePath(cc)}")
set(CMAKE_CXX_COMPILER "${toCmakePath(cxx)}")
${rcBlock}set(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${runtimeDir}")
${msvcBlock}`;
  fs.writeFileSync(toolchainPath, contents, "utf8");
  return toolchainPath;
}

export function mergeHostCompilerEnv(baseEnv, host) {
  if (!host?.env || Object.keys(host.env).length === 0) return baseEnv;
  return { ...host.env, ...baseEnv };
}
