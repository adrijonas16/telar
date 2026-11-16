/**
 * Layered top-down layout: the front agent on top, each delegation level below it.
 * Deterministic, dependency-free and good enough for the small graphs agent networks are.
 */
import type { NodeId, Position, StudioDocument } from "../model/types.ts";

export const NODE_WIDTH = 236;
export const NODE_HEIGHT = 84;
const GAP_X = 48;
const GAP_Y = 96;

export function layeredPositions(doc: StudioDocument): Map<NodeId, Position> {
  const children = new Map<NodeId, NodeId[]>();
  for (const e of doc.edges) {
    const list = children.get(e.from) ?? [];
    list.push(e.to);
    children.set(e.from, list);
  }

  const level = new Map<NodeId, number>();
  const roots = [doc.frontAgentId, ...doc.nodes.map((n) => n.id)].filter((id): id is NodeId => !!id);
  // BFS from the front agent first, then from any node not yet placed (disconnected parts).
  for (const root of roots) {
    if (level.has(root)) continue;
    const base = level.size === 0 ? 0 : Math.max(...level.values()) + 1;
    level.set(root, base);
    const queue: NodeId[] = [root];
    while (queue.length) {
      const id = queue.shift() as NodeId;
      for (const child of children.get(id) ?? []) {
        if (!level.has(child)) {
          level.set(child, (level.get(id) ?? 0) + 1);
          queue.push(child);
        }
      }
    }
  }

  const rows = new Map<number, NodeId[]>();
  for (const node of doc.nodes) {
    const l = level.get(node.id) ?? 0;
    const row = rows.get(l) ?? [];
    row.push(node.id);
    rows.set(l, row);
  }

  const positions = new Map<NodeId, Position>();
  for (const [l, ids] of rows) {
    const width = ids.length * NODE_WIDTH + (ids.length - 1) * GAP_X;
    ids.forEach((id, i) => {
      positions.set(id, { x: -width / 2 + i * (NODE_WIDTH + GAP_X), y: l * (NODE_HEIGHT + GAP_Y) });
    });
  }
  return positions;
}

export function applyLayout(doc: StudioDocument): StudioDocument {
  const positions = layeredPositions(doc);
  return {
    ...doc,
    nodes: doc.nodes.map((n) => ({ ...n, position: positions.get(n.id) ?? n.position })),
  };
}
