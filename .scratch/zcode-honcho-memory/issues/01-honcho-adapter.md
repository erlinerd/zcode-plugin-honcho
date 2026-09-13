# Honcho adapter

Status: ready-for-agent
Type: task
Blocked by:

## Question

How does the plugin map a bounded turn to Honcho messages and retrieve a compact
peer context?

## Deliverables

- `HonchoClient` implementation backed by `@honcho-ai/sdk` v2.
- Deterministic `zcode:<session_id>` mapping.
- User and assistant peer creation/use.
- Bounded context formatting.
- Remote errors rejected for the application layer to handle.

## Acceptance

- A turn creates user/assistant messages with explicit attribution.
- Context retrieval never returns an unbounded string.
- No API key appears in errors or diagnostics.
- Unit tests cover SDK calls and failures with a fake SDK seam.
