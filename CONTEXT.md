# Context: ZCode Honcho Memory

Glossary of domain terms used in issues, code, and reviews. Use these exact
words; do not drift to synonyms.

## Terms

- **ZCode session** (`session_id`): one ZCode conversation. Never sent to
  Honcho verbatim; always hashed before it becomes a Honcho session ID.
- **Honcho session** (`honchoSessionId`): `zcode-` + first 32 hex chars of
  sha256(session_id). Deterministic; same ZCode session maps to the same
  Honcho session across restarts.
- **Peer**: a Honcho identity that owns messages. Exactly two per turn: the
  configured user peer (the human) and the assistant peer (default `zcode`).
- **Workspace**: the Honcho workspace that scopes peers and sessions. Shared
  workspaces are what make memory cross-agent.
- **Turn** (`MemoryTurn`): one bounded user prompt plus one bounded assistant
  response, with timestamps and a deterministic idempotency key.
- **Idempotency key**: sha256(session_id + ":" + turnId). The outbox dedupe
  key; repeated Stop events enqueue a turn once.
- **Outbox**: local append-only JSON store of undelivered turns. Atomic
  writes, unique keys, survives restarts. Delivery removes exactly one entry.
- **Session state**: per-session JSON record (turnId, captured prompt,
  startedAt) persisted between UserPromptSubmit and Stop. Lock-protected,
  cleared after the turn is enqueued.
- **Bounded**: truncated to a configured character cap before storage
  (`max_capture_chars`) or injection (`max_context_chars`). No method returns
  an unbounded string to a hook.
- **Recall**: fetching peer context from Honcho at SessionStart and injecting
  it as `hookSpecificOutput.additionalContext`. Recall failures degrade to
  `{}`, never to an error.
- **Flush**: delivering pending outbox turns to Honcho. Runs under a
  per-event time budget (2s at SessionStart, 15s at Stop); unattempted or
  failed entries stay pending.
- **Fail-open**: every error path — missing config, malformed payload, local
  persistence failure, Honcho failure — exits 0 with protocol-only stdout.
  Memory failures must never block a ZCode turn.

## File structure

- `src/domain` — pure types, bounds, extraction. No I/O.
- `src/application` — config resolution, MemoryTracker state machine.
- `src/adapters` — Honcho SDK client, JSON stores, file locking.
- `src/hooks` — the single entrypoint that talks protocol JSON to ZCode.
