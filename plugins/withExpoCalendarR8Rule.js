/**
 * Adds the R8 rule generated for expo-calendar release builds.
 *
 * Expo prebuild regenerates android/app/proguard-rules.pro, so keep this in a
 * config plugin instead of editing the ignored native tree by hand.
 *
 * @param {import('expo/config').ExpoConfig} config
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");

const RULE = "-dontwarn expo.modules.kotlin.runtime.Runtime";
const BLOCK = `
# expo-calendar references this optional Expo Kotlin runtime class in release builds.
${RULE}
`;

module.exports = function withExpoCalendarR8Rule(config) {
  return withDangerousMod(config, [
    "android",
    (mod) => {
      const proguardPath = path.join(mod.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
      const contents = fs.existsSync(proguardPath) ? fs.readFileSync(proguardPath, "utf8") : "";

      if (!contents.includes(RULE)) {
        fs.writeFileSync(proguardPath, `${contents.trimEnd()}\n${BLOCK}`, "utf8");
      }

      return mod;
    },
  ]);
};
