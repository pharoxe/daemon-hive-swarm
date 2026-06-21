#!/usr/bin/env node
/**
 * Patch ggml-vulkan CMakeLists to avoid selecting Android NDK clang as the Windows host compiler.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fabricRoot = process.env.QVAC_FABRIC_SOURCE_PATH?.trim()
  ? path.resolve(process.env.QVAC_FABRIC_SOURCE_PATH)
  : path.join(root, "vendor", "qvac-fabric-llm.cpp");
const cmakePath = path.join(fabricRoot, "ggml", "src", "ggml-vulkan", "CMakeLists.txt");
const marker = "_ggml_vk_is_android_ndk_compiler";

const patchedFunction = `function(_ggml_vk_is_android_ndk_compiler compiler out_var)
    if("\${compiler}" MATCHES "[/\\\\][Nn][Dd][Kk][/\\\\]" OR "\${compiler}" MATCHES "Android[/\\\\]Sdk")
        set(\${out_var} TRUE PARENT_SCOPE)
    else()
        set(\${out_var} FALSE PARENT_SCOPE)
    endif()
endfunction()

function(detect_host_compiler)
    if (CMAKE_HOST_SYSTEM_NAME STREQUAL "Windows")
        find_program(HOST_C_COMPILER NAMES cl cl.exe NO_CMAKE_FIND_ROOT_PATH)
        find_program(HOST_CXX_COMPILER NAMES cl cl.exe NO_CMAKE_FIND_ROOT_PATH)
        if (NOT HOST_C_COMPILER)
            find_program(_ggml_vk_host_c NAMES gcc clang NO_CMAKE_FIND_ROOT_PATH)
            find_program(_ggml_vk_host_cxx NAMES g++ clang++ NO_CMAKE_FIND_ROOT_PATH)
            _ggml_vk_is_android_ndk_compiler("\${_ggml_vk_host_c}" _ggml_vk_host_c_is_ndk)
            _ggml_vk_is_android_ndk_compiler("\${_ggml_vk_host_cxx}" _ggml_vk_host_cxx_is_ndk)
            if(_ggml_vk_host_c_is_ndk)
                unset(_ggml_vk_host_c)
            endif()
            if(_ggml_vk_host_cxx_is_ndk)
                unset(_ggml_vk_host_cxx)
            endif()
            set(HOST_C_COMPILER "\${_ggml_vk_host_c}")
            set(HOST_CXX_COMPILER "\${_ggml_vk_host_cxx}")
        endif()
    else()
        find_program(HOST_C_COMPILER NAMES gcc clang NO_CMAKE_FIND_ROOT_PATH)
        find_program(HOST_CXX_COMPILER NAMES g++ clang++ NO_CMAKE_FIND_ROOT_PATH)
    endif()
    set(HOST_C_COMPILER "\${HOST_C_COMPILER}" PARENT_SCOPE)
    set(HOST_CXX_COMPILER "\${HOST_CXX_COMPILER}" PARENT_SCOPE)
endfunction()`;

function main() {
  if (!fs.existsSync(cmakePath)) {
    console.error("[applyQvacFabricHostCompilerPatch] Missing:", cmakePath);
    process.exit(1);
  }
  const src = fs.readFileSync(cmakePath, "utf8");
  if (src.includes(marker)) {
    console.log("[applyQvacFabricHostCompilerPatch] Host compiler patch already applied:", cmakePath);
    return;
  }
  const replaced = src.replace(
    /function\(detect_host_compiler\)[\s\S]*?^endfunction\(\)/m,
    patchedFunction,
  );
  if (replaced === src) {
    console.error("[applyQvacFabricHostCompilerPatch] Could not locate detect_host_compiler() in", cmakePath);
    process.exit(1);
  }
  fs.writeFileSync(cmakePath, replaced, "utf8");
  console.log("[applyQvacFabricHostCompilerPatch] Applied host compiler patch:", cmakePath);
}

main();
