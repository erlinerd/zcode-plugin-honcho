# Test Checklist

Before implementation is considered complete:

- config precedence, defaults, invalid values, and missing required credentials;
- hook payload aliases and malformed payload handling;
- bounded prompt/assistant capture and disabled capture;
- session state persistence, atomic writes, and duplicate stop handling;
- outbox idempotency, ordering, retry retention, and successful removal;
- Honcho adapter message attribution, session mapping, context truncation, and
  remote error propagation;
- `SessionStart` context injection protocol;
- fail-open behavior for every hook event and remote failure;
- no key material in diagnostics or protocol output;
- package manifest, bundle, and artifact validation.
