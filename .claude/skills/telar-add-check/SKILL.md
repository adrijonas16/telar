---
name: telar-add-check
description: Add or change a validation check in Telar (a rule in src/core/validate), optionally with a one-click fix. Use when asked to detect a new problem in agent networks, enforce a spec section, or add a "Fix" button for an issue.
---

# Add a validation check to Telar

Read `docs/ARCHITECTURE.md` (Validation) first. Checks are pure: `(ctx) => Issue[]`.

## 1. Decide

- **Severity:** `error` only when the published network would be rejected or unsafe (the
  reference runtime fails, the spec says MUST, a secret leaks). Otherwise `warning` (shown as a
  "tip"). Errors block "Conforming".
- **Source of truth:** if the official tools (`.claude/skills/agentify-website/scripts/build_network.mjs`,
  `check_partner.mjs`) already check this, use their exact criterion so Telar and the official
  tools never disagree (see `src/core/agentic/peer-rule.ts` for an example).
- **Spec reference:** find the section in the MVP spec and put it in `specRef` (e.g. `§3.2`).

## 2. Write the rule

Add it to the matching file in `src/core/validate/rules/` (network, agent, graph, capability,
security, agentic) or a new file, and register the array in `src/core/validate/index.ts`.

```ts
{
  code: "group.short-name",           // stable, kebab-case after the dot
  summary: "One line for the rules catalogue.",
  specRef: "§x.y",
  check: ({ doc, network, manifest }) => [ /* Issue[] */ ],
}
```

Each issue: `code`, `severity`, `source: "telar"`, `message` (plain English: what is wrong, why
it matters, what to do), `nodeId` when it is about one card, `specRef`.

## 3. Optional one-click fix

- Attach `fix: { id: "kebab-id", label: "Verb phrase" }` to the issue.
- Add the pure fix `(doc, issue) => doc` to `FIXES` in `src/core/validate/fixes.ts`.
- It must be idempotent and keep the user's content (append, don't overwrite).
- The UI's Fix buttons and Ask Telar's `website_apply_fix` pick it up automatically.

## 4. Test

Add tests in `tests/core/` (see `peer-rule.test.ts`): it fires, it stays quiet on the bakery
sample and on the three official examples (`tests/core/validate.test.ts` checks they have no
errors), and the fix works and is idempotent. Then `npm run check`.

## 5. Dogfood

`npm run check:agent` and `tests/agent/agentic-site.test.ts` run Telar's validator on Telar's
own published network: it must stay free of errors.
