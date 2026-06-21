# Daemon overlay: build from vendor/qvac/packages/lint-cpp (prefetched by buildQvacMaliNative.mjs).
get_filename_component(DAEMON_QVAC_LINT_CPP "${CMAKE_CURRENT_LIST_DIR}/../../qvac/packages/lint-cpp" ABSOLUTE)
if(EXISTS "${DAEMON_QVAC_LINT_CPP}/CMakeLists.txt")
  set(LINT_CPP_SOURCE_PATH "${DAEMON_QVAC_LINT_CPP}")
  message(STATUS "qvac-lint-cpp overlay: using local source at ${LINT_CPP_SOURCE_PATH}")
else()
  message(FATAL_ERROR
    "qvac-lint-cpp overlay requires vendor/qvac/packages/lint-cpp. "
    "Run: npm run qvac:build-mali-native (prefetches via Node git with SSL workaround).")
endif()

vcpkg_cmake_configure(SOURCE_PATH "${LINT_CPP_SOURCE_PATH}")

vcpkg_cmake_install()

set(VCPKG_POLICY_EMPTY_INCLUDE_FOLDER enabled)
file(REMOVE_RECURSE "${CURRENT_PACKAGES_DIR}/debug")

set(LINT_CPP_LICENSE "${LINT_CPP_SOURCE_PATH}/LICENSE")
if(NOT EXISTS "${LINT_CPP_LICENSE}")
  set(LINT_CPP_LICENSE "${CMAKE_CURRENT_LIST_DIR}/../../qvac/packages/llm-llamacpp/LICENSE")
endif()
vcpkg_install_copyright(FILE_LIST "${LINT_CPP_LICENSE}")
