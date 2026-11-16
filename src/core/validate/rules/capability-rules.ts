import type { McpNode, PeerNode } from "../../model/types.ts";
import { isSecurePeerUrl } from "../../serialize/manifest.ts";
import { parseHttpUrl, peerNetworkName } from "../../util/urls.ts";
import { NETWORK_NAME_PATTERN } from "./network-rules.ts";
import type { Issue, Rule } from "../types.ts";

export const capabilityRules: Rule[] = [
  {
    code: "peer.url",
    summary: "Peer networks use an HTTPS URL ending in the network name.",
    specRef: "§3.2",
    check: ({ doc }) => {
      const issues: Issue[] = [];
      for (const node of doc.nodes.filter((n): n is PeerNode => n.kind === "peer")) {
        const url = parseHttpUrl(node.url);
        const base = { code: "peer.url", source: "telar" as const, specRef: "§3.2", nodeId: node.id };
        if (!url) {
          issues.push({
            ...base,
            severity: "error",
            message: `Peer '${node.url || "(empty)"}' is not an http(s) URL.`,
          });
          continue;
        }
        if (!isSecurePeerUrl(node.url)) {
          issues.push({
            ...base,
            severity: "error",
            message: `Peer ${url.host} must use HTTPS (plain HTTP is only allowed for localhost during development).`,
          });
        }
        const name = peerNetworkName(node.url);
        if (url.pathname === "/" || !NETWORK_NAME_PATTERN.test(name)) {
          issues.push({
            ...base,
            severity: "error",
            message: `Peer URL ${node.url} must end with the network's name, e.g. https://${url.host}/agents/their_network.`,
          });
        }
      }
      return issues;
    },
  },
  {
    code: "mcp.url",
    summary: "MCP servers use an HTTPS URL.",
    specRef: "§2.1, §3.4",
    check: ({ doc }) =>
      doc.nodes
        .filter((n): n is McpNode => n.kind === "mcp")
        .filter((n) => !isSecurePeerUrl(n.url))
        .map((n): Issue => ({
          code: "mcp.url",
          severity: "error",
          source: "telar",
          specRef: "§2.1",
          nodeId: n.id,
          message: `MCP server '${n.url || "(empty)"}' needs an https:// URL (http only on localhost).`,
        })),
  },
  {
    code: "mcp.cors",
    summary: "Reminder: browser MCP calls need CORS.",
    specRef: "§3.4",
    check: ({ doc }) =>
      doc.nodes
        .filter((n): n is McpNode => n.kind === "mcp" && isSecurePeerUrl(n.url))
        .map((n): Issue => ({
          code: "mcp.cors",
          severity: "warning",
          source: "telar",
          specRef: "§3.4",
          nodeId: n.id,
          message: `The visitor's browser calls ${parseHttpUrl(n.url)?.host} directly: that server must allow your site's origin through CORS, or the tool will be unavailable.`,
        })),
  },
];
