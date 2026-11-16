import type { NodeId, StudioDocument } from "../../model/types.ts";
import type { Issue, Rule } from "../types.ts";

function adjacency(doc: StudioDocument): Map<NodeId, NodeId[]> {
  const map = new Map<NodeId, NodeId[]>();
  for (const e of doc.edges) map.set(e.from, [...(map.get(e.from) ?? []), e.to]);
  return map;
}

/** Ids reachable from the front agent (including it). */
export function reachable(doc: StudioDocument): Set<NodeId> {
  const seen = new Set<NodeId>();
  if (!doc.frontAgentId) return seen;
  const adj = adjacency(doc);
  const stack: NodeId[] = [doc.frontAgentId];
  while (stack.length) {
    const id = stack.pop() as NodeId;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(adj.get(id) ?? []));
  }
  return seen;
}

/** Simple cycles between local agents, each reported once as a list of node ids. */
export function findCycles(doc: StudioDocument): NodeId[][] {
  const adj = adjacency(doc);
  const agentIds = new Set(doc.nodes.filter((n) => n.kind === "agent").map((n) => n.id));
  const state = new Map<NodeId, "visiting" | "done">();
  const cycles: NodeId[][] = [];
  const path: NodeId[] = [];

  const visit = (id: NodeId) => {
    state.set(id, "visiting");
    path.push(id);
    for (const next of adj.get(id) ?? []) {
      if (!agentIds.has(next)) continue;
      if (state.get(next) === "visiting") cycles.push(path.slice(path.indexOf(next)));
      else if (!state.has(next)) visit(next);
    }
    path.pop();
    state.set(id, "done");
  };
  for (const id of agentIds) if (!state.has(id)) visit(id);
  return cycles;
}

export const graphRules: Rule[] = [
  {
    code: "graph.unreachable",
    summary: "Every node can be reached from the front agent.",
    check: ({ doc }) => {
      if (!doc.frontAgentId) return [];
      const ok = reachable(doc);
      return doc.nodes
        .filter((n) => !ok.has(n.id))
        .map((n): Issue => ({
          code: "graph.unreachable",
          severity: "warning",
          source: "telar",
          nodeId: n.id,
          message: `'${n.kind === "agent" ? n.name : n.url}' is never called from the front agent, so visitors cannot reach it.`,
        }));
    },
  },
  {
    code: "graph.cycle",
    summary: "Delegation between local agents has no cycles (or they are intended).",
    specRef: "§3.1",
    check: ({ doc }) => {
      const names = new Map(doc.nodes.map((n) => [n.id, n.kind === "agent" ? n.name : n.id]));
      return findCycles(doc).map((cycle): Issue => ({
        code: "graph.cycle",
        severity: "warning",
        source: "telar",
        specRef: "§3.1",
        nodeId: cycle[0],
        message: `Agents call each other in a loop (${[...cycle, cycle[0]].map((id) => names.get(id as NodeId)).join(" → ")}). The runtime stops this at its execution budget; make sure it is intended.`,
      }));
    },
  },
];
