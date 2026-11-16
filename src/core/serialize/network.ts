/**
 * Converts between Telar's graph document and the published network definition
 * (`<network>.network.json`, the resolved JSON serialization of a Neuro SAN HOCON network).
 *
 * Guarantees:
 * - Lossless for fields Telar does not edit: they are kept in `extra` and written back.
 * - The front agent is emitted first, so the reference runtime's `find_front_man`
 *   (first agent with instructions) agrees with the manifest's `front_man`.
 * - Layout and UI state are never written into the network (it must be data-only).
 */
import { createAgent, createMcp, createPeer, DEFAULT_ROUTER } from "../model/factory.ts";
import type {
  AgentNode,
  Edge,
  Json,
  JsonObject,
  McpNode,
  NodeId,
  PeerNode,
  StudioDocument,
} from "../model/types.ts";
import { applyLayout } from "../layout/layered-layout.ts";
import { find_front_man, is_mcp_ref } from "../validate/vendor/graph.gen.mjs";

export class ImportError extends Error {}

const AGENT_KEYS = new Set(["name", "function", "instructions", "tools"]);
const FUNCTION_KEYS = new Set(["description", "parameters"]);
const NETWORK_KEYS = new Set(["tools", "metadata"]);
const METADATA_KEYS = new Set(["description", "sample_queries"]);

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick(source: JsonObject, exclude: Set<string>): JsonObject {
  return Object.fromEntries(Object.entries(source).filter(([k]) => !exclude.has(k)));
}

/* ------------------------------------------------------------------ export */

/** Coded tools (`class`) and toolbox entries run code instead of an LLM and need no instructions. */
export function isCodedAgent(agent: AgentNode): boolean {
  return "class" in agent.extra || "toolbox" in agent.extra;
}

export interface NetworkJson extends JsonObject {
  metadata: JsonObject;
  tools: JsonObject[];
}

/** Orders agents with the front agent first, keeping the others in document order. */
function orderedAgents(doc: StudioDocument): AgentNode[] {
  const list = doc.nodes.filter((n): n is AgentNode => n.kind === "agent");
  const front = list.find((a) => a.id === doc.frontAgentId);
  return front ? [front, ...list.filter((a) => a !== front)] : list;
}

function refFor(doc: StudioDocument, id: NodeId): Json | undefined {
  const node = doc.nodes.find((n) => n.id === id);
  if (!node) return undefined;
  switch (node.kind) {
    case "agent":
      return node.name;
    case "peer":
      return node.url;
    case "mcp": {
      // Always an object: a bare string URL without "mcp" in it would be classified as a peer.
      const descriptor: JsonObject = { ...node.extra, url: node.url };
      if (node.toolNames.length) descriptor.tools = [...node.toolNames];
      return descriptor;
    }
  }
}

export function toNetworkJson(doc: StudioDocument): NetworkJson {
  const metadata: JsonObject = { ...doc.network.metadataExtra };
  if (!doc.network.descriptionInManifestOnly) metadata.description = doc.network.description;
  if (doc.network.sampleQueries.length) metadata.sample_queries = [...doc.network.sampleQueries];

  const llmConfig = isObject(doc.network.extra.llm_config) ? doc.network.extra.llm_config : {};
  const extra: JsonObject = { ...doc.network.extra };
  if (doc.site.defaultModel) extra.llm_config = { ...llmConfig, model_name: doc.site.defaultModel };

  const tools = orderedAgents(doc).map((agent) => {
    const fn: JsonObject = { ...agent.functionExtra, description: agent.description };
    if (agent.parameters) fn.parameters = agent.parameters;
    const refs = doc.edges
      .filter((e) => e.from === agent.id)
      .map((e) => refFor(doc, e.to))
      .filter((r): r is Json => r !== undefined);
    const allRefs = [...refs, ...agent.unresolvedRefs];
    const entry: JsonObject = {
      name: agent.name,
      function: fn,
      ...(agent.instructions || !isCodedAgent(agent) ? { instructions: agent.instructions } : {}),
      ...agent.extra,
    };
    if (allRefs.length || !agent.omitEmptyTools) entry.tools = allRefs;
    return entry;
  });

  return { metadata, ...extra, tools };
}

/* ------------------------------------------------------------------ import */

export interface ImportOptions {
  /** Network name (from the manifest or file name); defaults to `imported_network`. */
  name?: string;
  /** Front agent name from the manifest; defaults to the runtime's own rule. */
  frontMan?: string;
  /** Description from the manifest entry, used when the network's metadata has none. */
  description?: string;
  brand?: string;
  routerBaseUrl?: string;
}

