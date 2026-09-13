# ZCode Honcho Memory — Plan Map

## Notes

This is a standalone plugin. `/Users/lei/Code/Projects/zcode-langfuse-plugin` is
reference-only and must not be modified.

## Decisions-so-far

- Use the official `@honcho-ai/sdk` v2.
- Use local Markdown issue tracking under `.scratch/`.
- Keep Honcho separate from Langfuse because memory and observability have
  different capture and latency policies.
- Prefer SessionStart recall and Stop writeback; do not recall over the network
  on every prompt by default.

## Frontier

`01-honcho-adapter.md` is the first unblocked implementation ticket.

## Fog

- Confirm the hosted/self-hosted Honcho workspace ID during installation.
- Validate the exact `transcript_path` payload on the user's ZCode build before
  adding optional transcript-tail capture.
