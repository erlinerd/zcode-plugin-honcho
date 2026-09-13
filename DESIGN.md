# Design

## Decision

Keep the plugin separate from the Langfuse repository. Langfuse is an
observability sink; Honcho is a memory backend. They have different capture
policies, failure budgets, and user-visible behavior.

## Reuse inventory

The Langfuse reference repository at
`/Users/lei/Code/Projects/zcode-langfuse-plugin` was inspected before writing:

- reuse the `TurnTracker` idea for correlating ZCode lifecycle payloads;
- reuse hashed, atomic local state and per-session locking;
- reuse a replaceable backend adapter seam;
- reuse fail-open hook entry and protocol-only stdout;
- do not reuse the Langfuse sink, trace terminology, or full tool-payload defaults.

Official references consulted:

- ZCode hooks: `SessionStart` and `UserPromptSubmit` can inject
  `hookSpecificOutput.additionalContext`; `Stop` can expose a temporary
  `transcript_path`; hook stdout must remain valid protocol JSON.
- Honcho: stable peers own cross-session representations; sessions contain
  attributed messages; derived context is asynchronous and should be treated as
  eventually consistent.
- Honcho's Codex integration: local outbox, retryable writeback, bounded startup
  recall, and stable session mapping are the right patterns to port.

## MVP boundary

1. `SessionStart`: flush pending local outbox entries, then request a bounded
   peer/session context and inject it if available.
2. `UserPromptSubmit`: retain only the bounded prompt in local session state.
3. `Stop`: pair the stored prompt with `last_assistant_message`, enqueue one
   idempotent turn, and attempt a bounded flush.
4. No tool input/output capture in v0.1. Only user prompts and final assistant
   responses are written to Honcho.
5. All remote errors, malformed payloads, and local persistence errors are
   recoverable and must not block the ZCode turn.

## Non-goals

- rewriting the user's prompt;
- uploading hidden chain-of-thought;
- replacing ZCode's native project memory;
- pretending remote memory is immediately consistent;
- creating a second MCP server inside the plugin.

## Data model

- Honcho workspace: explicit configuration, shared with other integrations.
- Honcho user peer: explicit stable `HONCHO_PEER_ID`.
- Honcho assistant peer: `zcode` by default.
- Honcho session: deterministic `zcode:<session_id>`.
- Local outbox key: deterministic `session_id:turn_id`.

## Safety

Secrets never appear in source, tests, stdout, diagnostics, or commit messages.
Remote content is bounded before stdout injection. Local files use mode `0700`
for directories and `0600` for data files.
