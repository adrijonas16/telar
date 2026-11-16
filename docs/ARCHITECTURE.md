# Telar architecture

Telar is a static, browser-only web app. It has no backend: everything (editing, validation,
export) runs in the visitor's browser, the same principle the open agentic web applies to agents.

## Layers

```
┌──────────────────────────────────────────────────────────────────┐
│ ui/            Lit web components (presentation only)            │
│   telar-app ─┬─ telar-toolbar      telar-inspector               │
│              ├─ telar-canvas       └─ telar-schema-editor        │
│              ├─ telar-issues       telar-artifacts               │
│              └─ telar-import-dialog                              │
│   controller.ts   StudioController: the one application service  │
│   services/       browser I/O (downloads, fetch from sites)      │
├──────────────────────────────────────────────────────────────────┤
│ persistence/   draft autosave (localStorage, failure-tolerant)   │
├──────────────────────────────────────────────────────────────────┤
│ core/          pure TypeScript, no DOM, no framework             │
│   model/       types, factory, commands (pure doc → doc)         │
│   store/       observable store + undo/redo                      │
│   serialize/   graph ⇄ network.json, manifest, links             │
│   validate/    rule registry + vendored reference validator      │
│   layout/      layered auto-layout                               │
│   bundle/      site bundle + dependency-free ZIP writer          │
└──────────────────────────────────────────────────────────────────┘
```

Dependencies point downwards only. ESLint enforces it: `core/` cannot import `lit`, `ui/` or
`persistence/`, nor use `window`, `document` or `localStorage`.

## Data flow

```
user input ─► component ─► StudioController action ─► core command (pure)
                                                        │
                    Store.commit(newDoc) ◄──────────────┘
                         │  (history push, merged for drags/typing)
                         ▼
          controller: validate(doc) once ─► notify subscribers
                         │
                         ▼
     components re-render via StudioBinding (Lit ReactiveController)
```

- **Single source of truth.** One immutable `StudioDocument`. Components never hold copies.
- **Derived, never stored.** `network.json`, `agent-manifest.json`, `links.json` and the
  validation report are computed from the document. They cannot drift out of sync.
- **Undo for free.** Commands return new documents; the store keeps previous ones. Commits
  with the same `mergeKey` within one second (dragging a node, typing in a field) collapse
  into one undo step.

## The document model

The studio edits a **graph**, not the wire format:

| Concept       | In Telar                     | In the published network                                |
| ------------- | ---------------------------- | ------------------------------------------------------- |
| Agent         | `AgentNode`                  | entry of `tools[]`                                      |
| Call relation | `Edge {from, to}` by node id | name / URL / MCP descriptor in the caller's `tools`     |
| Peer network  | `PeerNode {url}`             | URL string in `tools`                                   |
| MCP server    | `McpNode {url, toolNames}`   | `{ "url", "tools" }` descriptor                         |
| Front agent   | `frontAgentId`               | `front_man` in the manifest; emitted first in `tools[]` |
| Layout        | `position` on nodes          | never published                                         |

Edges reference ids, so renaming an agent never breaks its connections.

### Lossless round trip

Neuro SAN networks carry many fields Telar does not edit (`aaosa_instructions`, `cruse`,
`commondefs`, coded tools...). Import keeps every unknown field (`extra`, `functionExtra`,
`metadataExtra`) and export writes it back. Unresolvable references are kept in
`unresolvedRefs` so validation can report them. The test suite round-trips the three official
examples of the challenge repository byte-for-byte (as JSON values).

## Validation

`validate(doc)` derives the artifacts once and runs every rule in `RULES`:

| Group             | Examples                                                      | Source                                    |
| ----------------- | ------------------------------------------------------------- | ----------------------------------------- |
| Reference runtime | missing front man, missing tool references                    | vendored `validation.gen.mjs` (unchanged) |
| Network           | URL-safe name, description, sample queries                    | MVP spec §2.1, §3.2                       |
| Agents            | unique names, descriptions, instructions, input schemas       | §2.1, §3.1                                |
| Graph             | unreachable nodes, delegation cycles                          | §3.1                                      |
| Capabilities      | HTTPS peers ending in a network name, MCP URLs, CORS reminder | §3.2, §3.4                                |
| Security          | credentials in any published string                           | §2.2, §4                                  |

A rule is a plain object `{ code, summary, specRef, check(ctx) }`. An issue may carry
`fix: {id, label}`; `validate/fixes.ts` maps the id to a pure `(doc, issue) => doc`, which
the UI's "Fix" buttons and the assistant's `apply_fix` action both apply as one undo step. Adding a check is one file
and one test; the UI shows it automatically. A rule that throws is reported as a warning
instead of hiding the others. Errors block "conforming"; warnings are suggestions.

## Components

All components are standard Custom Elements (via Lit) with Shadow DOM. Theming comes from CSS
custom properties in `ui/styles/tokens.css`, which inherit into every shadow root;
`ui/styles/shared.ts` holds shared control styles.

| Component             | Responsibility                                                         |
| --------------------- | ---------------------------------------------------------------------- |
| `telar-app`           | Layout, keyboard shortcuts, output panel tabs, toasts                  |
| `telar-toolbar`       | File / Add / history / export actions (native Popover API menus)       |
| `telar-canvas`        | SVG graph: pan, zoom, drag, connect by dragging a port, keyboard moves |
| `telar-inspector`     | Edits the selected node, edge, or the network and site settings        |
| `telar-schema-editor` | Field list for flat JSON Schemas, raw JSON for anything richer         |
| `telar-issues`        | Validation report; clicking an issue selects its node                  |
| `telar-artifacts`     | Live preview, copy and download of each published file                 |
| `telar-import-dialog` | Import from a site URL (resolved like a peer), a file or pasted JSON   |

## Security and privacy

- No backend and no analytics: designs never leave the browser unless the user exports them.
- A Content Security Policy in `index.html` allows only same-origin scripts.
- Imports fetch public artifacts with `credentials: "omit"`, mirroring MVP spec §3.4.
- The secret detector warns before anyone publishes a key inside a public network.

## Telar's own agent (open agentic website)

```
index.html ─ #assistant drawer (light DOM) ─ runtime/index.js boot("#agent-app")
                                               │ loads agent-manifest.json
                                               │ loads telar_assistant.network.json
                                               │ imports site-actions.js
site-actions.js ── website_* tools ──► globalThis.telarPage (TelarPage, src/ui/page-api.ts)
                                               └─► StudioController ─► core commands
```

`TelarPage` is the page object of the site-actions pattern: plain-JSON results, refusals as
`{ok:false, reason, field}`, one undo step per write. See ADR 0004.

## Roadmap hooks

- **Live test run.** Embed the reference runtime and run the edited network with the
  visitor's own key, without publishing.
- **Directory and security probe.** Index conforming sites; test a network against
  cross-site prompt injection with its owner's consent.
