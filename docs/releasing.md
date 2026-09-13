# Releasing

This repository ships a ZCode plugin through a versioned ZIP artifact rather
than as an npm runtime package. Source code stays in Git; CI builds `dist/`,
packages the required files, calculates a SHA-256 checksum, and uploads the ZIP
for the release.

## Prepare a release

1. Create a release branch from the default branch.
2. Choose a SemVer version and update it in all four locations:
   - `package.json`
   - `package-lock.json`
   - `.zcode-plugin/plugin.json`
   - `marketplace.json`
3. Update `CHANGELOG.md` by moving the relevant `Unreleased` entries into a
   dated release section.
4. Install from the lockfile and run the package gate:

   ```bash
   npm ci
   npm run check
   npm run package:plugin
   (cd artifacts && shasum -a 256 -c plugin.zip.sha256)
   git diff --check
   ```

5. Inspect the ZIP contents. It is an archive of the official-layout
   directory and must contain only plugin metadata and documentation, the
   plugin manifest, the Hook declaration, the bundled runtime, license files,
   and third-party notices. It must not contain source credentials, prompts,
   transcripts, or local state.
6. Open a pull request and wait for every CI matrix job to pass.

`dist/`, `build/`, and `artifacts/` are generated directories. They are
intentionally ignored by Git and must not be added to a source pull request.

## Publish

Pushing an annotated tag such as `v0.2.0` runs `.github/workflows/release.yml`.
That workflow builds and uploads these release assets:

```text
plugin.zip
plugin.zip.sha256
```

## Official marketplace sync

The canonical build output is the official-layout plugin directory under
`build/official/plugins/zcode-plugin-honcho/`. The release ZIP is an archive
of that exact directory, and the official catalog submission is a copy of it;
neither consumer rebuilds the runtime or maintains a second implementation.

After a release is tagged and published:

1. `npm ci`
2. `npm run dist`
3. `npm run sync-official -- --dry-run`
4. `npm run sync-official`

`sync-official` copies the canonical directory into a local fork of
`zai-org/zcode-plugins` (default `~/Code/Projects/zcode-plugins`, override
with `--dir`), upserts the fork's root `marketplace.json` entry with
`source: "./plugins/zcode-plugin-honcho"` and the release version, commits as
`chore: sync zcode-plugin-honcho vX.Y.Z`, and pushes the sync branch. Pass
`--no-push` to stop before the push and `--allow-dirty` to skip the
clean-tree guard. Repeat runs against an unchanged fork are no-ops.

The official catalog rejects entries whose source is not an in-tree
`./plugins/<name>` directory, so the submission must always be this copied
plugin tree; ZIP-URL catalog entries cannot pass the official validator.

The repository's root `marketplace.json` remains a local-development catalog
using `source: "."`; run `npm run build` before installing it from a local
directory.

After publishing:

1. Install the exact version in a clean ZCode session.
2. Run a prompt/stop smoke test.
3. Confirm session-start recall stays inside the configured character cap,
   Hook stdout remains protocol JSON, and a simulated upload failure keeps the
   turn pending in the outbox for the next retry.

Do not include Honcho credentials or real user content in release notes,
artifacts, screenshots, or smoke-test fixtures.
