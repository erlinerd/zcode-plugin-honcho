import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactMode = process.argv.includes("--artifact");

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${relativePath}: ${reason}`, {
      cause: error,
    });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  return value;
}

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const plugin = readJson(".zcode-plugin/plugin.json");
const marketplace = readJson("marketplace.json");
const hooks = readJson("hooks/hooks.json");
const builtPlugin = artifactMode ? readJson("dist/plugin.json") : null;
const builtHooks = artifactMode ? readJson("dist/hooks/hooks.json") : null;

assert(packageJson.private === true, "package.json must remain private");
assert(packageJson.license === "MIT", "package.json must declare MIT");
assert(packageLock.version === packageJson.version, "lockfile version differs");
assert(
  packageLock.packages?.[""].version === packageJson.version,
  "lock root version differs",
);
assert(plugin.version === packageJson.version, "plugin version differs");
assert(plugin.license === packageJson.license, "plugin license differs");
assert(
  marketplace.plugins?.length === 1,
  "marketplace must contain one plugin",
);
assert(
  marketplace.plugins[0].name === plugin.name,
  "marketplace plugin name differs",
);
assert(
  marketplace.plugins[0].version === plugin.version,
  "marketplace plugin version differs",
);

const expectedEvents = ["SessionStart", "UserPromptSubmit", "Stop"];
assert(
  JSON.stringify(Object.keys(hooks.hooks ?? {})) ===
    JSON.stringify(expectedEvents),
  "hooks.json contains an unexpected event set",
);

if (artifactMode) {
  assert(builtPlugin.name === plugin.name, "dist/plugin.json is stale");
  assert(
    builtPlugin.version === plugin.version,
    "dist/plugin.json version is stale",
  );
  assert(
    JSON.stringify(canonicalize(hooks)) ===
      JSON.stringify(canonicalize(builtHooks)),
    "dist/hooks/hooks.json is stale",
  );
  for (const relativePath of [
    "dist/hooks/entry.mjs",
    "dist/hooks/entry.mjs.map",
    "dist/hooks/hooks.json",
    "dist/plugin.json",
  ])
    assert(
      fs.existsSync(path.join(root, relativePath)),
      `Missing ${relativePath}`,
    );
}

const credentialPattern = /(?:hch|sk|pk|rk)-[A-Za-z0-9_-]{12,}/;
const textFiles = [
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "DESIGN.md",
  "SECURITY.md",
  "AGENTS.md",
  ".zcode-plugin/plugin.json",
  "marketplace.json",
];
if (artifactMode) textFiles.push("dist/plugin.json", "dist/hooks/entry.mjs");
for (const relativePath of textFiles) {
  const contents = fs.readFileSync(path.join(root, relativePath), "utf8");
  assert(
    !credentialPattern.test(contents),
    `Possible credential in ${relativePath}`,
  );
}

process.stdout.write(
  `Validated ${plugin.name}@${plugin.version}: manifests, hooks, ${artifactMode ? "artifacts, " : ""}and credential hygiene.\n`,
);
