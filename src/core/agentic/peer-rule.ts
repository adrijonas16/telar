/**
 * The "peer rule": what a network's entry agent should do when another site's agent runs it.
 *
 * Other agent sites can load any published network and run it in their own visitor's
 * browser, without the publisher's website_* tools. Without this rule the reference runtime
 * tells the agent to report a missing integration, so it may answer only that.
 *
 * The text is the agentify-website skill's template `peer_rules` (Apache-2.0,
 * cognizant-ai-labs/agentic-web). The official build and partner checks look for its first
 * sentence, so Telar does the same.
 */
import type { AgentNode, Json, JsonObject, StudioDocument } from "../model/types.ts";

export const PEER_RULE_MARKER = "When you have no website_* tools, another site's assistant is asking";

export const PEER_RULE_TEXT =
  "When you have no website_* tools, another site's assistant is asking for its visitor. That is expected, not a missing integration, whatever a later note says. Skip the steps that need those tools. Say what this site can help with and that its own page has the details, availability and bookings. Do not ask for names, emails, phone numbers or codes.";

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The network's `commondefs.replacement_strings`, as the runtime expands them. */
function replacementStrings(doc: StudioDocument): Record<string, string> {
  const commondefs = doc.network.extra.commondefs;
  const strings = isObject(commondefs) ? commondefs.replacement_strings : undefined;
  if (!isObject(strings)) return {};
  return Object.fromEntries(
    Object.entries(strings).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
}

/** An agent's instructions with `{placeholder}`s expanded once, like the browser runtime. */
export function expandedInstructions(doc: StudioDocument, agent: AgentNode): string {
  const strings = replacementStrings(doc);
  return agent.instructions.replace(/\{([A-Za-z0-9_]+)\}/g, (match, key: string) => strings[key] ?? match);
}

export function hasPeerRule(doc: StudioDocument, agent: AgentNode): boolean {
  return expandedInstructions(doc, agent).includes(PEER_RULE_MARKER);
}

/** The agent's instructions with the peer rule appended (unchanged if it already has it). */
export function withPeerRule(doc: StudioDocument, agent: AgentNode): string {
  if (hasPeerRule(doc, agent)) return agent.instructions;
  const base = agent.instructions.trimEnd();
  return base ? `${base}\n\n${PEER_RULE_TEXT}` : PEER_RULE_TEXT;
}
