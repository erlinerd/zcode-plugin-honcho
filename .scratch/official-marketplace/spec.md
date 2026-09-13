# Canonical Official-Layout Distribution Build

Status: ready-for-agent
Labels: ready-for-agent

## Problem Statement

The Honcho plugin currently has a source-oriented development tree, a generated
runtime bundle, and a release ZIP assembled by a separate packaging step. That
shape is sufficient for the personal marketplace and GitHub Releases, but it
does not provide one canonical tree matching the official ZCode marketplace
contract.

Without a canonical official-layout build, official-marketplace work can drift
in several ways:

- the runtime bundle can be built from a different input than the release ZIP;
- the official plugin directory can contain a manually maintained JavaScript
  implementation instead of the tested TypeScript implementation;
- plugin identity, version, localized descriptions, and hook declarations can
  disagree between the plugin manifest, the local marketplace, the release
  artifact, and the official catalog;
- generated manifests or intermediate directories can be copied inconsistently;
- a future sync command can push stale, partial, or unvalidated content.

The plugin must remain a fail-open ZCode memory plugin. This distribution change
must not alter the `SessionStart` Recall flow, `UserPromptSubmit` Session state,
`Stop` Turn creation, Outbox retry behavior, Honcho session mapping, Peer
attribution, capture bounds, or stdout protocol contract.

## Solution

Create exactly one canonical distribution build in the official ZCode plugin
layout. The build contains the complete plugin directory that can be copied
verbatim beneath the official marketplace's plugin collection:

- the ZCode-first plugin manifest;
- the Hook declaration;
- the bundled Node.js runtime with the official Honcho SDK included;
- the English and Chinese documentation;
- the license and third-party notices;
- minimal provenance metadata needed to identify the source version.

The canonical build is generated directly from the repository's TypeScript
source and approved metadata. It is the only build operation. A release ZIP is
just an archive of that exact directory, and official-marketplace sync is just a
validated copy of that exact directory plus the corresponding catalog entry.
Neither consumer rebuilds the runtime or maintains a second implementation.

The build adds a generated-source header containing the plugin version, cleans
stale output before generation, validates the official layout locally, and
fails loudly when metadata, hooks, bounds, or credential hygiene are invalid.
The existing personal marketplace remains usable for local installation, while
the official catalog receives an in-tree plugin entry whose source path follows
the official repository contract.

## User Stories

1. As a plugin maintainer, I want one canonical official-layout build, so that
   every distribution channel consumes the same tested runtime.
2. As a plugin maintainer, I want the build output to match the official ZCode
   plugin directory contract, so that it can be copied into the official
   marketplace without manual reshaping.
3. As a plugin maintainer, I want the build to bundle the official Honcho SDK,
   so that an installed official plugin does not require a runtime `npm install`.
4. As a plugin maintainer, I want the TypeScript source and SDK bundle to remain
   the only implementation, so that official-marketplace updates cannot drift
   from the personal release.
5. As a ZCode user, I want the official plugin's Hook command to resolve the
   bundled runtime relative to the plugin root, so that `SessionStart`,
   `UserPromptSubmit`, and `Stop` work after installation from the official
   catalog.
6. As a plugin maintainer, I want the plugin name and version to come from one
   validated metadata model, so that package metadata, plugin metadata, local
   marketplace metadata, release metadata, and official catalog metadata stay
   aligned.
7. As a plugin maintainer, I want localized descriptions to be preserved in the
   official layout, so that the official catalog does not lose the Chinese or
   English plugin description.
8. As a plugin maintainer, I want every generated bundle to declare its source
   version in a header, so that reviewers can distinguish generated runtime code
   from hand-written source.
9. As a plugin maintainer, I want stale generated files removed before a build,
   so that a previous version cannot remain installable beside the current one.
10. As a release maintainer, I want the Release ZIP to be made from the
    canonical official-layout directory, so that the ZIP and official-marketplace
    submission contain identical plugin bytes.
11. As a release maintainer, I want a SHA-256 checksum for the exact Release ZIP,
    so that consumers and CI can verify the published bytes.
12. As an official-marketplace maintainer, I want the synced plugin directory to
    be validated before any push, so that structural errors are caught locally.
13. As a plugin maintainer, I want official catalog registration generated from
    the same plugin metadata, so that the official source path, name, version,
    description, and category cannot silently diverge.
