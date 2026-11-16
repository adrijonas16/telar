import { describe, expect, it } from "vitest";
import {
  applyFix,
  bakerySample,
  commands,
  createEmptyDocument,
  fromNetworkJson,
  PEER_RULE_MARKER,
  validate,
  type AgentNode,
  type StudioDocument,
} from "../../src/core/index.ts";

const front = (doc: StudioDocument) => doc.nodes.find((n) => n.id === doc.frontAgentId) as AgentNode;
const peerIssue = (doc: StudioDocument) => validate(doc).issues.find((i) => i.code === "agentic.peer-rule");

describe("peer rule check", () => {
  it("flags an entry agent with no rule for being called by other sites, as a tip with a fix", () => {
    const issue = peerIssue(createEmptyDocument());
    expect(issue?.severity).toBe("warning");
    expect(issue?.fix?.id).toBe("add-peer-rule");
  });

  it("accepts the sample, which follows the best practice", () => {
    expect(peerIssue(bakerySample())).toBeUndefined();
  });

  it("expands {peer_rules} from commondefs, as the runtime does", () => {
    const doc = fromNetworkJson({
      commondefs: { replacement_strings: { peer_rules: `${PEER_RULE_MARKER} for its visitor.` } },
      tools: [{ name: "a", function: { description: "d" }, instructions: "Help.\n{peer_rules}", tools: [] }],
    });
    expect(peerIssue(doc)).toBeUndefined();
  });

  it("fixes it in one step, idempotently, keeping the original instructions", () => {
    const doc = createEmptyDocument();
    const issue = peerIssue(doc);
    if (!issue) throw new Error("expected the issue");
    const fixed = applyFix(doc, issue);
    expect(front(fixed).instructions.startsWith(front(doc).instructions)).toBe(true);
    expect(front(fixed).instructions).toContain(PEER_RULE_MARKER);
    expect(peerIssue(fixed)).toBeUndefined();
    expect(applyFix(fixed, issue)).toEqual(fixed);
  });

  it("follows the entry point when it changes", () => {
    let doc = bakerySample();
    const menu = doc.nodes.find((n) => n.kind === "agent" && n.name === "menu_specialist") as AgentNode;
    doc = commands.setFrontAgent(doc, menu.id);
    expect(peerIssue(doc)?.nodeId).toBe(menu.id);
  });
});
