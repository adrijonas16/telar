# Telar

**Live:** https://adrijonas16.github.io/telar/

**A visual studio for the open agentic web.** Design an agent network on a canvas, check it
against the [Open Agentic Web MVP specification](https://github.com/cognizant-ai-labs/agentic-web/blob/main/docs/worldwide_agentic_web_mvp_spec.md)
as you type, and export the files an agentic website publishes: `<network>.network.json`,
`agent-manifest.json` and `links.json`.

Telar runs entirely in your browser. There is no server and no account, and your designs stay
on your device until you export them.

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

## Quick start

Requires Node.js 22+.

```sh
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck + lint + tests
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