14. As a plugin maintainer, I want a dry-run sync mode, so that I can inspect the
    planned copy, catalog, commit, and push operations without changing a fork.
15. As a plugin maintainer, I want repeated syncs of unchanged content to be
    idempotent, so that rerunning a release workflow does not create empty or
    misleading commits.
16. As a plugin maintainer, I want sync to explain how to initialize a missing
    official-repository fork, so that first-time setup does not require reading
    the implementation.
17. As a plugin maintainer, I want sync to refuse dirty or unexpected target
    branches unless explicitly configured, so that unrelated fork work cannot be
    overwritten.
18. As a plugin maintainer, I want build and sync failures to return non-zero
    status with actionable diagnostics, so that a failed official update cannot
    look successful.
19. As a security reviewer, I want generated output checked for API keys,
    credentials, transcripts, hidden chain-of-thought, successful tool payloads,
    local state, and development-only files, so that the official marketplace
    cannot publish private data.
20. As a security reviewer, I want symlinks, oversized plugin trees, and
    unapproved files rejected, so that the official distribution boundary is
    explicit and safe.
21. As a plugin maintainer, I want third-party notices shipped with the bundle,
    so that the official artifact remains license-complete after SDK bundling.
22. As a plugin maintainer, I want the canonical build to work on Node.js 20 and
    newer, so that it follows the repository's supported toolchain.
23. As a plugin maintainer, I want tests to inspect build and packaging behavior
    through their external outputs, so that refactoring the bundler does not
    require rewriting implementation-detail tests.
24. As a future automation maintainer, I want a tag-triggered workflow to be
    able to consume the same canonical build, so that adding CI automation later
    does not introduce a second build path.
25. As a ZCode user, I want the runtime behavior to remain fail-open after this
    distribution change, so that a missing configuration, local persistence
    error, or Honcho failure still never blocks a ZCode turn.

## Implementation Decisions

- The highest-value test seam is the canonical official-layout build directory.
  It is the single source consumed by release packaging and official sync.
  Packaging and sync are distribution adapters around this seam, not additional
  build implementations.
- The existing TypeScript source, strict compiler settings, official Honcho SDK,
  domain vocabulary, and runtime module boundaries remain in place. No source
  rewrite to hand-authored JavaScript, dynamic SDK loading, or REST fallback is
  introduced for this feature.
- The canonical build command performs type validation, removes stale canonical
  output, bundles the Hook entry as self-contained Node.js ESM for Node.js 20,
  copies only approved static plugin files, and writes the generated provenance
  header. If source maps are retained, the bundle and its source map are treated
  as one generated pair and are included consistently in every distribution.
- The official layout is the installable plugin tree, not an intermediate
  source tree. Its Hook declaration must point only to the bundled runtime. It
  must not depend on repository source files, tests, `node_modules`, or a
  runtime package installation.
- The plugin manifest remains the ZCode contract. Build validation checks its
  name, version, license, localized descriptions, user configuration, and Hook
  event set against the repository metadata and local marketplace entry. A
  mismatch stops the build.
- The official catalog entry is generated or updated from the same validated
  plugin metadata. The local marketplace source remains the local-development
  form; the official catalog source uses the official repository's in-tree
  plugin form. These are two catalog consumers of one plugin identity, not two
  plugin implementations.
- Release packaging archives the canonical official-layout directory without
  rebuilding it. The archive must preserve the installable relative paths,
  exclude temporary staging directories, and emit a checksum for the resulting
  bytes.
- Official sync consumes an already-built and already-validated directory. It
  copies the plugin tree into the configured fork, updates the matching catalog
  registration, and uses a versioned commit message. It supports dry-run,
  configurable fork location, explicit branch selection, missing-fork guidance,
  and no-op behavior when the target already matches.
- Sync performs a final validation before push and refuses to push when the
  canonical build is absent, stale, structurally invalid, contains disallowed
  files, or disagrees with the catalog. Real network pushes are a manual smoke
  path rather than an automated unit-test dependency.
- Build output is created through a temporary directory and promoted only after
  all validation succeeds, or is otherwise removed on failure. A failed build
  must not leave a directory that looks publishable.
- Distribution hygiene is enforced over the complete canonical tree. The tree
  excludes credentials, prompts, transcripts, hidden chain-of-thought, tool
  payloads, session state, Outbox contents, `.pi` state, tests, dependencies,
  and unrelated repository files. Credential-pattern checks run over generated
  text and bundle output.
