# Daemon overlay: build qvac-fabric from patched vendor/qvac-fabric-llm.cpp when present.
get_filename_component(DAEMON_QVAC_FABRIC "${CMAKE_CURRENT_LIST_DIR}/../../qvac-fabric-llm.cpp" ABSOLUTE)
if(EXISTS "${DAEMON_QVAC_FABRIC}/CMakeLists.txt")
  set(SOURCE_PATH "${DAEMON_QVAC_FABRIC}")
  message(STATUS "qvac-fabric overlay: using Daemon patched source at ${SOURCE_PATH}")
elseif(DEFINED ENV{QVAC_FABRIC_SOURCE_PATH} AND EXISTS "$ENV{QVAC_FABRIC_SOURCE_PATH}/CMakeLists.txt")
  set(SOURCE_PATH "$ENV{QVAC_FABRIC_SOURCE_PATH}")
  message(STATUS "qvac-fabric overlay: using QVAC_FABRIC_SOURCE_PATH ${SOURCE_PATH}")
else()
  vcpkg_from_github(
    OUT_SOURCE_PATH SOURCE_PATH
    REPO tetherto/qvac-fabric-llm.cpp
    REF v${VERSION}
    SHA512 9c5340bc8e1474a6a24f1f90d35db9e291bed7a420396cda0f9c36c3495d7e4dbc341b0e7ddae293f6ec5b5d30d5981ae5d2290446636aa54264b05962e1597e
  )
endif()

vcpkg_check_features(
  OUT_FEATURE_OPTIONS FEATURE_OPTIONS
  FEATURES
    force-profiler FORCE_GGML_VK_PERF_LOGGER
    llama BUILD_LLAMA
)

vcpkg_check_features(
  OUT_FEATURE_OPTIONS _PORTFILE_FEATURE_OPTIONS
  FEATURES
    gpu-backends BUILD_GPU_BACKENDS
    kleidiai BUILD_KLEIDIAI
)

if(NOT BUILD_GPU_BACKENDS)
  message(STATUS "qvac-fabric: gpu-backends feature OFF — building CPU-only ggml (no Metal/Vulkan/CUDA/OpenCL)")
endif()

if (VCPKG_TARGET_IS_ANDROID AND BUILD_GPU_BACKENDS)
  set(VULKAN_WRAPPER "${SOURCE_PATH}/ggml/src/ggml-vulkan/vulkan_cpp_wrapper")
  if(EXISTS "${VULKAN_WRAPPER}/include/vulkan/vulkan.hpp")
    message(STATUS "qvac-fabric overlay: reusing Vulkan C++ wrapper at ${VULKAN_WRAPPER}")
  else()
    include(${CMAKE_CURRENT_LIST_DIR}/android-vulkan-version.cmake)
    detect_ndk_vulkan_version()
    message(STATUS "Using Vulkan C++ wrappers from version: ${vulkan_version}")
    set(VULKAN_STAGING "${CURRENT_BUILDTREES_DIR}/vulkan-headers-${TARGET_TRIPLET}")
    file(MAKE_DIRECTORY "${VULKAN_STAGING}")
    set(VULKAN_TARBALL "${VULKAN_STAGING}/vulkan-sdk-${vulkan_version}.tar.gz")
    if(EXISTS "${VULKAN_TARBALL}")
      file(SIZE "${VULKAN_TARBALL}" VULKAN_TARBALL_SIZE)
    else()
      set(VULKAN_TARBALL_SIZE 0)
    endif()
    if(VULKAN_TARBALL_SIZE LESS 1024)
      file(DOWNLOAD
        "https://github.com/KhronosGroup/Vulkan-Headers/archive/refs/tags/v${vulkan_version}.tar.gz"
        "${VULKAN_TARBALL}"
        TLS_VERIFY ON
        SHOW_PROGRESS
        STATUS download_status
      )
      list(GET download_status 0 status_code)
      if(NOT status_code EQUAL 0)
        message(FATAL_ERROR "Vulkan-Headers download failed: ${download_status}")
      endif()
    endif()
    file(ARCHIVE_EXTRACT
      INPUT "${VULKAN_TARBALL}"
      DESTINATION "${VULKAN_STAGING}"
    )
    file(GLOB VULKAN_HEADERS_DIR "${VULKAN_STAGING}/Vulkan-Headers-*")
    if(NOT VULKAN_HEADERS_DIR)
      message(FATAL_ERROR "Vulkan-Headers extract failed in ${VULKAN_STAGING}")
    endif()
    list(GET VULKAN_HEADERS_DIR 0 VULKAN_HEADERS_DIR)
    file(REMOVE_RECURSE "${VULKAN_WRAPPER}")
    file(COPY "${VULKAN_HEADERS_DIR}/" DESTINATION "${VULKAN_WRAPPER}")
  endif()
endif()

set(PLATFORM_OPTIONS)

if(NOT BUILD_GPU_BACKENDS)
  list(APPEND PLATFORM_OPTIONS
    -DGGML_METAL=OFF
    -DGGML_VULKAN=OFF
    -DGGML_CUDA=OFF
    -DGGML_OPENCL=OFF
  )
  if (VCPKG_TARGET_IS_IOS)
    list(APPEND PLATFORM_OPTIONS -DGGML_BLAS=OFF -DGGML_ACCELERATE=OFF)
  endif()