/** Parses JSON text. HOCON-only syntax is reported clearly instead of failing obscurely. */
export function parseNetworkText(text: string): JsonObject {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new ImportError(
      `This is not valid JSON (${(error as Error).message}). Telar reads the resolved JSON form of a network; ` +
        "convert HOCON with includes or substitutions to JSON first.",
    );
  }
  if (!isObject(value)) throw new ImportError("A network definition must be a JSON object.");
  return value;
}

export function fromNetworkJson(config: JsonObject, options: ImportOptions = {}): StudioDocument {
  const rawTools = config.tools;
  if (!Array.isArray(rawTools)) throw new ImportError("The network has no 'tools' array of agents.");

  const agents: AgentNode[] = [];
  const byName = new Map<string, AgentNode>();
  for (const raw of rawTools) {
    if (!isObject(raw)) throw new ImportError("Every entry of 'tools' must be an object.");
    const fn = isObject(raw.function) ? raw.function : {};
    const agent = createAgent({
      name: typeof raw.name === "string" ? raw.name : "",
      description: typeof fn.description === "string" ? fn.description : "",
      instructions: typeof raw.instructions === "string" ? raw.instructions : "",
      parameters: isObject(fn.parameters) ? fn.parameters : null,
      extra: pick(raw, AGENT_KEYS),
      functionExtra: pick(fn, FUNCTION_KEYS),
      omitEmptyTools: !("tools" in raw),
    });
    agents.push(agent);
    if (agent.name && !byName.has(agent.name)) byName.set(agent.name, agent);
  }

  const peers = new Map<string, PeerNode>();
  const mcps = new Map<string, McpNode>();
  const edges: Edge[] = [];
  const addEdge = (from: AgentNode, to: NodeId) => {
    if (!edges.some((e) => e.from === from.id && e.to === to)) edges.push({ from: from.id, to });
  };

  rawTools.forEach((raw, i) => {
    const agent = agents[i] as AgentNode;
    const refs = isObject(raw) && Array.isArray(raw.tools) ? raw.tools : [];
    for (const ref of refs) {
      if (typeof ref === "string") {
        const local = byName.get(ref);
        if (local) addEdge(agent, local.id);
        else if (/^https?:\/\//.test(ref) && is_mcp_ref(ref)) {
          const key = JSON.stringify([ref, []]);
          const node = mcps.get(key) ?? createMcp(ref);
          mcps.set(key, node);
          addEdge(agent, node.id);
        } else if (/^https?:\/\//.test(ref)) {
          const node = peers.get(ref) ?? createPeer(ref);
          peers.set(ref, node);
          addEdge(agent, node.id);
        } else {
          agent.unresolvedRefs.push(ref);
        }
      } else if (isObject(ref) && typeof ref.url === "string") {
        const toolNames = Array.isArray(ref.tools)
          ? ref.tools.filter((t): t is string => typeof t === "string")
          : [];
        const key = JSON.stringify([ref.url, toolNames]);
        let node = mcps.get(key);
        if (!node) {
          node = createMcp(ref.url, toolNames);
          node.extra = pick(ref, new Set(["url", "tools"]));
          mcps.set(key, node);
        }
        addEdge(agent, node.id);
      } else {
        throw new ImportError(
          `Agent '${agent.name}' has a tool reference Telar cannot read: ${JSON.stringify(ref)}`,
        );
      }
    }
  });

  const frontName = options.frontMan ?? find_front_man(config) ?? undefined;
  const front = frontName ? byName.get(frontName) : undefined;
  if (options.frontMan && !front) {
    throw new ImportError(`The manifest's front_man '${options.frontMan}' is not an agent of this network.`);
  }

  const metadata = isObject(config.metadata) ? config.metadata : {};
  const extra = pick(config, NETWORK_KEYS);
  const llmConfig = isObject(extra.llm_config) ? extra.llm_config : {};
  // Empty when the source declares no model, so a round trip does not add one.
  const defaultModel = typeof llmConfig.model_name === "string" ? llmConfig.model_name : "";

  const doc: StudioDocument = {
    version: 1,
    network: {
      name: options.name ?? "imported_network",
      description:
        typeof metadata.description === "string" ? metadata.description : (options.description ?? ""),
      descriptionInManifestOnly: typeof metadata.description !== "string" && !!options.description,
      sampleQueries: Array.isArray(metadata.sample_queries)
        ? metadata.sample_queries.filter((q): q is string => typeof q === "string")
        : [],
      extra,
      metadataExtra: pick(metadata, METADATA_KEYS),
    },
    site: {
      brand: options.brand ?? options.name ?? "Imported network",
      routerBaseUrl: options.routerBaseUrl ?? DEFAULT_ROUTER,
      defaultModel,
    },
    nodes: [...agents, ...peers.values(), ...mcps.values()],
    edges,
    frontAgentId: front?.id ?? agents[0]?.id ?? null,
  };
  return applyLayout(doc);
}
