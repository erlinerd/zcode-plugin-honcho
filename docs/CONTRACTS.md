# Contract Checklist

## `src/domain/types.ts`

- `HookPayload`: unknown ZCode hook JSON with supported aliases.
- `MemoryTurn`: bounded user/assistant data plus deterministic idempotency key.
- `MemoryContext`: bounded model-visible context.
- `HonchoClient.addTurn(turn)`: remote write; rejects on transport/API failure.
- `HonchoClient.getContext(input)`: remote recall; rejects on transport/API failure.
- `OutboxStore.enqueue(turn)`: atomic idempotent local append.
- `OutboxStore.pending()`: returns pending entries in stable order.
- `OutboxStore.remove(key)`: removes one successfully delivered entry.
- `SessionStore.load/save/clear`: per-ZCode-session state with bounded fields.

## Error and concurrency contract

- Remote adapters reject; the application layer decides whether to retry or fail
  open.
- Outbox keys are unique, so repeated `Stop` events cannot duplicate a turn.
- Session state is isolated by a hashed `session_id` and protected by a lock.
- No method returns an unbounded string to a ZCode hook.
- Hook stdout is emitted only by the entrypoint after all recoverable work is
  complete.
- Pending flushes run under a per-event time budget (2s at `SessionStart`,
  15s at `Stop`); entries past the budget stay pending for the next retry.
