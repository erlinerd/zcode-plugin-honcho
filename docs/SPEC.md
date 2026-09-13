# MVP Specification

## User outcome

A ZCode user can start a new session and receive a small amount of relevant
Honcho context. At the end of a turn, the user and assistant messages are
stored for future cross-agent recall without blocking ZCode when Honcho is
unavailable.

## Acceptance criteria

- No configured API key/workspace/peer means the hook emits `{}` and exits 0.
- `SessionStart` never emits more than `maxContextChars` of context.
- A valid `SessionStart` context response is emitted as
  `hookSpecificOutput.additionalContext` with the matching event name.
- `UserPromptSubmit` stores a bounded prompt and never stores it when capture is
  disabled.
- `Stop` creates at most one outbox item for one `(sessionId, turnId)` pair.
- A failed remote write remains pending and is retried by a later hook.
- A successful retry removes the item from the pending queue.
- Invalid JSON, missing IDs, local state errors, and remote errors do not block a
  ZCode turn or write non-protocol data to stdout.
- Tool inputs and outputs are absent in the MVP.
- API keys do not appear in logs, diagnostics, tests, or generated manifests.

## Performance budget

- `SessionStart` remote recall timeout: 5 seconds.
- `Stop` remote flush timeout: 5 seconds.
- stdout context cap: 8,000 characters by default.
- local outbox writes are atomic and bounded to one turn per stop event.

## Compatibility

- Node.js 20+.
- ZCode process hooks using JSON stdin/stdout.
- Honcho TypeScript SDK v2.
