import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const officialPluginsDir = resolve(root, "build", "official", "plugins");

async function readJson(relativePath) {
  try {
    return JSON.parse(await readFile(resolve(root, relativePath), "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${relativePath}: ${reason}`, {
      cause: error,
    });
  }
}

const packageJson = await readJson("package.json");
const pluginJson = await readJson(".zcode-plugin/plugin.json");

if (packageJson.name !== "zcode-plugin-honcho")
  throw new Error(`Unexpected package name: ${packageJson.name}`);
if (pluginJson.version !== packageJson.version)
  throw new Error("Plugin manifest version differs from package.json");

await rm(dist, { recursive: true, force: true });
await rm(officialPluginsDir, { recursive: true, force: true });
await mkdir(resolve(dist, "hooks"), { recursive: true });

await build({
  absWorkingDir: root,
  entryPoints: ["src/hooks/entry.ts"],
  outfile: "dist/hooks/entry.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  sourcemap: true,
  legalComments: "eof",
  banner: {
    js: `// Generated from ${packageJson.name} v${packageJson.version}. Edit src/, not dist/.`,
  },
});

await cp(resolve(root, "hooks/hooks.json"), resolve(dist, "hooks/hooks.json"));
await cp(
  resolve(root, ".zcode-plugin/plugin.json"),
  resolve(dist, "plugin.json"),
);

// Canonical official-layout projection of this single build. Copied bytes
// only; nothing here recompiles the runtime. The release ZIP and the official
// catalog submission are both consumers of this exact directory.
const officialPluginDir = resolve(officialPluginsDir, packageJson.name);
const officialCopies = [
  ".zcode-plugin/plugin.json",
  "hooks/hooks.json",
  "dist/hooks/entry.mjs",
  "dist/hooks/entry.mjs.map",
  "dist/plugin.json",
  "dist/hooks/hooks.json",
  "README.md",
  "README.zh-CN.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
];

for (const relativePath of officialCopies) {
  const destination = resolve(officialPluginDir, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await cp(resolve(root, relativePath), destination);
}

const officialPackage = {
  name: packageJson.name,
  version: packageJson.version,
  description: packageJson.description,
  license: packageJson.license,
  private: true,
  type: "module",
  engines: packageJson.engines,
};
await writeFile(
  resolve(officialPluginDir, "package.json"),
  `${JSON.stringify(officialPackage, null, 2)}\n`,
  { encoding: "utf8" },
);

process.stdout.write(
  `${JSON.stringify({
    plugin: packageJson.name,
    version: packageJson.version,
    bundle: "dist/hooks/entry.mjs",
    officialLayout: `build/official/plugins/${packageJson.name}`,
  })}\n`,
);
