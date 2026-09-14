# Releasing

This repository ships a ZCode plugin through two generated distribution
outputs: a versioned ZIP artifact and a catalog-ready plugin layout. Source
code stays in Git; the default `npm run package:plugin` command builds `dist/`
once, validates the manifests, Hook events, and credential hygiene, and leaves
both outputs ready. The ZIP itself is compressed by the tagged release
workflow.

## Prepare a release

1. Create a release branch from the default branch.
2. Choose a SemVer version and update it in all five locations:
   - `package.json`
   - `package-lock.json`
   - `.zcode-plugin/plugin.json`
   - `.claude-plugin/plugin.json`
   - `marketplace.json`
3. Update `CHANGELOG.md` by moving the relevant `Unreleased` entries into a
   dated release section.
4. Install from the lockfile and run the package gate:

   ```bash
   npm ci
   npm run check
   npm run package:plugin
   git diff --check
   ```

5. Inspect the generated `dist/` marketplace tree. It should contain the
   plugin manifest, Hook declaration, bundled runtime, third-party notices,
   and the marketplace manifest. It must not contain credentials, prompts,
   transcripts, or local state.
6. Open a pull request and wait for every CI matrix job to pass.

Everything under `dist/` is generated. It is intentionally ignored by Git and
must not be added to a source pull request; `dist/` itself is both the local
marketplace directory and the input for the reviewed marketplace
synchronization.

## Publish

Pushing an annotated tag such as `v0.2.0` runs `.github/workflows/release.yml`.
That workflow runs the unified package build, compresses the `dist/`
marketplace tree, and uploads the release assets, named
`<plugin>-v<version>.zip` plus its `.sha256` checksum:

```text
zcode-plugin-honcho-v0.2.1.zip
zcode-plugin-honcho-v0.2.1.zip.sha256
```

The official ZCode marketplace catalog requires an in-tree source in the form
`./plugins/<name>`. Use the generated `dist/plugins/zcode-plugin-honcho/`
directory (the `dist/` tree is itself a marketplace shell) as the input for a
separate reviewed catalog change. Do not replace this with a ZIP URL: the root
`marketplace.json` remains a local-development catalog pointing at
`./dist/plugins/<name>`. Run `npm run build` before installing the
local-development catalog.

After publishing:

1. Install the exact version in a clean ZCode session.
2. Run a prompt/stop smoke test.
3. Confirm session-start recall stays inside the configured character cap,
   Hook stdout remains protocol JSON, and a simulated upload failure keeps the
   turn pending in the outbox for the next retry.

Do not include Honcho credentials or real user content in release notes,
artifacts, screenshots, or smoke-test fixtures.

## Sync the catalog fork

Push the catalog-ready layout to the `erlinerd/zcode-plugins` fork without
manual copying:

```bash
npm run sync:catalog -- \
  --repo /path/to/zcode-plugins \
  --branch feat/zcode-plugin-honcho
```

The command validates the layout, mirrors the plugin tree into the fork's
`plugins/` directory, upserts the fork's `marketplace.json` entry from the
generated shell manifest, and commits `chore(catalog): sync
zcode-plugin-honcho vX.Y.Z`. Add `--push` to push the branch; add `--dry-run`
to print the plan without touching the fork. Repeat runs against an unchanged
fork are no-ops.

Pushing a version tag also runs `.github/workflows/catalog-sync.yml`, which
performs the same sync automatically against a fork clone created from the
`CATALOG_SYNC_PAT` secret (a fine-grained PAT with `Contents: Read and write`
access to `erlinerd/zcode-plugins`).
