const { withAppBuildGradle } = require("@expo/config-plugins");

const VULKAN_EXCLUDE = 'excludes += "**/libqvac-ggml-vulkan.so"';
const OPENCL_EXCLUDE = 'excludes += "**/libqvac-ggml-opencl.so"';
const SYSTEM_OPENCL_EXCLUDE = 'excludes += "/lib/**/libOpenCL.so"';

function backendFromEnv() {
  return String(process.env.EXPO_PUBLIC_DAEMON_ANDROID_GPU_BACKEND || "auto").trim().toLowerCase();
}

/**
 * opencl: exclude Vulkan from APK.
 * vulkan: exclude OpenCL from APK (Mali/MediaTek — force Vulkan decode path).
 * auto: ship both backends.
 */
module.exports = function withQvacOpenClOnlyGpu(config) {
  const backend = backendFromEnv();

  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents
      .split(/\r?\n/)
      .filter(
        (line) =>
          !line.includes("libqvac-ggml-vulkan.so") &&
          !line.includes("libqvac-ggml-opencl.so") &&
          !line.includes("/lib/**/libOpenCL.so"),
      )
      .join("\n");

    if (backend !== "opencl" && backend !== "vulkan") {
      mod.modResults.contents = contents;
      return mod;
    }

    const excludeLines =
      backend === "opencl"
        ? [VULKAN_EXCLUDE]
        : [
            OPENCL_EXCLUDE,
            SYSTEM_OPENCL_EXCLUDE,
          ];
    const excludeBlock = excludeLines.join("\n            ");

    if (/jniLibs\s*\{/.test(contents)) {
      contents = contents.replace(/jniLibs\s*\{/, (match) => `${match}\n            ${excludeBlock}`);
    } else if (/packagingOptions\s*\{/.test(contents)) {
      contents = contents.replace(/packagingOptions\s*\{/, (match) => `${match}\n        jniLibs {\n            ${excludeBlock}\n        }`);
    } else {
      contents = contents.replace(/android\s*\{/, (match) => `${match}\n    packagingOptions {\n        jniLibs {\n            ${excludeBlock}\n        }\n    }`);
    }

    mod.modResults.contents = contents;
    return mod;
  });
};
