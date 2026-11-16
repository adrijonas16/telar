/**
 * Site-level artifacts derived from the document: `agent-manifest.json` and `links.json`
 * (MVP spec §3.3), shaped like the reference examples so the reference runtime loads them.
 */
import type { AgentNode, JsonObject, PeerNode, StudioDocument } from "../model/types.ts";
import { isLoopback, parseHttpUrl } from "../util/urls.ts";

export function networkFileName(doc: StudioDocument): string {
  return `${doc.network.name}.network.json`;
}

export function frontAgent(doc: StudioDocument): AgentNode | undefined {
  const node = doc.nodes.find((n) => n.id === doc.frontAgentId);
  return node?.kind === "agent" ? node : undefined;
}

/** Origins of every peer network this network may call (for `allowed_peers`). */
export function peerOrigins(doc: StudioDocument): string[] {
  const origins = new Set<string>();
  for (const node of doc.nodes) {
    if (node.kind !== "peer") continue;
    const url = parseHttpUrl((node as PeerNode).url);
    if (url) origins.add(url.origin);
  }
  return [...origins].sort();
}

export function toManifest(doc: StudioDocument): JsonObject {
  const front = frontAgent(doc)?.name ?? "";
  const name = doc.network.name;
  const network: JsonObject = {
    name,
    front_man: front,
    hocon: `./${networkFileName(doc)}`,
    description: doc.network.description,
  };
  if (doc.network.sampleQueries.length) network.sample_queries = [...doc.network.sampleQueries];

  const router = doc.site.routerBaseUrl;
  return {
    brand: doc.site.brand,
    networks: [network],
    llm_router: { base_url: router, mock: false, byok_router: router },
    allowed_peers: peerOrigins(doc),
    peer_policy: {
      mode: "closed",
      deny_origins: [],
      note: "Calls only the partner sites in allowed_peers, after the visitor agrees.",
    },
    linking: {
      protocol: "nsdeploy-link/v1",
      exports: [{ network: name, front_man: front, aliases: [...new Set([name, front])], url: name }],
      imports: [],
      link_updates: { mode: "browser-local" },
    },
    deployment: {
      mode: "static",
      self_contained_runtime: true,
      browser_mock: false,
      direct_byok: true,
      direct_mcp_requires_cors: true,
      public_mcp_facade: false,
    },
    generator: "Telar",
  };
}

export function toLinks(doc: StudioDocument): JsonObject {
  return { version: 1, networks: { [doc.network.name]: {} } };
}

/** True when a peer URL is acceptable for production (HTTPS, or HTTP on loopback). */
export function isSecurePeerUrl(value: string): boolean {
  const url = parseHttpUrl(value);
  return !!url && (url.protocol === "https:" || isLoopback(url));
}
