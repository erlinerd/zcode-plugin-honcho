# Local outbox and session state

Status: ready-for-agent
Type: task
Blocked by: 01

## Question

How does the plugin retain turns across short-lived process hooks without
creating duplicates?

## Deliverables

- Hashed per-session state files.
- Atomic writes and restrictive file modes.
- Append-only pending outbox entries.
- Idempotent enqueue and remove-after-success operations.
- Locking for concurrent hooks.

## Acceptance

- Duplicate keys are stored once.
- Failed delivery remains pending.
- Successful delivery removes exactly one item.
- Corrupt files fail safely without exposing content.
