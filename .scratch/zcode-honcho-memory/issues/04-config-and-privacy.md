# Configuration and privacy controls

Status: ready-for-agent
Type: task
Blocked by: 03

## Question

How does an installation configure Honcho without leaking credentials or
accidentally exporting tool data?

## Deliverables

- ZCode `userConfig` and environment precedence.
- Hosted/self-hosted base URL validation.
- Explicit workspace and peer IDs.
- Capture, context, timeout, and debug controls.
- Redaction and bounded diagnostics.

## Acceptance

- Missing required values disable remote work without failure.
- Environment overrides stored options.
- Invalid URLs and limits fall back safely.
- Tests prove secrets never appear in hook output or diagnostics.
