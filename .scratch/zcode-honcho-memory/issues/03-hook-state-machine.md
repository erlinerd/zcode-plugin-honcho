# Hook state machine

Status: ready-for-agent
Type: task
Blocked by: 02

## Question

How does the plugin correlate ZCode lifecycle payloads into a bounded memory
turn?

## Deliverables

- Payload alias parsing and validation.
- `SessionStart` initialization and pending flush.
- `UserPromptSubmit` prompt capture.
- `Stop` turn enqueue and bounded flush.
- Fail-open error boundary and protocol-only stdout.

## Acceptance

- Valid prompt plus assistant output becomes one memory turn.
- Missing or malformed fields do not block ZCode.
- Capture-disabled mode retains no message content.
- `SessionStart` emits valid additional context only when recall succeeds.
