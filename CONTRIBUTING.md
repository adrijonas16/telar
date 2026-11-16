# Contributing to Telar

## Workflow

1. `npm install`, then `npm run dev`.
2. Keep `npm run check` green (typecheck, lint, tests) before every commit.
3. Use [Conventional Commits](https://www.conventionalcommits.org/): `feat(canvas): ...`,
   `fix(validate): ...`, `docs: ...`, `test: ...`.

## Rules of the codebase

- **Core stays pure.** Nothing in `src/core/` may touch the DOM, storage or Lit (lint-enforced).
- **Every edit is a command.** Add a pure function to `core/model/commands.ts`, expose an
  intent-level method on `StudioController`, then call it from a component.
- **Derive, don't store.** Published files and validation results are computed from the
  document, never cached in components.
- **New check = new rule + test.** Add the rule to a file in `core/validate/rules/`, register
  it in `core/validate/index.ts`, and cover both the passing and failing case.
- **Never edit `core/validate/vendor/`.** Refresh it from the upstream repository instead.
- **Accessibility.** Interactive SVG elements need a role, a label and keyboard support;
  every control needs a visible label.
