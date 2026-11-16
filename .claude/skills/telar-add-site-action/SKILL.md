---
name: telar-add-site-action
description: Give Ask Telar (Telar's own agent) a new ability by adding a website_* site action end to end. Use when asked to let the assistant do something new on the canvas or in the studio.
---

# Add a site action to Ask Telar

Background: `docs/adr/0004-telar-is-an-open-agentic-website.md` and the official reference
`.claude/skills/agentify-website/references/site_actions.md`.

1. **Core first.** If the action changes the document, it must exist as a pure command in
   `src/core/model/commands.ts` (or a fix in `src/core/validate/fixes.ts`) with a test.
2. **Page object.** Add a method to `TelarPage` (`src/ui/page-api.ts`): plain-JSON input; check
   everything first and return `refuse(reason, field)` without changing anything; apply the
   change with `this.apply(doc, focusNodeId)` (one undo step, selects the piece, returns state).
   Address pieces like a person reads the canvas: agents by name, other pieces by URL.
3. **Action definition.** Add it to `definitions()` in `public/site-actions.js` with `name`
   (snake_case), `description` (what it does and returns; "only when the visitor asks" for
   writes), `effect` (`read` or `write`: everything is undoable, so never `irreversible`), a
   strict `inputSchema` (`additionalProperties: false`, length limits) and `execute`.
4. **Publish it.** Add the name to `actions.agentTools` in `public/agent-manifest.json` and
   mention `website_<name>` in `agent/telar_assistant.hocon`. Run `npm run build:agent`: it must
   end in `OK` with no `WARNING` (it checks names and the 5000-character budget).
5. **Test.** `tests/ui/page-api.test.ts` (works, refuses without change, undo restores) and
   `tests/agent/agentic-site.test.ts` (registers with the official runtime). `npm run check`.
6. **Try it.** `.claude/skills/telar-e2e` with a scripted model that calls the new action.
7. **Docs.** Update the action count in `README.md` and ADR 0004 if it changed.
