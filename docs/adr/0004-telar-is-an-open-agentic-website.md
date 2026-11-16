# ADR 0004: Telar is itself an open agentic website

- Status: accepted
- Date: 2026-11-16

## Context

The Open Agentic Web Challenge requires a working open agentic website: a public `.json`
agent network, a browser runtime, an interface to talk to it, and an interface to configure
the LLM and key. A studio that only edits networks would not qualify, and an assistant that
designs networks is the most useful agent a network editor can have.

## Decision

Follow the challenge repository's `agentify-website` skill exactly:

- **Runtime:** the skill's runtime is copied unchanged to `public/runtime/`
  (Apache-2.0). It boots lazily the first time the visitor opens "Ask Telar".
- **Network:** `agent/telar_assistant.hocon` is the source of truth; `npm run build:agent`
  runs the skill's `build_network.mjs` (vendored in `tools/agentify/`) to write
  `public/telar_assistant.network.json`, the discovery files and the action bridge. CI runs
  it with `--check`.
- **One agent, twelve site actions.** `public/site-actions.js` wraps `TelarPage`
  (`src/ui/page-api.ts`), the page object the app creates at startup and exposes as
  `globalThis.telarPage`. Every action calls the same `StudioController` the UI uses.
- **Effects:** every canvas change is one undo step, so all writes are `write`; there is no
  `irreversible` action and no custom confirmation dialog. Export and publishing stay with
  the person.
- **Light DOM mount.** The runtime finds its mount with `document.querySelector`, so the
  drawer (`#assistant`) lives in `index.html`, outside the Lit shadow roots.

## Consequences

- Telar's network URL is `https://adrijonas16.github.io/telar/telar_assistant`; other agent
  sites can call it (without the canvas tools) to learn about the open agentic web.
- The assistant and a person can never disagree on the rules: both go through the same
  controller and validator.
- Known limits, inherited from the reference runtime:
  - `write` actions run without showing the visitor first, which MVP spec §3.1 asks for.
    Every change here is undoable, which bounds the risk.
  - GitHub Pages cannot send per-file headers, so `runtime/sandbox-worker.js` is served
    without the recommended Content-Security-Policy header; the page's CSP still applies.
    Telar publishes no coded tools, so the sandbox worker never runs publisher code.
  - The visitor's key is stored in this origin's localStorage; Telar loads no third-party
    scripts and sends a restrictive CSP to limit who can read it.
