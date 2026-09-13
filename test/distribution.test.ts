import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test, vi } from "vitest";

vi.setConfig({ testTimeout: 180_000 });

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginName = "zcode-plugin-honcho";
const officialDir = join(repoRoot, "build", "official", "plugins", pluginName);
const zipPath = join(repoRoot, "artifacts", "plugin.zip");

const pluginVersion = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
).version as string;

const expectedOfficialFiles = [
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
]
  .map((item) => item.split("/").join(sep))
  .sort();

function runScript(name: string, args: string[] = []): string {
  return execFileSync(
    process.execPath,
    [join(repoRoot, "scripts", name), ...args],
    { cwd: repoRoot, encoding: "utf8" },
  );
}

function runScriptExpectFailure(name: string, args: string[]): Error {
  try {
    runScript(name, args);
  } catch (error) {
    return error as Error;
  }
  throw new Error(`Expected ${name} ${args.join(" ")} to fail`);
}

function errorText(error: unknown): string {
  const candidate = error as { stderr?: unknown; message?: unknown };
  return `${String(candidate.stderr ?? "")}${String(candidate.message ?? "")}`;
}

function listFiles(directory: string): string[] {
  const files: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else files.push(relative(directory, fullPath));
    }
  };
  walk(directory);
  return files.sort();
}

function git(forkDir: string, ...gitArgs: string[]): string {
  return execFileSync("git", ["-C", forkDir, ...gitArgs], {
    encoding: "utf8",
  }).trim();
}

