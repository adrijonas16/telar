import { newId } from "../util/ids.ts";
import type { AgentNode, JsonObject, McpNode, PeerNode, Position, StudioDocument } from "./types.ts";

export const DEFAULT_ROUTER = "https://api.otari.ai/api/v1";
export const DEFAULT_MODEL = "alibaba/qwen3.8-flash";

/** The invocation schema most agents in the reference examples use. */
export function defaultParameters(): JsonObject {
  return {
    type: "object",
    properties: {
      inquiry: { type: "string", description: "The request to handle." },
    },
    required: ["inquiry"],
  };
}

export function createAgent(partial: Partial<AgentNode> = {}): AgentNode {
  return {
    kind: "agent",
    id: newId("agent"),
    name: "new_agent",
    description: "",
    instructions: "",
    parameters: defaultParameters(),
    extra: {},
    functionExtra: {},
    unresolvedRefs: [],
    position: { x: 0, y: 0 },
    ...partial,
  };
}

export function createPeer(url: string, position: Position = { x: 0, y: 0 }): PeerNode {
  return { kind: "peer", id: newId("peer"), url, position };
}

export function createMcp(
  url: string,
  toolNames: string[] = [],
  position: Position = { x: 0, y: 0 },
): McpNode {
  return { kind: "mcp", id: newId("mcp"), url, toolNames, extra: {}, position };
}

/** A minimal valid document: one front agent. */
export function createEmptyDocument(): StudioDocument {
  const front = createAgent({
    name: "front_agent",
    description: "Answers visitors' questions about this site.",
    instructions: "Understand the visitor's request and answer it, or delegate it to the right specialist.",
    position: { x: 0, y: 0 },
  });
  return {
    version: 1,
    network: {
      name: "my_network",
      description: "Describe what this agent network does.",
      sampleQueries: [],
      extra: {},
      metadataExtra: {},
    },
    site: { brand: "My Agentic Site", routerBaseUrl: DEFAULT_ROUTER, defaultModel: DEFAULT_MODEL },
    nodes: [front],
    edges: [],
    frontAgentId: front.id,
  };
}
