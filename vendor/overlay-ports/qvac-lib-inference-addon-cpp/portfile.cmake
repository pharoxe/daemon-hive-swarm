# Daemon overlay: build from vendor/qvac/packages/inference-addon-cpp (prefetched by buildQvacMaliNative.mjs).
get_filename_component(DAEMON_INFER_CPP "${CMAKE_CURRENT_LIST_DIR}/../../qvac/packages/inference-addon-cpp" ABSOLUTE)
if(EXISTS "${DAEMON_INFER_CPP}/CMakeLists.txt")
  set(SOURCE_PATH "${DAEMON_INFER_CPP}")
  message(STATUS "qvac-lib-inference-addon-cpp overlay: using local source at ${SOURCE_PATH}")
else()
  message(FATAL_ERROR
    "qvac-lib-inference-addon-cpp overlay requires vendor/qvac/packages/inference-addon-cpp. "
    "Run: npm run qvac:build-mali-native (prefetches via Node git with SSL workaround).")
endif()

vcpkg_check_features(
  OUT_FEATURE_OPTIONS FEATURE_OPTIONS
  FEATURES
    tests BUILD_TESTING
)

vcpkg_cmake_configure(
  SOURCE_PATH "${SOURCE_PATH}"
  DISABLE_PARALLEL_CONFIGURE
  OPTIONS
    ${FEATURE_OPTIONS}
)

vcpkg_cmake_install()

file(REMOVE_RECURSE "${CURRENT_PACKAGES_DIR}/debug")

file(
  INSTALL "${SOURCE_PATH}/LICENSE"
  DESTINATION "${CURRENT_PACKAGES_DIR}/share/${PORT}"
  RENAME copyright
)
