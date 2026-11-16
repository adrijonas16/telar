# ADR 0003: Pure core, graph model and vendored reference validator

- Status: accepted
- Date: 2026-11-16

## Context

Users edit a visual graph, but the deliverable is a strict data format consumed by the
reference runtime. A validator that disagrees with the runtime is worse than none.

## Decision

1. All domain logic lives in `src/core/`: framework-free, DOM-free TypeScript, enforced by
   lint rules. The UI calls it through one `StudioController`.
2. The editable model is a graph (`nodes`, `edges` by id, `frontAgentId`); the published files
   are derived from it, never edited directly. Unknown fields are preserved for lossless
   round trips.
3. Edits are pure commands `(doc, ...) => doc`, giving undo/redo and unit tests for free.
4. The reference runtime's own validator (`validation.gen.mjs`, `graph.gen.mjs`, Apache-2.0)
   is vendored unchanged and runs as one rule among Telar's specification rules.

## Consequences

- If Telar says "conforming", the reference runtime's gate passes too.
- Rules can be reused headless, for example as a CLI or CI check for any agentic site.
- The vendored files must be refreshed when the challenge repository updates them (see
  `src/core/validate/vendor/README.md`).
