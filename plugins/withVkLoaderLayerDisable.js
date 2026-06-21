/**
 * Sets Vulkan/GGML environment variables at process start (MainApplication.onCreate), before super.onCreate().
 * VK_LOADER_LAYERS_DISABLE skips OEM-injected layers (e.g. Oplus "colorx") that break llama.cpp GPU init.
 * GGML_VK_* flags keep Mali/MediaTek Vulkan on conservative allocation/kernel paths.
 *
 * @see https://github.com/KhronosGroup/Vulkan-Loader/blob/main/docs/LoaderLayerInterface.md
 * @param {import('expo/config').ExpoConfig} config
 */
const { withMainApplication } = require("@expo/config-plugins");

const ENV_VARS = {
  VK_LOADER_LAYERS_DISABLE: "*",
  GGML_VK_FORCE_LINEAR: "1",
  GGML_VK_DISABLE_F16: "1",
};

const MARKER = "GGML_VK_FORCE_LINEAR";

function kotlinSetenvBlock() {
  return Object.entries(ENV_VARS)
    .map(([key, value]) => `    try { android.system.Os.setenv("${key}", "${value}", true) } catch (_: Throwable) {}`)
    .join("\n");
}

function javaSetenvBlock() {
  return Object.entries(ENV_VARS)
    .map(([key, value]) => `    try { android.system.Os.setenv("${key}", "${value}", true); } catch (Throwable ignored) {}`)
    .join("\n");
}

const KT_BLOCK = `
${kotlinSetenvBlock()}
`;

const JAVA_BLOCK = `
${javaSetenvBlock()}
`;

function stripManagedSetenvs(contents) {
  return Object.keys(ENV_VARS).reduce((next, key) => {
    const pattern = new RegExp(
      `\\n\\s*try \\{\\s*android\\.system\\.Os\\.setenv\\("${key}",\\s*"[^"]*",\\s*true\\);?\\s*\\} catch \\([^)]*\\) \\{[^}]*\\}`,
      "g",
    );
    return next.replace(pattern, "");
  }, contents);
}

function injectIntoMainApplication(contents, language) {
  const stripped = stripManagedSetenvs(contents);
  if (stripped.includes(MARKER)) {
    return stripped;
  }

  if (language === "kt") {
    return stripped.replace(/(override fun onCreate\(\)\s*\{)/, `$1${KT_BLOCK}`);
  }

  if (language === "java") {
    return stripped.replace(/((?:public|protected) void onCreate\(\)\s*\{)/, `$1${JAVA_BLOCK}`);
  }

  return stripped;
}

module.exports = function withVkLoaderLayerDisable(config) {
  return withMainApplication(config, (mod) => {
    const { language, contents } = mod.modResults;
    if (language !== "kt" && language !== "java") {
      return mod;
    }
    mod.modResults.contents = injectIntoMainApplication(contents, language);
    return mod;
  });
};
