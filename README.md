# Telar

**Live:** https://adrijonas16.github.io/telar/

**A visual studio for the open agentic web.** Design an agent network on a canvas, check it
against the [Open Agentic Web MVP specification](https://github.com/cognizant-ai-labs/agentic-web/blob/main/docs/worldwide_agentic_web_mvp_spec.md)
as you type, and export the files an agentic website publishes: `<network>.network.json`,
`agent-manifest.json` and `links.json`.

Telar runs entirely in your browser. There is no server and no account, and your designs stay
on your device until you export them.

**Telar is itself an open agentic website.** Open **Ask Telar** and its own agent network
designs, edits and explains networks on the canvas for you, using your own AI key.
Other agent sites can call it at `https://adrijonas16.github.io/telar/telar_assistant`.

> _Telar_ is Spanish for loom: the frame Andean weavers use to turn separate threads into one
> fabric. Telar weaves agents from different sites into networks.

## Features

- **Visual editor:** agents, peer networks (other sites' agents) and MCP servers as nodes; drag
  from an agent's port to let it call another node. Undo/redo, auto-layout, keyboard moves.
- **Live validation:** runs the reference runtime's own validator plus Telar's specification
  checks (unique names, input schemas, HTTPS peers, unreachable agents, cycles, leaked API keys).
  Each issue links to its node and to the spec section it enforces.
- **Lossless import:** load any published agentic site by URL, a `.network.json` file or pasted
  JSON. Fields Telar does not edit are preserved on export.
- **Export:** a ready-to-host site bundle (.zip) or each file individually.
- **Ask Telar:** a built-in assistant on the reference runtime. It reads the canvas and the
  checks and changes the network through 12 site actions (build a whole network, add or
  connect pieces, fix what the checks flag). Every change is one Undo step.

## Telar's own agent network

| Published file                                            | Purpose                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| `agent-manifest.json`                                     | Site manifest: the `telar_assistant` network, router, peer policy, actions |
| `telar_assistant.network.json`                            | The network (built from `agent/telar_assistant.hocon`)                     |
| `site-actions.js`                                         | The 12 `website_*` tools, wrapping `src/ui/page-api.ts`                    |
| `runtime/`                                                | Reference browser runtime, unchanged                                       |
| `bridge/`, `.well-known/`, `agent-mcp.json`, `links.json` | Linking and discovery files                                                |

Visitors bring their own key (hosted [Otari](https://otari.ai) by default, any
OpenAI-compatible provider that allows browser CORS). `npm run check:agent` rebuilds and
checks the network with the challenge's own `build_network.mjs`.

Known limits: `write` actions run without a preview, as in the reference runtime (all are
undoable here); GitHub Pages cannot send the recommended CSP header for
`runtime/sandbox-worker.js`; the agent cannot publish, run or test networks.

## Quick start

Requires Node.js 22+.

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + tests
npm run build:agent  # rebuild Telar's own network from agent/telar_assistant.hocon
npm run build      # static site in dist/
```

Deploy `dist/` to any static host (GitHub Pages, Netlify, Vercel).

## Project layout

```
src/
  core/          domain logic: model, commands, store, serialize, validate, layout, bundle
  ui/            Lit web components, controller, styles, browser services
  persistence/   draft autosave
tests/           Vitest suites (+ official examples as fixtures)
docs/            architecture and decision records
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the [ADRs](docs/adr/).

## Standards

TypeScript strict mode · Custom Elements and Shadow DOM · ES modules · native `<dialog>` and
Popover API · SVG · Content Security Policy · WCAG-minded keyboard and screen reader support ·
Conventional Commits · Apache-2.0.

## License

Apache-2.0. Includes the reference validator from
[cognizant-ai-labs/agentic-web](https://github.com/cognizant-ai-labs/agentic-web) (Apache-2.0),
see `src/core/validate/vendor/`.
