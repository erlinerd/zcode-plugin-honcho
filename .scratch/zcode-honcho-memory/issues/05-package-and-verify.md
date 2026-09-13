# Package and verify the plugin

Status: ready-for-agent
Type: task
Blocked by: 04

## Question

Can the plugin be installed from a clean ZCode marketplace and verified without
runtime dependencies outside its bundle?

## Deliverables

- Strict TypeScript build and bundled SDK entrypoint.
- Manifest and hook validation.
- ZIP packaging and checksum.
- Smoke-test documentation.
- Full unit and artifact validation.

## Acceptance

- `npm run check` passes.
- `npm run package:plugin` passes.
- Clean artifact contains manifests, hooks, bundle, and required source map only.
- Reference Langfuse repository remains unchanged.