- Local validation mirrors the official marketplace's structural rules: exact
  in-tree source shape, kebab-case identity, unique registration, manifest
  alignment, supported metadata, file-count and byte limits, and no symlinks.
  When an official-repository checkout is available, its validator may provide
  an additional integration gate; the feature does not depend on network access
  for ordinary local build tests.
- The existing build and package commands remain usable for current personal
  marketplace and GitHub Release workflows. Any new distribution command is a
  wrapper or alias for the same canonical official-layout build, never a second
  runtime compilation path.
- Cross-repository CI automation and a fine-grained push credential are deferred
  until local build, package, validation, and dry-run sync behavior are proven.
  If added later, the workflow must consume the canonical directory and must not
  duplicate build logic.
- Runtime fail-open behavior is unchanged. Build-time errors fail the release
  operation loudly; Hook-time memory failures continue to emit only valid ZCode
  protocol output and exit successfully.

## Testing Decisions

- Good tests assert external behavior: generated tree contents, file presence and
  absence, manifest values, Hook target, provenance header, validation results,
  archive contents, checksum output, dry-run text, idempotence, and exit status.
  Tests do not assert esbuild calls, temporary-directory names, helper functions,
  or other implementation details.
- The primary seam test runs the canonical build from the current source and
  checks that the result is an official-layout plugin tree with a self-contained
  runtime, aligned metadata, approved documentation and notices, and no private
  or development-only files.
- The packaging test creates the Release ZIP from the canonical tree, extracts it
  into a temporary directory, and compares the extracted plugin tree with the
  canonical tree. It also verifies that the checksum names and validates the
  exact archive.
- The validation test covers name and version drift, missing or extra Hook
  events, stale manifest copies, invalid official source registration, symlinks,
  size limits, and credential markers. Each failure must have a non-zero exit
  status and an actionable message.
- The sync test uses a temporary target repository fixture. It verifies dry-run
  output without filesystem or git mutation, copies the exact canonical tree,
  updates the catalog entry, does nothing for an already synchronized version,
  and gives setup instructions when the target repository is absent.
- A failure-path test verifies that invalid metadata, a failed bundle, a missing
  required static file, or failed pre-push validation never leaves a publishable
  partial build.
- Existing Vitest conventions and the current manifest/artifact validation
  script are prior art. New tests should follow the repository's current test
  organization and should run under the Node.js 20 and 22 CI matrix.
- The complete acceptance gate remains `npm run check`, followed by canonical
  build validation, archive checksum verification, and a manual official-sync
  dry run. A real fork push is not required for every test run.

## Out of Scope

- Changes to the Honcho runtime state machine, Recall, Flush, Turn, Outbox,
  Session state, Peer attribution, Workspace configuration, or fail-open policy.
- Rewriting the plugin as a zero-build JavaScript implementation.
- Replacing the official Honcho SDK with a fetch-based implementation or adding
  a dynamic dependency/fallback strategy.
- Publishing the plugin as an npm runtime package.
- Changing the ZCode hook protocol or adding tool input/output capture.
- Reading transcript files or adding hidden chain-of-thought, prompt, or
  successful tool-payload collection.
- Guaranteeing that `zai-org/zcode-plugins` accepts or merges the submission.
- Automating a cross-repository push with a PAT in the first implementation.
- Changing the official marketplace's internal distribution service or its
  downstream CDN artifact builder.
- Version rollback, official catalog removal, or migration of already installed
  users.

## Further Notes

This spec supersedes the earlier proposal to maintain a manually translated
pure-JavaScript official copy. The accepted design direction is one tested
TypeScript/SDK source and one canonical official-layout build, with the Release
ZIP and official-marketplace PR as consumers.

The sister Langfuse repository is prior art for bundling the official SDK and
using an in-tree generated bundle. The official Mimosa plugin provides evidence
that a bundled payload can exist in the official catalog, but human review and
community-PR timing remain outside this repository's control.

The current repository has an existing generated runtime and release packager;
the implementation should migrate their output contract rather than duplicate
runtime behavior. The current untracked marketplace research remains historical
working material; this spec is the actionable, ready-for-agent decision.

Estimated implementation effort: about 1–2 hours if the existing packaging
helpers are reusable, plus 30–60 minutes for focused tests and a dry-run sync.
