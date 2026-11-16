/**
 * One-click fixes for validation issues. A fix is a pure function `(doc, issue) => doc`,
 * registered by id; rules attach `fix: {id, label}` to the issues it can repair.
 */
import { withPeerRule } from "../agentic/peer-rule.ts";
import { updateNode } from "../model/commands.ts";
import type { AgentNode, StudioDocument } from "../model/types.ts";
import type { Issue } from "./types.ts";

type Fix = (doc: StudioDocument, issue: Issue) => StudioDocument;

const FIXES: Record<string, Fix> = {
  "add-peer-rule": (doc, issue) => {
    const agent = doc.nodes.find((n): n is AgentNode => n.id === issue.nodeId && n.kind === "agent");
    return agent ? updateNode<AgentNode>(doc, agent.id, { instructions: withPeerRule(doc, agent) }) : doc;
  },
};

/** Applies the issue's fix; returns the document unchanged when it has none. */
export function applyFix(doc: StudioDocument, issue: Issue): StudioDocument {
  const fix = issue.fix ? FIXES[issue.fix.id] : undefined;
  return fix ? fix(doc, issue) : doc;
}