elseif (VCPKG_TARGET_IS_OSX OR VCPKG_TARGET_IS_IOS)
  list(APPEND PLATFORM_OPTIONS -DGGML_METAL=ON)
  if (VCPKG_TARGET_IS_IOS)
    list(APPEND PLATFORM_OPTIONS -DGGML_BLAS=OFF -DGGML_ACCELERATE=OFF)
  endif()
else()
  list(APPEND PLATFORM_OPTIONS -DGGML_VULKAN=ON)
endif()

if(VCPKG_TARGET_IS_ANDROID)
  set(DL_BACKENDS ON)
  list(APPEND PLATFORM_OPTIONS
    -DGGML_BACKEND_DL=ON
    -DGGML_CPU_ALL_VARIANTS=ON
    -DGGML_CPU_REPACK=ON)
else()
  set(DL_BACKENDS OFF)
endif()

if(VCPKG_TARGET_IS_ANDROID AND BUILD_KLEIDIAI)
  message(STATUS "qvac-fabric: kleidiai feature ON — building with ARM KleidiAI optimized kernels")
  list(APPEND PLATFORM_OPTIONS
    -DGGML_CPU_KLEIDIAI=ON
    -DFETCHCONTENT_FULLY_DISCONNECTED=OFF
  )
endif()

if (VCPKG_TARGET_IS_ANDROID AND BUILD_GPU_BACKENDS)
  list(APPEND PLATFORM_OPTIONS -DGGML_OPENCL=OFF)
endif()

if(VCPKG_TARGET_IS_ANDROID AND BUILD_GPU_BACKENDS AND VCPKG_HOST_IS_WINDOWS)
  set(DAEMON_HOST_TOOLCHAIN "${CMAKE_CURRENT_LIST_DIR}/daemon-host-toolchain.cmake")
  if(EXISTS "${DAEMON_HOST_TOOLCHAIN}")
    get_filename_component(DAEMON_HOST_TOOLCHAIN "${DAEMON_HOST_TOOLCHAIN}" ABSOLUTE)
    message(STATUS "qvac-fabric overlay: vulkan-shaders-gen host toolchain ${DAEMON_HOST_TOOLCHAIN}")
    list(APPEND PLATFORM_OPTIONS "-DGGML_VULKAN_SHADERS_GEN_TOOLCHAIN=${DAEMON_HOST_TOOLCHAIN}")
  else()
    message(WARNING "qvac-fabric overlay: missing ${DAEMON_HOST_TOOLCHAIN} — run buildQvacMaliNative.mjs to generate it")
  endif()
endif()

set(LLAMA_OPTIONS)
if("llama" IN_LIST FEATURES)
  list(APPEND LLAMA_OPTIONS -DLLAMA_MTMD=ON)
else()
  list(APPEND LLAMA_OPTIONS
    -DLLAMA_MTMD=OFF
    -DLLAMA_BUILD_COMMON=OFF
  )
endif()

vcpkg_cmake_configure(
  SOURCE_PATH "${SOURCE_PATH}"
  DISABLE_PARALLEL_CONFIGURE
  OPTIONS
    -DGGML_NATIVE=OFF
    -DGGML_CCACHE=OFF
    -DGGML_OPENMP=OFF
    -DGGML_LLAMAFILE=OFF
    -DLLAMA_CURL=OFF
    -DLLAMA_BUILD_TESTS=OFF
    -DLLAMA_BUILD_TOOLS=OFF
    -DLLAMA_BUILD_EXAMPLES=OFF
    -DLLAMA_BUILD_SERVER=OFF
    -DLLAMA_ALL_WARNINGS=OFF
    ${LLAMA_OPTIONS}
    ${PLATFORM_OPTIONS}
    ${FEATURE_OPTIONS}
)

vcpkg_cmake_install()
vcpkg_cmake_config_fixup(
  PACKAGE_NAME ggml)

if(BUILD_LLAMA)
  vcpkg_cmake_config_fixup(PACKAGE_NAME llama)
endif()

vcpkg_copy_pdbs()
vcpkg_fixup_pkgconfig()

if(BUILD_LLAMA)
  file(MAKE_DIRECTORY "${CURRENT_PACKAGES_DIR}/tools/${PORT}")
  file(RENAME "${CURRENT_PACKAGES_DIR}/bin/convert_hf_to_gguf.py" "${CURRENT_PACKAGES_DIR}/tools/${PORT}/convert-hf-to-gguf.py")
  file(INSTALL "${SOURCE_PATH}/gguf-py" DESTINATION "${CURRENT_PACKAGES_DIR}/tools/${PORT}")
  file(RENAME "${CURRENT_PACKAGES_DIR}/bin/vulkan_profiling_analyzer.py" "${CURRENT_PACKAGES_DIR}/tools/${PORT}/vulkan_profiling_analyzer.py")
endif()

if (NOT VCPKG_BUILD_TYPE)
  file(REMOVE "${CURRENT_PACKAGES_DIR}/debug/bin/convert_hf_to_gguf.py")
endif()

file(REMOVE_RECURSE "${CURRENT_PACKAGES_DIR}/debug/include")
file(REMOVE_RECURSE "${CURRENT_PACKAGES_DIR}/debug/share")

if (NOT DL_BACKENDS AND VCPKG_LIBRARY_LINKAGE MATCHES "static")
  file(REMOVE_RECURSE "${CURRENT_PACKAGES_DIR}/bin")
  file(REMOVE_RECURSE "${CURRENT_PACKAGES_DIR}/debug/bin")
endif()

vcpkg_install_copyright(FILE_LIST "${SOURCE_PATH}/LICENSE")
