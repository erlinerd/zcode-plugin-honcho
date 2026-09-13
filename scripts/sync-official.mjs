import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const defaultForkDir = join(homedir(), "Code", "Projects", "zcode-plugins");
const defaultBranch = "feat/zcode-plugin-honcho";

function usage() {
  process.stdout.write(
    [
      "Usage: node scripts/sync-official.mjs [options]",
      "",
      "Copy the canonical official-layout build into a local fork of the",
      "official ZCode plugin catalog, upsert the catalog entry, commit, and",
      "push a sync branch.",
      "",
      "Options:",
      `  --dir <path>      Local fork checkout (default: ${defaultForkDir})`,
      `  --branch <name>   Sync branch (default: ${defaultBranch})`,
      "  --dry-run         Print the plan without touching the fork",
      "  --no-push         Commit locally but skip git push",
      "  --allow-dirty     Proceed even when the fork worktree is dirty",
      "  --help            Show this help",
      "",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const options = {
    dir: defaultForkDir,
    branch: defaultBranch,
    dryRun: false,
    noPush: false,
    allowDirty: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dir") {
      options.dir = resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (value === "--branch") {
      options.branch = argv[index + 1] ?? "";
      index += 1;
    } else if (value === "--dry-run") {
      options.dryRun = true;
    } else if (value === "--no-push") {
      options.noPush = true;
    } else if (value === "--allow-dirty") {
      options.allowDirty = true;
    } else if (value === "--help") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${value}`);
    }
  }
  if (!options.dir) throw new Error("--dir requires a path");
  if (!options.branch) throw new Error("--branch requires a name");
  if (!/^[A-Za-z0-9/._-]+$/.test(options.branch))
    throw new Error(`Invalid branch name: ${options.branch}`);
  return options;
}

function git(forkDir, gitArgs) {
  return execFileSync("git", ["-C", forkDir, ...gitArgs], {
    encoding: "utf8",
  }).trim();
}

function branchExists(forkDir, branch) {
  try {
    git(forkDir, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  async function readRepoJson(relativePath) {
    try {
      return JSON.parse(
        await readFile(resolve(repoRoot, relativePath), "utf8"),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Unable to read ${relativePath}: ${reason}`, {
        cause: error,
      });
    }
  }

  const packageJson = await readRepoJson("package.json");
  const pluginManifest = await readRepoJson(".zcode-plugin/plugin.json");
  const pluginName = pluginManifest.name;
  if (pluginName !== packageJson.name)
    throw new Error("Plugin manifest name differs from package.json");
  if (pluginManifest.version !== packageJson.version)
    throw new Error("Plugin manifest version differs from package.json");
  const version = packageJson.version;

  const canonicalDir = resolve(
    repoRoot,
    "build",
    "official",
    "plugins",
    pluginName,
  );
  if (!existsSync(canonicalDir))
    throw new Error(
      `Canonical build missing at build/official/plugins/${pluginName}; run npm run build first`,
    );
  execFileSync(
    process.execPath,
    [join(scriptDir, "validate.mjs"), "--official"],
    { stdio: "inherit" },
  );

  const forkDir = options.dir;
  if (!existsSync(join(forkDir, ".git"))) {
    process.stdout.write(
      [
        `Fork checkout not found at ${forkDir}`,
        "",
        "Initialize it once, then re-run this command:",
        `  gh repo fork zai-org/zcode-plugins --clone && mv zcode-plugins "${forkDir}"`,
        `  # or: git clone https://github.com/<you>/zcode-plugins "${forkDir}"`,
        "",
      ].join("\n"),
    );
    process.exit(1);
  }

  const targetDir = join(forkDir, "plugins", pluginName);
  const marketplacePath = join(forkDir, "marketplace.json");
  const commitMessage = `chore: sync ${pluginName} v${version}`;
  const hasBranch = branchExists(forkDir, options.branch);
  const checkoutCommand = hasBranch
    ? `git checkout ${options.branch}`
    : `git checkout -b ${options.branch}`;

  if (options.dryRun) {
    process.stdout.write(
      [
        `dry-run plan for ${pluginName} v${version}:`,
        `  1. ${checkoutCommand}`,
        `  2. replace ${targetDir} with build/official/plugins/${pluginName}`,
        `  3. upsert ${marketplacePath} entry (source ./plugins/${pluginName}, version ${version})`,
        `  4. git add -A && git commit -m "${commitMessage}"`,
        ...(options.noPush ? [] : [`  5. git push -u origin ${options.branch}`]),
        "dry run: no changes were made.",
        "",
      ].join("\n"),
    );
    return;
  }

  const status = git(forkDir, ["status", "--porcelain"]);
  if (status && !options.allowDirty)
    throw new Error(
      `Fork worktree is dirty; commit or stash first, or pass --allow-dirty:\n${status}`,
    );

  execFileSync(
    "git",
    [
      "-C",
      forkDir,
      ...(hasBranch
        ? ["checkout", options.branch]
        : ["checkout", "-b", options.branch]),
    ],
    { stdio: "inherit" },
  );

  await rm(targetDir, { recursive: true, force: true });
  await cp(canonicalDir, targetDir, { recursive: true });

  let marketplace;
  try {
    marketplace = JSON.parse(await readFile(marketplacePath, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${marketplacePath}: ${reason}`, {
      cause: error,
    });
  }
  if (!Array.isArray(marketplace.plugins))
    throw new Error(`No plugins array in ${marketplacePath}`);
  const existing = marketplace.plugins.find(
    (candidate) => candidate?.name === pluginName,
  );
  const nextEntry = {
    ...existing,
    name: pluginName,
    description: pluginManifest.description,
    source: `./plugins/${pluginName}`,
    version,
  };
  if (existing) {
    marketplace.plugins = marketplace.plugins.map((candidate) =>
      candidate?.name === pluginName ? nextEntry : candidate,
    );
  } else {
    marketplace.plugins = [...marketplace.plugins, nextEntry];
  }
  await writeFile(
    marketplacePath,
    `${JSON.stringify(marketplace, null, 2)}\n`,
    "utf8",
  );

  execFileSync("git", ["-C", forkDir, "add", "-A"], { stdio: "inherit" });
  let hasChanges;
  try {
    git(forkDir, ["diff", "--cached", "--quiet"]);
    hasChanges = false;
  } catch {
    hasChanges = true;
  }
  if (!hasChanges) {
    process.stdout.write(
      `already up to date: ${pluginName} v${version} matches the fork\n`,
    );
    return;
  }
  execFileSync("git", ["-C", forkDir, "commit", "-m", commitMessage], {
    stdio: "inherit",
  });
  if (options.noPush) {
    process.stdout.write(`committed ${commitMessage}; push skipped (--no-push)\n`);
    return;
  }
  execFileSync("git", ["-C", forkDir, "push", "-u", "origin", options.branch], {
    stdio: "inherit",
  });
  process.stdout.write(`pushed ${options.branch} to origin\n`);
}

await main();
