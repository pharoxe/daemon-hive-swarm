import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = [
  path.join(projectRoot, "node_modules", "react-native-bare-kit", "android", "link.mjs"),
  path.join(projectRoot, "node_modules", "@qvac", "sdk", "expo", "plugins", "patches", "android-link.mjs"),
];

const marker = "const extraNestedAddons = [";
const patch = `

/**
 * QVAC's worker bundle can resolve nested Bare native addons. bare-link links by
 * package name from the project root, so duplicate nested addons with different
 * versions can be missed by the manifest linker. Keep the nested bare-fetch TLS
 * addon aligned with the worker bundle to avoid ADDON_NOT_FOUND at runtime.
 */
const extraNestedAddons = [
  {
    packageDir: path.join(projectRoot, "node_modules", "bare-fetch", "node_modules", "bare-tls"),
    fileName: "bare-tls.bare",
    androidLibraryName: "libbare-tls.3.1.3.so",
  },
];

const androidTargets = {
  "android-arm64": "arm64-v8a",
  "android-arm": "armeabi-v7a",
  "android-ia32": "x86",
  "android-x64": "x86_64",
};

for (const addon of extraNestedAddons) {
  for (const [host, abi] of Object.entries(androidTargets)) {
    const source = path.join(addon.packageDir, "prebuilds", host, addon.fileName);
    const destinationDir = path.join(addonsDir, abi);
    const destination = path.join(destinationDir, addon.androidLibraryName);

    if (!fs.existsSync(source)) {
      console.warn("[QVAC] Extra nested addon missing:", source);
      continue;
    }

    fs.mkdirSync(destinationDir, { recursive: true });
    fs.copyFileSync(source, destination);
    console.log("Wrote", destination);
  }
}
`;

function patchBareKitLinkerScaffold(target) {
  const bareKitLinker = path.join(
    projectRoot,
    "node_modules",
    "react-native-bare-kit",
    "android",
    "link.mjs",
  );

  if (target !== bareKitLinker || !fs.existsSync(target)) {
    return;
  }

  let source = fs.readFileSync(target, "utf8");
  let next = source;

  if (!next.includes("import fs from 'fs'") && !next.includes('import fs from "fs"')) {
    next = next.replace("import path from 'path'\n", "import fs from 'fs'\nimport path from 'path'\n");
  }

  if (!next.includes("const projectRoot = path.join(__filename")) {
    next = next.replace(
      "const __filename = fileURLToPath(import.meta.url)\n",
      "const __filename = fileURLToPath(import.meta.url)\n" +
        "const projectRoot = path.join(__filename, '..', '..', '..', '..')\n" +
        "const addonsDir = path.join(__filename, '..', 'src', 'main', 'addons')\n",
    );
  }

  next = next.replace(
    "for await (const resource of link(path.join(__filename, '..', '..', '..', '..'), {\n" +
      "  target: ['android-arm64', 'android-arm', 'android-ia32', 'android-x64'],\n" +
      "  out: path.join(__filename, '..', 'src', 'main', 'addons')\n" +
      "})) {",
    "for await (const resource of link(projectRoot, {\n" +
      "  target: ['android-arm64', 'android-arm', 'android-ia32', 'android-x64'],\n" +
      "  out: addonsDir\n" +
      "})) {",
  );

  if (next !== source) {
    fs.writeFileSync(target, next);
    console.log(`[Daemon] Repaired BareKit linker scaffold: ${target}`);
  }
}

for (const target of targets) {
  if (!fs.existsSync(target)) {
    console.warn(`[Daemon] Linker target not found: ${target}`);
    continue;
  }

  patchBareKitLinkerScaffold(target);

  const source = fs.readFileSync(target, "utf8");
  if (source.includes(marker)) {
    console.log(`[Daemon] Bare TLS linker patch already present: ${target}`);
    continue;
  }

  fs.writeFileSync(target, source.trimEnd() + patch + "\n");
  console.log(`[Daemon] Applied Bare TLS linker patch: ${target}`);
}

const registryPath = path.join(projectRoot, "node_modules", "@qvac", "sdk", "dist", "server", "plugins", "registry.js");
const registryBefore =
  "        loggingModule.setLogger(createAddonLoggerCallback(plugin.logging.namespace));";
const registryAfter =
  "        if (plugin.logging.namespace !== \"llamacpp-completion\") {\n" +
  "            loggingModule.setLogger(createAddonLoggerCallback(plugin.logging.namespace));\n" +
  "        }";

function patchTextFile(filePath, before, after, label) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[Daemon] ${label} target not found: ${filePath}`);
    return;
  }

  const source = fs.readFileSync(filePath, "utf8");
  if (source.includes(after)) {
    console.log(`[Daemon] ${label} patch already present: ${filePath}`);
    return;
  }

  if (!source.includes(before)) {
    console.warn(`[Daemon] ${label} patch anchor missing: ${filePath}`);
    return;
  }

  fs.writeFileSync(filePath, source.replace(before, after));
  console.log(`[Daemon] Applied ${label} patch: ${filePath}`);
}

patchTextFile(registryPath, registryBefore, registryAfter, "QVAC llama logger guard");
