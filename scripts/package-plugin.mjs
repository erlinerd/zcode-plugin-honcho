import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactDir = resolve(root, "artifacts");
const stagingDir = resolve(artifactDir, ".staging");
const pluginManifestPath = resolve(root, ".zcode-plugin/plugin.json");
let pluginManifest;
try {
  pluginManifest = JSON.parse(await readFile(pluginManifestPath, "utf8"));
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  throw new Error(`Unable to read plugin manifest: ${reason}`, {
    cause: error,
  });
}
const pluginName = pluginManifest.name;
const archivePath = resolve(artifactDir, "plugin.zip");
const checksumPath = resolve(artifactDir, "plugin.zip.sha256");
const packageRoot = resolve(stagingDir, pluginName);

if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(pluginName))
  throw new Error(`Invalid plugin name: ${pluginName}`);

const canonicalDir = resolve(root, "build", "official", "plugins", pluginName);
try {
  await stat(canonicalDir);
} catch {
  throw new Error(
    `Canonical official build missing at build/official/plugins/${pluginName}; run npm run build first`,
  );
}

await rm(stagingDir, { recursive: true, force: true });
await rm(archivePath, { force: true });
await rm(checksumPath, { force: true });
await mkdir(packageRoot, { recursive: true });

// The ZIP is an archive of the canonical official-layout directory. It never
// re-reads repository source or rebuilds the runtime.
await cp(canonicalDir, packageRoot, { recursive: true });

try {
  execFileSync("zip", ["-X", "-q", "-r", archivePath, pluginName], {
    cwd: stagingDir,
    stdio: "inherit",
  });
} catch (error) {
  throw new Error("Unable to create plugin.zip; install zip first", {
    cause: error,
  });
}

const checksum = createHash("sha256")
  .update(await readFile(archivePath))
  .digest("hex");
await writeFile(checksumPath, `${checksum}  plugin.zip\n`);
await rm(stagingDir, { recursive: true, force: true });

process.stdout.write(
  `${JSON.stringify({
    plugin: pluginName,
    version: pluginManifest.version,
    archive: "artifacts/plugin.zip",
    sha256: checksum,
  })}\n`,
);