function initFork(): string {
  const forkDir = mkdtempSync(join(tmpdir(), "official-fork-"));
  git(forkDir, "init", "-b", "main");
  git(forkDir, "config", "user.email", "test@example.com");
  git(forkDir, "config", "user.name", "Distribution Test");
  mkdirSync(join(forkDir, "plugins"), { recursive: true });
  writeFileSync(
    join(forkDir, "marketplace.json"),
    `${JSON.stringify(
      {
        name: "zcode-plugins",
        description: "Test fork of the official catalog.",
        owner: { name: "test" },
        plugins: [
          {
            name: "example-plugin",
            description: "Existing entry.",
            source: "./plugins/example-plugin",
            version: "1.0.0",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  git(forkDir, "add", "-A");
  git(forkDir, "commit", "-m", "init");
  return forkDir;
}

function fakeValidateRoot(): { fakeRoot: string; officialTree: string } {
  const fakeRoot = mkdtempSync(join(tmpdir(), "validate-root-"));
  for (const relativePath of [
    "package.json",
    "package-lock.json",
    "marketplace.json",
    "hooks/hooks.json",
    ".zcode-plugin/plugin.json",
  ]) {
    const destination = join(fakeRoot, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(repoRoot, relativePath), destination);
  }
  const officialTree = join(
    fakeRoot,
    "build",
    "official",
    "plugins",
    pluginName,
  );
  cpSync(officialDir, officialTree, { recursive: true });
  return { fakeRoot, officialTree };
}

describe("official-layout distribution", () => {
  test("canonical build produces the official layout", () => {
    runScript("build.mjs");

    expect(listFiles(officialDir)).toEqual(expectedOfficialFiles);

    const entry = readFileSync(
      join(officialDir, "dist", "hooks", "entry.mjs"),
      "utf8",
    );
    expect(
      entry.startsWith(`// Generated from ${pluginName} v${pluginVersion}`),
    ).toBe(true);
    expect(readFileSync(join(repoRoot, "dist", "hooks", "entry.mjs"))).toEqual(
      readFileSync(join(officialDir, "dist", "hooks", "entry.mjs")),
    );

    const officialPackage = JSON.parse(
      readFileSync(join(officialDir, "package.json"), "utf8"),
    );
    expect(officialPackage).toMatchObject({
      name: pluginName,
      version: pluginVersion,
      license: "MIT",
      private: true,
      type: "module",
    });
  });

  test("failed build leaves no publishable official tree", () => {
    const fakeRoot = mkdtempSync(join(tmpdir(), "build-root-"));
    try {
      // A complete input tree except THIRD_PARTY_NOTICES.md, whose absence
      // fails a late copy and simulates a mid-build failure.
      for (const relativePath of [
        "package.json",
        ".zcode-plugin/plugin.json",
        "hooks/hooks.json",
        "README.md",
        "README.zh-CN.md",
        "LICENSE",
      ]) {
        const destination = join(fakeRoot, relativePath);
        mkdirSync(dirname(destination), { recursive: true });
        cpSync(join(repoRoot, relativePath), destination);
      }
      mkdirSync(join(fakeRoot, "src", "hooks"), { recursive: true });
      writeFileSync(join(fakeRoot, "src", "hooks", "entry.ts"), "export {};\n");

      const error = runScriptExpectFailure("build.mjs", ["--root", fakeRoot]);
      expect(errorText(error)).toContain("THIRD_PARTY_NOTICES");
      expect(
        existsSync(join(fakeRoot, "build", "official", "plugins", pluginName)),
      ).toBe(false);
      expect(
        existsSync(join(fakeRoot, "build", "official", `.staging-${pluginName}`)),
      ).toBe(false);
    } finally {
      rmSync(fakeRoot, { recursive: true, force: true });
    }
  });

  test("official validation passes on the canonical build", () => {
    const stdout = runScript("validate.mjs", ["--official"]);
    expect(stdout).toContain("official layout");
    expect(stdout).toContain(pluginName);
  });

  test("release ZIP archives the official layout verbatim", () => {
    const stdout = runScript("package-plugin.mjs");
    const summary = JSON.parse(stdout) as {
      plugin: string;
      version: string;
      sha256: string;
    };
    expect(summary).toMatchObject({
      plugin: pluginName,
      version: pluginVersion,
    });

    const digest = createHash("sha256")
      .update(readFileSync(zipPath))
      .digest("hex");
    expect(summary.sha256).toBe(digest);

    const extracted = mkdtempSync(join(tmpdir(), "plugin-zip-"));
    try {
      execFileSync("unzip", ["-q", zipPath, "-d", extracted]);
      const unpackedDir = join(extracted, pluginName);
      expect(listFiles(unpackedDir)).toEqual(expectedOfficialFiles);
      for (const relativePath of expectedOfficialFiles) {
        expect(readFileSync(join(unpackedDir, relativePath))).toEqual(
          readFileSync(join(officialDir, relativePath)),
        );
      }
    } finally {
      rmSync(extracted, { recursive: true, force: true });
    }
  });

  test("artifact validation still passes", () => {
    const stdout = runScript("validate.mjs", ["--artifact"]);
    expect(stdout).toContain(pluginName);
  });

  test("sync dry-run prints the plan without touching the fork", () => {
    const forkDir = initFork();
    try {
      const stdout = runScript("sync-official.mjs", [
        "--dir",
        forkDir,
        "--branch",
        "feat/zcode-plugin-honcho",
        "--dry-run",
      ]);
      expect(stdout).toContain("dry run: no changes were made");
      expect(stdout).toContain(`chore: sync ${pluginName} v${pluginVersion}`);
      expect(existsSync(join(forkDir, "plugins", pluginName))).toBe(false);
    } finally {
      rmSync(forkDir, { recursive: true, force: true });
    }
  });

  test("sync copies the canonical tree and registers the catalog entry", () => {
    const forkDir = initFork();
    try {
      runScript("sync-official.mjs", [
        "--dir",
        forkDir,
        "--branch",
        "feat/zcode-plugin-honcho",
        "--no-push",
      ]);

      const copiedManifest = JSON.parse(
        readFileSync(
          join(forkDir, "plugins", pluginName, ".zcode-plugin", "plugin.json"),
          "utf8",
        ),
      );
      expect(copiedManifest.version).toBe(pluginVersion);

      const marketplace = JSON.parse(
        readFileSync(join(forkDir, "marketplace.json"), "utf8"),
      );
      const entry = marketplace.plugins.find(
        (item: { name: string }) => item.name === pluginName,
      );
      expect(entry).toMatchObject({
        source: `./plugins/${pluginName}`,
        version: pluginVersion,
      });
      expect(
        marketplace.plugins.some(
          (item: { name: string }) => item.name === "example-plugin",
        ),
      ).toBe(true);

      expect(git(forkDir, "branch", "--show-current")).toBe(
        "feat/zcode-plugin-honcho",
      );
      expect(git(forkDir, "log", "-1", "--format=%s")).toBe(
        `chore: sync ${pluginName} v${pluginVersion}`,
      );
      expect(git(forkDir, "status", "--porcelain")).toBe("");
    } finally {
      rmSync(forkDir, { recursive: true, force: true });
    }
  });

  test("repeat sync against an unchanged fork is a no-op", () => {
    const forkDir = initFork();
    try {
      const syncArgs = [
        "--dir",
        forkDir,
        "--branch",
        "feat/zcode-plugin-honcho",
        "--no-push",
      ];
      runScript("sync-official.mjs", syncArgs);
      const headBefore = git(forkDir, "rev-parse", "HEAD");
      const stdout = runScript("sync-official.mjs", syncArgs);
      expect(stdout).toContain("already up to date");
      expect(git(forkDir, "rev-parse", "HEAD")).toBe(headBefore);
    } finally {
      rmSync(forkDir, { recursive: true, force: true });
    }
  });

  test("official validation rejects a stale generated manifest copy", () => {
    const { fakeRoot, officialTree } = fakeValidateRoot();
    const manifestPath = join(officialTree, "dist", "plugin.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.version = "0.0.0";
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const error = runScriptExpectFailure("validate.mjs", [
      "--official",
      "--root",
      fakeRoot,
    ]);
    expect(errorText(error)).toContain("stale");
    rmSync(fakeRoot, { recursive: true, force: true });
  });

  test("official validation rejects unexpected files and symlinks", () => {
    const stray = fakeValidateRoot();
    writeFileSync(join(stray.officialTree, "STRAY.txt"), "stray");
    const strayError = runScriptExpectFailure("validate.mjs", [
      "--official",
      "--root",
      stray.fakeRoot,
    ]);
    expect(errorText(strayError)).toContain("unexpected file");
    rmSync(stray.fakeRoot, { recursive: true, force: true });

    const linked = fakeValidateRoot();
    symlinkSync(
      join(linked.officialTree, "package.json"),
      join(linked.officialTree, "link.json"),
    );
    const linkError = runScriptExpectFailure("validate.mjs", [
      "--official",
      "--root",
      linked.fakeRoot,
    ]);
    expect(errorText(linkError)).toContain("symlink");
    rmSync(linked.fakeRoot, { recursive: true, force: true });
  });

  test("official validation rejects a missing bundle", () => {
    const { fakeRoot, officialTree } = fakeValidateRoot();
    rmSync(join(officialTree, "dist", "hooks", "entry.mjs"));
    const error = runScriptExpectFailure("validate.mjs", [
      "--official",
      "--root",
      fakeRoot,
    ]);
    expect(errorText(error)).toContain("missing");
    rmSync(fakeRoot, { recursive: true, force: true });
  });

  test("official validation rejects credential markers", () => {
    const { fakeRoot, officialTree } = fakeValidateRoot();
    const packagePath = join(officialTree, "package.json");
    const officialPackage = JSON.parse(readFileSync(packagePath, "utf8"));
    officialPackage.description = "token sk-abcdef1234567890abcd";
    writeFileSync(packagePath, JSON.stringify(officialPackage, null, 2));
    const error = runScriptExpectFailure("validate.mjs", [
      "--official",
      "--root",
      fakeRoot,
    ]);
    expect(errorText(error)).toContain("credential");
    rmSync(fakeRoot, { recursive: true, force: true });
  });
});
