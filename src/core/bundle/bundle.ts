/**
 * Assembles the publishable files of an agentic site from the document.
 * The browser runtime itself is not generated here: it is copied unchanged from the
 * reference implementation (see the bundle's README).
 */
import type { StudioDocument } from "../model/types.ts";
import { networkFileName, toLinks, toManifest } from "../serialize/manifest.ts";
import { toNetworkJson } from "../serialize/network.ts";
import { createZip, type ZipEntry } from "./zip.ts";

export const RUNTIME_SOURCE =
  "https://github.com/cognizant-ai-labs/agentic-web/tree/main/skills/agentify-website/runtime";

export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function bundleFiles(doc: StudioDocument): ZipEntry[] {
  return [
    { path: networkFileName(doc), content: json(toNetworkJson(doc)) },
    { path: "agent-manifest.json", content: json(toManifest(doc)) },
    { path: "links.json", content: json(toLinks(doc)) },
    { path: "README.md", content: bundleReadme(doc) },
  ];
}

export function bundleZip(doc: StudioDocument): Uint8Array {
  return createZip(bundleFiles(doc).map((f) => ({ ...f, path: `${doc.network.name}/${f.path}` })));
}

function bundleReadme(doc: StudioDocument): string {
  return `# ${doc.site.brand}

Agent network \`${doc.network.name}\`, exported from Telar.

## Files

- \`${networkFileName(doc)}\`: the agent network (resolved JSON form of the Neuro SAN HOCON).
- \`agent-manifest.json\`: the site manifest the runtime and other agent sites read first.
- \`links.json\`: default bindings for named links to other agent sites.

## Publish

1. Copy the browser runtime folder from ${RUNTIME_SOURCE}
   next to these files, unchanged, as \`runtime/\`.
2. Add a page that boots it (see the guesthouse example's \`site.js\` in the same repository).
3. Host the folder over HTTPS on any static host with CORS enabled for the JSON files.
4. Your network's public URL is \`https://<your-host>/<path-to-this-folder>/${doc.network.name}\`.
`;
}
