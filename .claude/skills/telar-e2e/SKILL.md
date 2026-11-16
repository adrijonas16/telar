---
name: telar-e2e
description: Test Telar and Ask Telar end to end in a real browser without an AI key, using a scripted OpenAI-compatible model that calls the real website_* actions; also how to export a network, serve it as an agentic site and run the official partner check. Use before merging assistant changes or to record a demo video.
---

# End-to-end test of Telar without an AI key

The runtime calls `POST {router}/chat/completions` (OpenAI format, `stream: true`). Playwright
intercepts `https://api.otari.ai/**` and answers with a **scripted model**
(`scripts/scripted.py`): it returns `tool_calls` and text in SSE chunks. Everything else is
real: the runtime, the site actions, the controller, validation and export. Say so whenever you
show results: only the model's words are scripted.

## Run

```sh
npm run build && npx vite preview --port 4173 --strictPort &
pip install playwright && python -m playwright install chromium     # once
python .claude/skills/telar-e2e/scripts/telar_e2e.py http://localhost:4173
# CHROME=/usr/bin/google-chrome to use an installed browser
```

The script opens Ask Telar, enters a fake key (Save reloads the page, so it reopens the drawer),
asks for a café network, lets the scripted model call `website_build_network`, checks the canvas
now has the new network and passes the checks, then clicks Undo and checks the old one is back.
Exit code 1 on failure. Add `record_video_dir` to the browser context to record a demo; turn the
WebM into MP4 with `ffmpeg -c:v libx264 -preset veryfast -crf 23 -pix_fmt yuv420p` and add
captions with `drawtext` (no `:` or `,` inside caption text: ffmpeg treats them as separators).

## Exported site → official checks

1. Export the site bundle (.zip) from Telar and unzip it.
2. Follow the README inside: copy `.claude/skills/agentify-website/runtime` next to the files
   as `runtime/`, and add a page from `templates/standalone-index.html` + `templates/site.js`
   (remove the `App` import and set `DIALOGS = {}` when the site has no actions).
3. Serve it with CORS: `node .claude/skills/agentify-website/scripts/serve_site.mjs <folder> --port 8080`.
4. Run the official partner check:
   `node .claude/skills/agentify-website/scripts/check_partner.mjs http://127.0.0.1:8080/<network>`.
   Expect `OK: … can be called from other sites` and no warnings.
5. Import it back into Telar with File → Import → From a site, using the same URL: the network
   must come back unchanged and conforming.

## Gotchas

- The runtime does not keep tool results from earlier turns: a script must remember ids itself.
- If assets load as `text/plain`, an old preview/next server is still running: kill it and restart.
