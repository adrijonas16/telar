/**
 * Document commands: pure functions `(doc, ...args) => doc`.
 *
 * Every edit the UI (or, later, the studio's own assistant agent) can make goes through one
 * of these. They never mutate their input, which gives the store cheap undo/redo and makes
 * each operation unit-testable without a browser.
 */
import type { AgentNode, Edge, NodeId, Position, StudioDocument, StudioNode } from "./types.ts";

export type Patch<T> = Partial<Omit<T, "id" | "kind">>;

export function findNode(doc: StudioDocument, id: NodeId | null | undefined): StudioNode | undefined {
  return id ? doc.nodes.find((n) => n.id === id) : undefined;
}

export function agents(doc: StudioDocument): AgentNode[] {
  return doc.nodes.filter((n): n is AgentNode => n.kind === "agent");
}

/** A name not yet used by any agent, derived from `base` (`base`, `base_2`, ...). */
export function uniqueAgentName(doc: StudioDocument, base: string): string {
  const taken = new Set(agents(doc).map((a) => a.name));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

export function addNode(doc: StudioDocument, node: StudioNode): StudioDocument {
  const nodes = [...doc.nodes, node];
  const frontAgentId = doc.frontAgentId ?? (node.kind === "agent" ? node.id : null);
  return { ...doc, nodes, frontAgentId };
}

export function updateNode<T extends StudioNode>(
  doc: StudioDocument,
  id: NodeId,
  patch: Patch<T>,
): StudioDocument {
  return {
    ...doc,
    nodes: doc.nodes.map((n) => (n.id === id ? ({ ...n, ...patch } as StudioNode) : n)),
  };
}

export function moveNode(doc: StudioDocument, id: NodeId, position: Position): StudioDocument {
  return updateNode(doc, id, { position });
}

/** Removes a node and every edge touching it; picks a new front agent if needed. */
export function removeNode(doc: StudioDocument, id: NodeId): StudioDocument {
  const nodes = doc.nodes.filter((n) => n.id !== id);
  const edges = doc.edges.filter((e) => e.from !== id && e.to !== id);
  let frontAgentId = doc.frontAgentId;
  if (frontAgentId === id) {
    frontAgentId = nodes.find((n) => n.kind === "agent")?.id ?? null;
  }
  return { ...doc, nodes, edges, frontAgentId };
}

export type ConnectResult = { ok: true; doc: StudioDocument } | { ok: false; reason: string };

/** Adds `from → to` ("from may call to"), enforcing the graph's structural rules. */
export function connect(doc: StudioDocument, from: NodeId, to: NodeId): ConnectResult {
  const source = findNode(doc, from);
  const target = findNode(doc, to);
  if (!source || !target) return { ok: false, reason: "Unknown node." };
  if (source.kind !== "agent") return { ok: false, reason: "Only agents can call other nodes." };
  if (from === to) return { ok: false, reason: "An agent cannot list itself as a tool." };
  if (hasEdge(doc, from, to)) return { ok: false, reason: "These nodes are already connected." };
  return { ok: true, doc: { ...doc, edges: [...doc.edges, { from, to }] } };
}

export function disconnect(doc: StudioDocument, from: NodeId, to: NodeId): StudioDocument {
  return { ...doc, edges: doc.edges.filter((e) => !(e.from === from && e.to === to)) };
}

export function hasEdge(doc: StudioDocument, from: NodeId, to: NodeId): boolean {
  return doc.edges.some((e) => e.from === from && e.to === to);
}

export function outgoing(doc: StudioDocument, id: NodeId): Edge[] {
  return doc.edges.filter((e) => e.from === id);
}

export function setFrontAgent(doc: StudioDocument, id: NodeId): StudioDocument {
  const node = findNode(doc, id);
  if (!node || node.kind !== "agent") return doc;
  return { ...doc, frontAgentId: id };
}

export function updateNetwork(
  doc: StudioDocument,
  patch: Partial<StudioDocument["network"]>,
): StudioDocument {
  return { ...doc, network: { ...doc.network, ...patch } };
}

export function updateSite(doc: StudioDocument, patch: Partial<StudioDocument["site"]>): StudioDocument {
  return { ...doc, site: { ...doc.site, ...patch } };
}
