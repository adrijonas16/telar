# ADR 0002: Web Components with Lit, TypeScript and Vite

- Status: accepted
- Date: 2026-11-16

## Context

The UI needs reusable components, but the project's theme is open web standards and its
output must be embeddable in arbitrary sites (the reference runtime is framework-free ES
modules).

## Decision

- **Components:** standard Custom Elements with Shadow DOM, written with Lit (~5 kB) for
  reactive templates.
- **Language:** TypeScript in strict mode (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`).
- **Tooling:** Vite for dev/build, Vitest for tests, ESLint (typescript-eslint) and Prettier.
- **Native platform features** before libraries: `<dialog>`, the Popover API, SVG for the
  graph, `ResizeObserver`, Pointer Events.

## Consequences

- Components work in any page or framework, which matters when Telar's widgets get embedded
  in agentic sites.
- Small bundle (~31 kB gzipped for the whole app).
- Fewer ready-made widgets than React ecosystems; the graph canvas is custom SVG.
