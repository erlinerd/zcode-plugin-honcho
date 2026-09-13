# Agent Instructions

- This repository is a standalone ZCode-to-Honcho memory plugin.
- Keep the plugin fail-open: memory failures must not block ZCode.
- Do not read hidden chain-of-thought or upload successful tool payloads by default.
- Keep stdout valid ZCode hook JSON; diagnostics belong on stderr.
- Use Node.js 20+, TypeScript strict mode, Vitest, and the official Honcho SDK.
- Run `npm run check` before claiming completion.
- Never commit API keys, private transcripts, generated artifacts, or `.pi/` state.

## Agent skills

### Issue tracker

Issues and specs live as local Markdown files under `.scratch/<feature-slug>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repository. See `docs/agents/domain.md`.
