/**
 * Telar's editable document model.
 *
 * The studio edits a *graph* (nodes + edges + layout) and derives the published artifacts
 * (`<network>.network.json`, `agent-manifest.json`, `links.json`) from it. Keeping the graph
 * separate from the wire format lets the UI hold layout and selection state that must never
 * leak into the published, data-only network definition (MVP spec §2.2).
 */

/** JSON value, used to preserve fields Telar does not edit (round-trip safety). */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export type NodeId = string;

export interface Position {
  x: number;
  y: number;
}

interface NodeBase {
  id: NodeId;
  position: Position;
}

/** An LLM agent defined inside this network (an entry of the network's `tools` array). */
export interface AgentNode extends NodeBase {
  kind: "agent";
  /** Unique within the network; other agents reference it by this name. */
  name: string;
  /** `function.description`: what callers can expect from this agent. */
  description: string;
  /** LLM instructions: role, grounding and constraints. */
  instructions: string;
  /** `function.parameters`: JSON Schema of the invocation input. `null` = none declared. */
  parameters: JsonObject | null;
  /** Unknown agent fields (e.g. `class`, `toolbox`, `llm_config`), preserved verbatim. */
  extra: JsonObject;
  /** Unknown `function` fields, preserved verbatim. */
  functionExtra: JsonObject;
  /**
   * References that could not be resolved to a node on import (e.g. a typo'd agent name or a
   * named link slot). Preserved so validation can report them and export stays lossless.
   */
  unresolvedRefs: string[];
  /** The source omitted `tools`; keep omitting it while the agent calls nothing (lossless round trip). */
  omitEmptyTools?: boolean;
}

/** Another site's published agent network, referenced by URL (MVP spec §3.2). */
export interface PeerNode extends NodeBase {
  kind: "peer";
  /** `https://site.example/base/<network_name>` */
  url: string;
}

/** An MCP server an agent may call, optionally restricted to some tool names. */
export interface McpNode extends NodeBase {
  kind: "mcp";
  url: string;
  /** Allowed tool names; empty = all tools the server exposes. */
  toolNames: string[];
  /** Unknown descriptor fields, preserved verbatim. */
  extra: JsonObject;
}

export type StudioNode = AgentNode | PeerNode | McpNode;
export type NodeKind = StudioNode["kind"];

/** "`from` may call `to`". Only agents can be the source of an edge. */
export interface Edge {
  from: NodeId;
  to: NodeId;
}

/** Site-level settings that end up in `agent-manifest.json`. */
export interface SiteSettings {
  /** Display name of the site/assistant. */
  brand: string;
  /** Default LLM router (OpenAI-compatible base URL). */
  routerBaseUrl: string;
  /** Default model hint written to the network's `llm_config.model_name`. */
  defaultModel: string;
}

export interface NetworkSettings {
  /** Stable network name; also the last path segment of its public URL. */
  name: string;
  /** Short description (`metadata.description`). */
  description: string;
  sampleQueries: string[];
  /** Unknown top-level network fields, preserved verbatim. */
  extra: JsonObject;
  /** Unknown `metadata` fields, preserved verbatim. */
  metadataExtra: JsonObject;
  /** The source kept the description only in the manifest; do not add it to `metadata` on export. */
  descriptionInManifestOnly?: boolean;
}

export interface StudioDocument {
  /** Schema version of this document (for persisted drafts). */
  version: 1;
  network: NetworkSettings;
  site: SiteSettings;
  nodes: StudioNode[];
  edges: Edge[];
  /** The network's public entry point (`front_man`). */
  frontAgentId: NodeId | null;
}
