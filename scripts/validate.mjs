import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const artifactMode = process.argv.includes("--artifact");
const officialMode = process.argv.includes("--official");

function optionValue(flag) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

const rootOverride = optionValue("--root");
const root = rootOverride ? path.resolve(rootOverride) : repoRoot;

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

const officialLayoutFiles = [
  ".zcode-plugin/plugin.json",
  "hooks/hooks.json",
  "dist/hooks/entry.mjs",
  "dist/hooks/entry.mjs.map",
  "dist/plugin.json",
  "dist/hooks/hooks.json",
  "package.json",
  "README.md",
  "README.zh-CN.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
];

if (officialMode) {
  // Mirrors the official catalog's structural rules: the plugin tree must be
  // exactly the approved file set, with no symlinks, within size caps, and
  // with every manifest copy aligned to the repository metadata.
  const officialDir = path.join(root, "build", "official", "plugins", plugin.name);
  assert(
    fs.existsSync(officialDir) && fs.statSync(officialDir).isDirectory(),
    "official: canonical build missing; run npm run build first",
  );
  assert(
    /^[a-z0-9]+(-[a-z0-9]+)*$/.test(plugin.name),
    "official: plugin name must be kebab-case",
  );

  const officialFiles = new Set();
  let officialFileCount = 0;
  let officialBytes = 0;
  const walkOfficial = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      const relativePath = path.relative(officialDir, fullPath);
      assert(
        !entry.isSymbolicLink(),
        `official: symlinks are not allowed: ${relativePath}`,
      );
      if (entry.isDirectory()) {
        walkOfficial(fullPath);
        continue;
      }
      officialFileCount += 1;
      officialBytes += fs.statSync(fullPath).size;
      officialFiles.add(relativePath);
    }
  };
  walkOfficial(officialDir);
  assert(
    officialFileCount <= 5000,
    "official: plugin tree exceeds the official file limit",
  );
  assert(
    officialBytes <= 256 * 1024 * 1024,
    "official: plugin tree exceeds the official byte limit",
  );

  const expectedOfficial = new Set(officialLayoutFiles);
  for (const relativePath of expectedOfficial)
    assert(officialFiles.has(relativePath), `official: missing ${relativePath}`);
  for (const relativePath of officialFiles)
    assert(
      expectedOfficial.has(relativePath),
      `official: unexpected file ${relativePath}`,
    );

  const officialRelative = (relativePath) =>
    path.join("build", "official", "plugins", plugin.name, relativePath);

  const officialPackage = readJson(officialRelative("package.json"));
  assert(officialPackage.name === plugin.name, "official: package name differs");
  assert(
    officialPackage.version === packageJson.version,
    "official: package version differs",
  );
  assert(
    officialPackage.private === true,
    "official: package must stay private",
  );

  const officialManifest = readJson(
    officialRelative(path.join(".zcode-plugin", "plugin.json")),
  );
  assert(
    JSON.stringify(canonicalize(officialManifest)) ===
      JSON.stringify(canonicalize(plugin)),
    "official: plugin manifest is stale",
  );
  const officialDistManifest = readJson(
    officialRelative(path.join("dist", "plugin.json")),
  );
  assert(
    JSON.stringify(canonicalize(officialDistManifest)) ===
      JSON.stringify(canonicalize(plugin)),
    "official: generated manifest copy is stale",
  );
  const officialHooks = readJson(
    officialRelative(path.join("hooks", "hooks.json")),
  );
  assert(
    JSON.stringify(canonicalize(officialHooks)) ===
      JSON.stringify(canonicalize(hooks)),
    "official: hooks declaration is stale",
  );

  const officialEntry = fs.readFileSync(
    path.join(officialDir, "dist", "hooks", "entry.mjs"),
    "utf8",
  );
  assert(
    officialEntry.startsWith(
      `// Generated from ${plugin.name} v${packageJson.version}`,
    ),
    "official: bundle lacks a provenance header",
  );

  for (const relativePath of officialFiles) {
    const contents = fs.readFileSync(
      path.join(officialDir, relativePath),
      "utf8",
    );
    assert(
      !credentialPattern.test(contents),
      `Possible credential in official ${relativePath}`,
    );
  }
}

if (!officialMode) {
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
}

const validatedScopes = [
  "manifests",
  "hooks",
  ...(artifactMode ? ["artifacts"] : []),
  ...(officialMode ? ["official layout"] : []),
  "credential hygiene",
].join(", ");
process.stdout.write(
  `Validated ${plugin.name}@${plugin.version}: ${validatedScopes}.\n`,
);
