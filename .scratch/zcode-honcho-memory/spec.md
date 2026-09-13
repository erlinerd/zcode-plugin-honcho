# ZCode Honcho Memory MVP

Status: ready-for-agent

## Outcome

ZCode sessions share a bounded, privacy-aware Honcho memory with other configured
agent integrations. New sessions receive a compact context, and completed turns
are eventually written to Honcho without blocking ZCode.

## Scope

- ZCode process hooks: `SessionStart`, `UserPromptSubmit`, `Stop`.
- Honcho TypeScript SDK v2 as the remote adapter.
- Stable configured workspace and user peer IDs.
- Deterministic hashed session mapping ("zcode-" + the first 32 hex chars of
  sha256(session_id)), so raw session IDs never leave the machine.
- Local atomic outbox with idempotent `(sessionId, turnId)` keys.
- Bounded `additionalContext` injection at session start.
- User prompts and final assistant responses only by default.
- Tool inputs and outputs out of scope.

## Acceptance gate

1. `npm run check` passes.
2. Missing configuration, malformed hook input, local persistence failures, and
   Honcho failures exit successfully and never block ZCode.
3. Duplicate Stop delivery does not duplicate a queued or delivered turn.
4. Pending outbox records survive a failed request and retry at the next
   `SessionStart`.
5. Context injection is valid ZCode protocol JSON and stays within its cap.
6. No secret, full transcript, hidden chain-of-thought, or successful tool
   payload is present in tests, fixtures, logs, or generated manifests.

## Implementation order

See `issues/01` through `issues/05`. Work is serial because the hook entry depends
on the adapter and persistence contracts.
